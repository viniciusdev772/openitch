import "server-only";
import type { ObjectId } from "mongodb";
import { db, type ProjectDoc, type UploadDoc } from "@/lib/auth/db";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { toObjectId } from "@/lib/auth/session";
import { canEdit } from "@/lib/projects/access";
import { S3Error, s3Fetch } from "@/lib/storage/s3";
import { expectedPartSize, partCountFor, type DownloadPlatform } from "@/lib/uploads/rules";
import { UploadError, objectHeaders, startUpload } from "@/lib/uploads/server";
import { ItchError } from "./fetch";
import { itchRange, publicFileUrl, publicPageHtml, publicUploads } from "./public";
import { webEntryOf } from "./webcrawl";
import type { ItchUpload } from "./uploads";

/*
 * Arquivos de um rascunho trazido do itch.io, pelo caminho público de download
 * (ver public.ts). O servidor lê cada parte do CDN do itch com Range e grava no
 * envio multipart do MinIO; o registro é o mesmo de um envio feito pelo
 * navegador (startUpload/completeUpload), com as mesmas conferências de tamanho.
 *
 * ponytail: os bytes passam pela Vercel (o resto do site manda direto do navegador
 * ao MinIO): o CDN do itch não libera CORS para o navegador baixar sozinho. Se o
 * volume pesar, troque por um worker perto do MinIO que faça a cópia.
 */

/** Partes (de 5 MiB ou mais) por pedido de "puxar": cabe folgado no tempo de uma função. */
export const PULL_BATCH_MAX = 4;

/** Margem antes do vencimento do link do CDN para pedir outro. */
const CDN_MARGIN_MS = 5 * 60 * 1000;

function asUploadError(err: unknown): never {
  if (err instanceof ItchError) {
    const status = { nao_encontrado: 404, limite: 429, mudou: 409, pago: 402, url: 400 }[err.code as string] ?? 502;
    throw new UploadError(status, `itch_${err.code}`, err.message);
  }
  throw err;
}

async function limit(key: string, max: number, windowMs = 10 * 60 * 1000) {
  const l = await hit(key, max, windowMs);
  if (!l.allowed) throw new UploadError(429, "taxa", `Muitos pedidos seguidos. Espere ${waitText(l.retryAfterMs)} e tente de novo.`);
}

async function ownProject(userId: ObjectId, rawId: unknown): Promise<ProjectDoc> {
  const id = typeof rawId === "string" ? toObjectId(rawId) : null;
  const { projects } = await db();
  const p = id ? await projects.findOne({ _id: id, userId, status: { $ne: "excluindo" } }) : null;
  if (!p || !canEdit({ _id: userId }, p)) throw new UploadError(404, "nao_encontrado", "Esse rascunho não existe ou não é da sua conta.");
  return p;
}

/* ------------------------------------------------------------------ */
/* Listar                                                              */
/* ------------------------------------------------------------------ */

export interface ItchFileRow extends ItchUpload {
  /** Envio daqui que já recebeu este arquivo (pronto ou em andamento). */
  local: { id: string; status: UploadDoc["status"] } | null;
}

export async function listItchFiles(userId: ObjectId, rawProjectId: unknown) {
  try {
    const project = await ownProject(userId, rawProjectId);
    if (!project.source?.itchUrl) return { fromItch: false, files: [] as ItchFileRow[] };
    await limit(`itch:listar:${userId.toHexString()}`, 30);
    const itchUrl = project.source.itchUrl;
    const [files, web] = await Promise.all([publicUploads(itchUrl), publicPageHtml(itchUrl).then((h) => Boolean(webEntryOf(h)))]);
    const { uploads } = await db();
    const locals = await uploads
      .find({ userId, projectId: project._id, "itch.uploadId": { $in: files.map((f) => f.id) }, status: { $in: ["enviando", "pronto"] } })
      .toArray();
    return {
      fromItch: true,
      itchUrl,
      /** O jogo roda no navegador no itch: dá para trazer essa versão. */
      web,
      files: files.map((f): ItchFileRow => {
        const l = locals.find((u) => u.itch?.uploadId === f.id);
        return { ...f, local: l ? { id: l._id.toHexString(), status: l.status } : null };
      }),
    };
  } catch (err) {
    asUploadError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Começar e puxar partes                                              */
/* ------------------------------------------------------------------ */

export async function startItchFile(userId: ObjectId, body: { projectId?: unknown; itchUploadId?: unknown; platform?: unknown }) {
  try {
    await limit(`itch:iniciar:${userId.toHexString()}`, 30);
    const project = await ownProject(userId, body.projectId);
    const itchUrl = project.source?.itchUrl;
    if (!itchUrl) throw new UploadError(400, "itch", "Esse rascunho não veio do itch.io.");
    const id = typeof body.itchUploadId === "number" && Number.isSafeInteger(body.itchUploadId) ? body.itchUploadId : null;
    const up = id === null ? undefined : (await publicUploads(itchUrl)).find((u) => u.id === id);
    if (!up) throw new UploadError(404, "nao_encontrado", "Esse arquivo não está mais no jogo do itch.io. Recarregue a lista.");
    if (!up.platforms.length) throw new UploadError(400, "tipo", "Esse arquivo não é um download de Windows, macOS, Linux ou Android.");
    const platform: DownloadPlatform = up.platforms.find((p) => p === body.platform) ?? up.platforms[0];

    // Link do CDN e o tamanho exato (o itch só mostra "837 MB").
    const cdn = await publicFileUrl(itchUrl, up.id);
    const { total } = await itchRange(cdn.url, 0, 0, null);

    // A plataforma entra no rascunho se ainda não estiver marcada.
    const { projects, uploads } = await db();
    if (!project.platforms.includes(platform)) {
      await projects.updateOne({ _id: project._id, userId }, { $addToSet: { platforms: platform }, $set: { updatedAt: new Date() } });
    }

    const res = await startUpload(userId, {
      projectId: project._id.toHexString(),
      platform,
      filename: up.filename,
      size: total,
      // Mesmo arquivo do itch (id e tamanho): trazer de novo retoma o envio aberto.
      lastModified: up.id,
      checksum: false,
    });
    await uploads.updateOne(
      { _id: toObjectId(res.file.id)!, userId },
      { $set: { itch: { uploadId: up.id, cdn: cdn.url, cdnExpires: cdn.expires } } },
    );
    return { file: res.file, done: res.parts.map((p) => p.n) };
  } catch (err) {
    asUploadError(err);
  }
}

export async function pullItchParts(userId: ObjectId, rawUploadId: unknown, body: { parts?: unknown }) {
  try {
    const list = body.parts;
    if (!Array.isArray(list) || list.length < 1 || list.length > PULL_BATCH_MAX) {
      throw new UploadError(400, "partes", `Peça de 1 a ${PULL_BATCH_MAX} partes por vez.`);
    }
    await limit(`itch:puxar:${userId.toHexString()}`, 1200);
    const id = typeof rawUploadId === "string" ? toObjectId(rawUploadId) : null;
    const { uploads, projects } = await db();
    const u = id ? await uploads.findOne({ _id: id, userId, kind: "download" }) : null;
    if (!u?.itch) throw new UploadError(404, "nao_encontrado", "Esse envio não existe ou não é da sua conta.");
    if (u.status !== "enviando") throw new UploadError(409, "estado", "Esse envio já terminou ou foi cancelado.");
    const count = u.partCount ?? partCountFor(u.size, u.partSize);
    const ns = [...new Set(list)].filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= count);
    if (ns.length !== list.length) throw new UploadError(400, "partes", "Número de parte inválido.");

    // Link do CDN guardado enquanto vale; vencido (ou recusado), pede outro uma vez.
    let url = u.itch.cdn && u.itch.cdnExpires && u.itch.cdnExpires.getTime() - Date.now() > CDN_MARGIN_MS ? u.itch.cdn : null;
    const fresh = async () => {
      const project = await projects.findOne({ _id: u.projectId, userId });
      if (!project?.source?.itchUrl) throw new UploadError(404, "nao_encontrado", "Esse rascunho não existe ou não é da sua conta.");
      const cdn = await publicFileUrl(project.source.itchUrl, u.itch!.uploadId);
      await uploads.updateOne({ _id: u._id, userId }, { $set: { "itch.cdn": cdn.url, "itch.cdnExpires": cdn.expires } });
      return cdn.url;
    };
    url ??= await fresh();

    for (const n of ns) {
      const start = (n - 1) * u.partSize;
      const end = start + expectedPartSize(u.size, u.partSize, n) - 1;
      let bytes: Uint8Array;
      try {
        bytes = (await itchRange(url, start, end, u.size)).bytes;
      } catch (err) {
        if (!(err instanceof ItchError && err.code === "expirou")) throw err;
        url = await fresh();
        bytes = (await itchRange(url, start, end, u.size)).bytes;
      }
      const res =
        u.mode === "multipart" && u.multipartId
          ? await s3Fetch("PUT", u.bucket, u.key, { query: { partNumber: String(n), uploadId: u.multipartId }, body: bytes })
          : await s3Fetch("PUT", u.bucket, u.key, { headers: objectHeaders(u), body: bytes });
      if (!res.ok) throw new S3Error(res.status, "UploadPart", await res.text().catch(() => ""));
    }
    await uploads.updateOne({ _id: u._id, userId }, { $set: { updatedAt: new Date() } });
    return { pulled: ns };
  } catch (err) {
    asUploadError(err);
  }
}

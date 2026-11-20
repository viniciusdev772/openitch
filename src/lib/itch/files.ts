import "server-only";
import type { ObjectId } from "mongodb";
import { db, type ProjectDoc, type UploadDoc } from "@/lib/auth/db";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { toObjectId } from "@/lib/auth/session";
import { canEdit } from "@/lib/projects/access";
import { S3Error, s3Fetch } from "@/lib/storage/s3";
import { expectedPartSize, partCountFor, type DownloadPlatform } from "@/lib/uploads/rules";
import { UploadError, objectHeaders, startUpload } from "@/lib/uploads/server";
import { itchDownloadUrl, itchGames, itchProfile, itchRange, itchUploads, type ItchUpload } from "./api";
import { ItchError } from "./fetch";

/*
 * Arquivos de um jogo do itch.io, trazidos com a chave da API do próprio criador.
 *
 * - Prova de que o jogo é seu: o id do jogo precisa estar em /profile/games da chave.
 * - Downloads (Windows, macOS, Linux, Android): o servidor lê cada parte do itch
 *   com Range e grava no envio multipart do MinIO; o registro é o mesmo de um envio
 *   feito pelo navegador (startUpload/completeUpload), com as mesmas conferências.
 * - Jogo de navegador: o servidor repassa o zip em pedaços de 4 MiB ao navegador,
 *   que o entrega ao fluxo de builds de sempre (lido e conferido no navegador).
 *
 * ponytail: os bytes passam pela Vercel (o resto do site manda direto do navegador
 * ao MinIO). O itch não libera CORS para o navegador baixar sozinho; se o volume
 * pesar, troque por um worker perto do MinIO que faça a cópia.
 */

/** Partes (de 5 MiB ou mais) por pedido de "puxar": cabe folgado no tempo de uma função. */
export const PULL_BATCH_MAX = 4;
/** Pedaço do zip de navegador repassado por pedido (abaixo do teto de 4,5 MB de resposta). */
export const WEB_CHUNK = 4 * 1024 * 1024;

const ctx = (userId: ObjectId) => `itch:${userId.toHexString()}`;

function asUploadError(err: unknown): never {
  if (err instanceof ItchError) {
    const status = { chave: 401, nao_encontrado: 404, limite: 429, sem_conta: 409, nao_e_seu: 403, mudou: 409 }[err.code as string] ?? 502;
    throw new UploadError(status, `itch_${err.code}`, err.message);
  }
  throw err;
}

async function limit(key: string, max: number, windowMs = 10 * 60 * 1000) {
  const l = await hit(key, max, windowMs);
  if (!l.allowed) throw new UploadError(429, "taxa", `Muitos pedidos seguidos. Espere ${waitText(l.retryAfterMs)} e tente de novo.`);
}

/* ------------------------------------------------------------------ */
/* Chave da API                                                        */
/* ------------------------------------------------------------------ */

const KEY_RE = /^[A-Za-z0-9_-]{20,128}$/;

export async function connectItchKey(userId: ObjectId, raw: string): Promise<{ username: string }> {
  const key = raw.trim();
  if (!KEY_RE.test(key)) throw new ItchError("chave", "Essa não parece uma chave da API do itch.io. Copie de novo em itch.io/user/settings/api-keys.");
  const profile = await itchProfile(key);
  const { users } = await db();
  await users.updateOne(
    { _id: userId },
    {
      $set: {
        itch: { key: encryptSecret(Buffer.from(key, "utf8"), ctx(userId)), userId: profile.id, username: profile.username, connectedAt: new Date() },
        updatedAt: new Date(),
      },
    },
  );
  return { username: profile.username };
}

export async function disconnectItchKey(userId: ObjectId) {
  const { users } = await db();
  await users.updateOne({ _id: userId }, { $set: { itch: null, updatedAt: new Date() } });
}

/** Chave decifrada da conta, ou null se não houver. */
export async function itchKeyOf(userId: ObjectId): Promise<{ key: string; username: string } | null> {
  const { users } = await db();
  const u = await users.findOne({ _id: userId }, { projection: { itch: 1 } });
  if (!u?.itch?.key) return null;
  const plain = decryptSecret(u.itch.key, ctx(userId));
  return plain ? { key: plain.toString("utf8"), username: u.itch.username } : null;
}

async function requireKey(userId: ObjectId) {
  const k = await itchKeyOf(userId);
  if (!k) throw new ItchError("sem_conta", "Ligue sua conta do itch.io (chave da API) para trazer os arquivos.");
  return k.key;
}

/** O jogo está entre os da chave? Confere uma vez e grava no rascunho. */
export async function verifyOwnership(userId: ObjectId, project: ProjectDoc, key: string) {
  const itchId = project.source?.itchId;
  if (!itchId) throw new ItchError("nao_encontrado", "Esse rascunho não veio do itch.io.");
  if (project.source?.verified) return itchId;
  const mine = await itchGames(key);
  if (!mine.some((g) => g.id === itchId)) {
    throw new ItchError("nao_e_seu", "Esse jogo não aparece na sua conta do itch.io. Só dá para trazer os arquivos de jogos que são seus.");
  }
  const { projects } = await db();
  await projects.updateOne({ _id: project._id, userId }, { $set: { "source.verified": true } });
  return itchId;
}

async function ownProject(userId: ObjectId, rawId: unknown): Promise<ProjectDoc> {
  const id = typeof rawId === "string" ? toObjectId(rawId) : null;
  const { projects } = await db();
  const p = id ? await projects.findOne({ _id: id, userId, status: { $ne: "excluindo" } }) : null;
  if (!p || !canEdit({ _id: userId }, p)) throw new UploadError(404, "nao_encontrado", "Esse rascunho não existe ou não é da sua conta.");
  return p;
}

async function uploadOf(key: string, gameId: number, itchUploadId: unknown): Promise<ItchUpload> {
  const id = typeof itchUploadId === "number" && Number.isSafeInteger(itchUploadId) ? itchUploadId : null;
  const up = id === null ? undefined : (await itchUploads(key, gameId)).find((u) => u.id === id);
  if (!up) throw new ItchError("nao_encontrado", "Esse arquivo não está mais no jogo do itch.io. Recarregue a lista.");
  return up;
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
    await limit(`itch:listar:${userId.toHexString()}`, 60);
    const project = await ownProject(userId, rawProjectId);
    if (!project.source?.itchId) return { connected: true, fromItch: false, files: [] as ItchFileRow[] };
    const k = await itchKeyOf(userId);
    if (!k) return { connected: false, fromItch: true, files: [] as ItchFileRow[] };
    const gameId = await verifyOwnership(userId, project, k.key);
    const files = await itchUploads(k.key, gameId);
    const { uploads } = await db();
    const locals = await uploads
      .find({ userId, projectId: project._id, "itch.uploadId": { $in: files.map((f) => f.id) }, status: { $in: ["enviando", "pronto"] } })
      .toArray();
    return {
      connected: true,
      fromItch: true,
      username: k.username,
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
/* Download: começar e puxar partes                                    */
/* ------------------------------------------------------------------ */

export async function startItchFile(userId: ObjectId, body: { projectId?: unknown; itchUploadId?: unknown; platform?: unknown }) {
  try {
    const project = await ownProject(userId, body.projectId);
    const key = await requireKey(userId);
    const gameId = await verifyOwnership(userId, project, key);
    const up = await uploadOf(key, gameId, body.itchUploadId);
    if (up.kind !== "download") throw new UploadError(400, "tipo", "Esse arquivo não é um download de Windows, macOS, Linux ou Android.");
    const platform: DownloadPlatform = up.platforms.find((p) => p === body.platform) ?? up.platforms[0];

    // A plataforma entra no rascunho se ainda não estiver marcada.
    const { projects, uploads } = await db();
    if (!project.platforms.includes(platform)) {
      await projects.updateOne({ _id: project._id, userId }, { $addToSet: { platforms: platform }, $set: { updatedAt: new Date() } });
    }

    const res = await startUpload(userId, {
      projectId: project._id.toHexString(),
      platform,
      filename: up.filename,
      size: up.size,
      // Versão do arquivo no itch: trazer de novo o mesmo arquivo retoma o envio aberto.
      lastModified: up.updatedAt ?? up.id,
      checksum: false,
    });
    await uploads.updateOne({ _id: toObjectId(res.file.id)!, userId }, { $set: { itch: { uploadId: up.id, buildId: up.buildId } } });
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
    const project = await projects.findOne({ _id: u.projectId, userId });
    if (!project) throw new UploadError(404, "nao_encontrado", "Esse rascunho não existe ou não é da sua conta.");

    const count = u.partCount ?? partCountFor(u.size, u.partSize);
    const ns = [...new Set(list)].filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= count);
    if (ns.length !== list.length) throw new UploadError(400, "partes", "Número de parte inválido.");

    const key = await requireKey(userId);
    await verifyOwnership(userId, project, key);
    const url = await itchDownloadUrl(key, { id: u.itch.uploadId, buildId: u.itch.buildId, storage: u.itch.buildId ? "build" : "hosted" });

    for (const n of ns) {
      const start = (n - 1) * u.partSize;
      const bytes = await itchRange(url, start, start + expectedPartSize(u.size, u.partSize, n) - 1, u.size, key);
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

/* ------------------------------------------------------------------ */
/* Jogo de navegador: zip em pedaços para o navegador                  */
/* ------------------------------------------------------------------ */

export async function webZipChunk(userId: ObjectId, rawProjectId: unknown, rawItchUploadId: unknown, rawN: unknown) {
  try {
    await limit(`itch:web:${userId.toHexString()}`, 2000);
    const project = await ownProject(userId, rawProjectId);
    const key = await requireKey(userId);
    const gameId = await verifyOwnership(userId, project, key);
    const up = await uploadOf(key, gameId, Number(rawItchUploadId));
    if (up.kind !== "web") throw new UploadError(400, "tipo", "Esse arquivo não é a versão de navegador do jogo.");
    const n = Number(rawN);
    const chunks = Math.max(1, Math.ceil(up.size / WEB_CHUNK));
    if (!Number.isInteger(n) || n < 0 || n >= chunks) throw new UploadError(400, "partes", "Pedaço inválido.");
    if (n === 0 && !project.platforms.includes("web")) {
      const { projects } = await db();
      await projects.updateOne({ _id: project._id, userId }, { $addToSet: { platforms: "web" }, $set: { updatedAt: new Date() } });
    }
    const start = n * WEB_CHUNK;
    const end = Math.min(up.size, start + WEB_CHUNK) - 1;
    const url = await itchDownloadUrl(key, up);
    return { bytes: await itchRange(url, start, end, up.size, key), size: up.size, filename: up.filename };
  } catch (err) {
    asUploadError(err);
  }
}

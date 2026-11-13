import "server-only";
import { requestInfo } from "@/lib/auth/request";
import { ObjectId } from "mongodb";
import { db, type ProjectDoc, type UploadDoc, type UserDoc } from "@/lib/auth/db";
import { toObjectId } from "@/lib/auth/session";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { canEdit, canView } from "@/lib/projects/access";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  deleteObject,
  headObject,
  listParts,
  presign,
  presignDownload,
  presignUploadPartChecked,
  purgePrefix,
  putObjectTagging,
  S3Error,
  s3Config,
  storageConfigured,
} from "@/lib/storage/s3";
import { ensureStorage } from "@/lib/storage/setup";
import { DOWNLOAD_URL_TTL, MAX_FILE_BYTES, UPLOAD_URL_TTL, USER_QUOTA_BYTES } from "@/lib/storage/limits";
import {
  cleanFilename,
  contentTypeFor,
  expectedPartSize,
  isDownloadPlatform,
  keyName,
  MAX_FILES_PER_PROJECT,
  MAX_OPEN_UPLOADS,
  partCountFor,
  partSizeFor,
  SIGN_BATCH_MAX,
  sizeError,
  type DownloadPlatform,
} from "./rules";

/*
 * Envio de arquivos para baixar, direto do navegador para o MinIO.
 *
 * A Vercel nunca vê os bytes: aqui só se confere quem pede, assina URLs
 * curtas e confere o resultado. Toda consulta filtra pelo userId da sessão
 * (nunca por um id vindo do pedido); id forjado, de outra conta ou
 * inexistente dá a mesma resposta: "não encontrado".
 *
 * Defesas contra cliente mentiroso:
 * - o tamanho declarado é conferido (≤ 3 GB, cota) antes de assinar;
 * - cada URL de parte assina o Content-Length exato daquela parte: corpo
 *   maior ou menor não passa na assinatura (403 do MinIO);
 * - com checksum, a URL assina o SHA-256 da parte e o MinIO recusa bytes
 *   diferentes (400);
 * - ao concluir, o servidor lista as partes no MinIO (ListParts), confere
 *   número, tamanho de cada uma e total, conclui e confere de novo com HEAD.
 */

export class UploadError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const NOT_FOUND = () => new UploadError(404, "nao_encontrado", "Esse arquivo não existe ou não é da sua conta.");
const PROJECT_NOT_FOUND = () => new UploadError(404, "nao_encontrado", "Esse rascunho não existe ou não é da sua conta.");
const STALE_MS = 24 * 60 * 60 * 1000;
const LOCK_MS = 2 * 60 * 1000;
const WINDOW = 10 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* O que o navegador recebe                                            */
/* ------------------------------------------------------------------ */

export interface FileView {
  id: string;
  platform: DownloadPlatform;
  filename: string;
  size: number;
  status: UploadDoc["status"];
  mode: "single" | "multipart";
  partSize: number;
  partCount: number;
  checksum: boolean;
  lastModified: number | null;
  createdAt: string;
  completedAt: string | null;
}

function view(d: UploadDoc): FileView {
  return {
    id: d._id.toHexString(),
    platform: d.platform as DownloadPlatform,
    filename: d.filename,
    size: d.size,
    status: d.status,
    mode: d.mode ?? (d.multipartId ? "multipart" : "single"),
    partSize: d.partSize,
    partCount: d.partCount ?? partCountFor(d.size, d.partSize),
    checksum: Boolean(d.checksum),
    lastModified: d.lastModified ?? null,
    createdAt: d.createdAt.toISOString(),
    completedAt: d.completedAt ? d.completedAt.toISOString() : null,
  };
}

export interface SignedPart {
  n: number;
  url: string;
  /** Cabeçalhos que o navegador precisa mandar exatamente assim (assinados). */
  headers: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Apoio                                                               */
/* ------------------------------------------------------------------ */

function requireStorage() {
  if (!storageConfigured()) throw new UploadError(503, "sem_armazenamento", "O envio de arquivos ainda não está ligado neste site.");
}

async function limit(key: string, max: number) {
  const l = await hit(key, max, WINDOW);
  if (!l.allowed) throw new UploadError(429, "taxa", `Muitos pedidos seguidos. Espere ${waitText(l.retryAfterMs)} e tente de novo.`);
}

async function ownProject(userId: ObjectId, rawId: unknown): Promise<ProjectDoc> {
  const id = typeof rawId === "string" ? toObjectId(rawId) : null;
  if (!id) throw PROJECT_NOT_FOUND();
  const { projects } = await db();
  const p = await projects.findOne({ _id: id, userId, status: { $ne: "excluindo" } });
  if (!p || !canEdit({ _id: userId }, p)) throw PROJECT_NOT_FOUND();
  return p;
}

async function ownUpload(userId: ObjectId, rawId: unknown): Promise<UploadDoc> {
  const id = typeof rawId === "string" ? toObjectId(rawId) : null;
  if (!id) throw NOT_FOUND();
  const { uploads } = await db();
  const u = await uploads.findOne({ _id: id, userId, kind: "download" });
  if (!u) throw NOT_FOUND();
  return u;
}

const uploadPrefix = (u: Pick<UploadDoc, "userId" | "projectId" | "_id">) =>
  `u/${u.userId.toHexString()}/${u.projectId.toHexString()}/${u._id.toHexString()}/`;

function disposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())}`;
}

function objectHeaders(u: UploadDoc): Record<string, string> {
  return {
    "content-type": u.contentType,
    "content-disposition": disposition(u.filename),
    "x-amz-tagging": `status=enviando&userId=${u.userId.toHexString()}&projectId=${u.projectId.toHexString()}`,
    "x-amz-meta-user-id": u.userId.toHexString(),
    "x-amz-meta-project-id": u.projectId.toHexString(),
    "x-amz-meta-upload-id": u._id.toHexString(),
    "x-amz-meta-platform": u.platform,
  };
}

const B64_SHA256 = /^[A-Za-z0-9+/]{43}=$/;

/** Bytes que a conta ocupa: arquivos (enviando + prontos) e builds de navegador. */
export async function usageOf(userId: ObjectId): Promise<number> {
  const { uploads, builds } = await db();
  const [a] = await uploads
    .aggregate<{ total: number }>([
      { $match: { userId, status: { $in: ["enviando", "pronto"] } } },
      { $group: { _id: null, total: { $sum: "$size" } } },
    ])
    .toArray();
  const [b] = await builds
    .aggregate<{ total: number }>([
      { $match: { userId, status: { $in: ["enviando", "pronto"] } } },
      { $group: { _id: null, total: { $sum: "$totalSize" } } },
    ])
    .toArray();
  return (a?.total ?? 0) + (b?.total ?? 0);
}

/** Envios parados há mais de 24 h: aborta no MinIO e marca cancelado (libera a cota). */
async function sweepStale(userId: ObjectId) {
  const { uploads } = await db();
  const stale = await uploads
    .find({ userId, status: "enviando", updatedAt: { $lt: new Date(Date.now() - STALE_MS) } })
    .limit(20)
    .toArray();
  for (const u of stale) {
    try {
      if (storageConfigured()) await purgePrefix(u.bucket, uploadPrefix(u));
    } catch (err) {
      console.error("[envios] limpeza", err);
      continue;
    }
    await uploads.updateOne({ _id: u._id, userId, status: "enviando" }, { $set: { status: "cancelado", multipartId: null, updatedAt: new Date() } });
  }
}

/* ------------------------------------------------------------------ */
/* Listar                                                              */
/* ------------------------------------------------------------------ */

export async function listFiles(userId: ObjectId, rawProjectId: unknown) {
  const project = await ownProject(userId, rawProjectId);
  await sweepStale(userId);
  const { uploads } = await db();
  const docs = await uploads
    .find({ userId, projectId: project._id, kind: "download", status: { $in: ["enviando", "pronto"] } })
    .sort({ createdAt: 1 })
    .limit(MAX_FILES_PER_PROJECT * 2)
    .toArray();
  return {
    files: docs.map(view),
    used: await usageOf(userId),
    quota: USER_QUOTA_BYTES,
    storage: storageConfigured(),
  };
}

/* ------------------------------------------------------------------ */
/* Iniciar                                                             */
/* ------------------------------------------------------------------ */

export interface StartInput {
  projectId?: unknown;
  platform?: unknown;
  filename?: unknown;
  size?: unknown;
  lastModified?: unknown;
  checksum?: unknown;
  /** SHA-256 (base64) do arquivo inteiro, só no PUT único com checksum. */
  sha256?: unknown;
}

export async function startUpload(userId: ObjectId, input: StartInput) {
  requireStorage();
  if (!isDownloadPlatform(input.platform)) throw new UploadError(400, "plataforma", "Escolha Windows, macOS, Linux ou Android.");
  const platform = input.platform;
  const fname = cleanFilename(input.filename);
  if (!fname.ok) throw new UploadError(400, "nome", fname.error);
  const sErr = sizeError(input.size);
  if (sErr) throw new UploadError(input.size === 0 ? 400 : 413, "tamanho", sErr);
  const size = input.size as number;
  const lastModified =
    typeof input.lastModified === "number" && Number.isSafeInteger(input.lastModified) && input.lastModified >= 0 ? input.lastModified : null;
  const checksum = input.checksum === true;
  const partSize = partSizeFor(size);
  const partCount = partCountFor(size, partSize);
  const mode: "single" | "multipart" = partCount === 1 ? "single" : "multipart";
  const sha256 = typeof input.sha256 === "string" && B64_SHA256.test(input.sha256) ? input.sha256 : null;
  if (mode === "single" && checksum && !sha256) throw new UploadError(400, "checksum", "Falta a soma de verificação do arquivo.");

  await limit(`envios:iniciar:${userId.toHexString()}`, 40);
  const project = await ownProject(userId, input.projectId);
  if (!project.platforms.includes(platform)) {
    throw new UploadError(400, "plataforma", "Marque essa plataforma no rascunho antes de enviar o arquivo dela.");
  }

  const { uploads } = await db();

  // Mesmo arquivo de um envio aberto: retoma em vez de começar outro.
  if (lastModified !== null) {
    const open = await uploads.findOne({
      userId,
      projectId: project._id,
      kind: "download",
      platform,
      filename: fname.name,
      size,
      lastModified,
      checksum,
      status: "enviando",
    });
    if (open) {
      await uploads.updateOne({ _id: open._id, userId }, { $set: { updatedAt: new Date() } });
      const parts = open.mode === "multipart" && open.multipartId ? await partsOf(open) : [];
      const first = open.mode === "single" ? signFor(open, [{ n: 1, sha256 }]) : [];
      return { file: view(open), resumed: true, parts, urls: first, expiresAt: expiresAt() };
    }
  }

  await sweepStale(userId);
  if ((await uploads.countDocuments({ userId, status: "enviando" })) >= MAX_OPEN_UPLOADS) {
    throw new UploadError(409, "abertos", `Você já tem ${MAX_OPEN_UPLOADS} envios em andamento. Termine ou cancele algum antes.`);
  }
  if ((await uploads.countDocuments({ userId, projectId: project._id, status: { $in: ["enviando", "pronto"] } })) >= MAX_FILES_PER_PROJECT) {
    throw new UploadError(409, "limite", `Cada rascunho aceita até ${MAX_FILES_PER_PROJECT} arquivos. Exclua algum antes de enviar outro.`);
  }

  await ensureStorage();
  const { buckets } = s3Config();
  const now = new Date();
  const _id = new ObjectId();
  const doc: UploadDoc = {
    _id,
    userId,
    projectId: project._id,
    kind: "download",
    platform,
    filename: fname.name,
    size,
    contentType: contentTypeFor(fname.name),
    bucket: buckets.files,
    key: `u/${userId.toHexString()}/${project._id.toHexString()}/${_id.toHexString()}/${keyName(fname.name)}`,
    multipartId: null,
    partSize,
    status: "enviando",
    sha256: mode === "single" ? sha256 : null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    lastModified: lastModified ?? undefined,
    checksum,
    partCount,
    mode,
    etag: null,
  };
  await uploads.insertOne(doc);

  // Cota conferida depois de gravar, para que envios simultâneos não passem do teto.
  const used = await usageOf(userId);
  if (used > USER_QUOTA_BYTES) {
    await uploads.deleteOne({ _id, userId });
    const free = Math.max(0, USER_QUOTA_BYTES - (used - size));
    throw new UploadError(
      413,
      "cota",
      `Esse arquivo não cabe no seu espaço: restam ${formatGB(free)} de ${formatGB(USER_QUOTA_BYTES)}. Exclua arquivos antigos e tente de novo.`,
    );
  }

  try {
    if (mode === "multipart") {
      const headers = objectHeaders(doc);
      if (checksum) headers["x-amz-checksum-algorithm"] = "SHA256";
      doc.multipartId = await createMultipartUpload(doc.bucket, doc.key, headers);
      await uploads.updateOne({ _id, userId }, { $set: { multipartId: doc.multipartId } });
    }
  } catch (err) {
    await uploads.deleteOne({ _id, userId });
    throw err;
  }
  const urls = mode === "single" ? signFor(doc, [{ n: 1, sha256 }]) : [];
  return { file: view(doc), resumed: false, parts: [] as { n: number; size: number }[], urls, expiresAt: expiresAt() };
}

const formatGB = (n: number) => `${(n / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
const expiresAt = () => new Date(Date.now() + UPLOAD_URL_TTL * 1000).toISOString();

async function partsOf(u: UploadDoc) {
  if (!u.multipartId) return [];
  try {
    const parts = await listParts(u.bucket, u.key, u.multipartId);
    const count = u.partCount ?? partCountFor(u.size, u.partSize);
    // Só partes com o tamanho certo contam como enviadas.
    return parts
      .filter((p) => p.partNumber >= 1 && p.partNumber <= count && p.size === expectedPartSize(u.size, u.partSize, p.partNumber))
      .map((p) => ({ n: p.partNumber, size: p.size }));
  } catch (err) {
    if (err instanceof S3Error && err.code === "NoSuchUpload") {
      // O MinIO já descartou o multipart (expirou): abre outro no mesmo registro e recomeça do zero,
      // em vez de devolver um id morto que faria todas as partes falharem.
      const headers = objectHeaders(u);
      if (u.checksum) headers["x-amz-checksum-algorithm"] = "SHA256";
      const multipartId = await createMultipartUpload(u.bucket, u.key, headers);
      await (await db()).uploads.updateOne(
        { _id: u._id, userId: u.userId, multipartId: u.multipartId },
        { $set: { multipartId, updatedAt: new Date() } },
      );
      u.multipartId = multipartId;
      return [];
    }
    throw err;
  }
}

function signFor(u: UploadDoc, parts: { n: number; sha256: string | null }[]): SignedPart[] {
  if (u.mode === "single" || !u.multipartId) {
    const headers = objectHeaders(u);
    const sha = parts[0]?.sha256 ?? u.sha256;
    if (u.checksum && sha) headers["x-amz-checksum-sha256"] = sha;
    const url = presign("PUT", u.bucket, u.key, {
      expires: UPLOAD_URL_TTL,
      headers: { ...headers, "content-length": String(u.size) },
    });
    return [{ n: 1, url, headers }];
  }
  return parts.map((p): SignedPart => ({
    n: p.n,
    url: presignUploadPartChecked(u.bucket, u.key, u.multipartId as string, p.n, {
      contentLength: expectedPartSize(u.size, u.partSize, p.n),
      sha256: u.checksum ? p.sha256 : null,
      expires: UPLOAD_URL_TTL,
    }),
    headers: u.checksum && p.sha256 ? { "x-amz-checksum-sha256": p.sha256 } : ({} as Record<string, string>),
  }));
}

/* ------------------------------------------------------------------ */
/* Assinar partes                                                      */
/* ------------------------------------------------------------------ */

export async function signParts(userId: ObjectId, rawId: unknown, input: { parts?: unknown }) {
  requireStorage();
  const list = input.parts;
  if (!Array.isArray(list) || list.length < 1 || list.length > SIGN_BATCH_MAX) {
    throw new UploadError(400, "partes", `Peça de 1 a ${SIGN_BATCH_MAX} partes por vez.`);
  }
  await limit(`envios:assinar:${userId.toHexString()}`, 600);
  const u = await ownUpload(userId, rawId);
  if (u.status !== "enviando") throw new UploadError(409, "estado", "Esse envio já terminou ou foi cancelado.");
  const count = u.partCount ?? partCountFor(u.size, u.partSize);
  const seen = new Set<number>();
  const parts: { n: number; sha256: string | null }[] = [];
  for (const raw of list) {
    const n = (raw as { n?: unknown })?.n;
    const sha = (raw as { sha256?: unknown })?.sha256;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > count || seen.has(n)) {
      throw new UploadError(400, "partes", "Número de parte inválido.");
    }
    if (u.checksum && (typeof sha !== "string" || !B64_SHA256.test(sha))) {
      throw new UploadError(400, "checksum", "Falta a soma de verificação da parte.");
    }
    seen.add(n);
    parts.push({ n, sha256: u.checksum ? (sha as string) : null });
  }
  if (u.mode === "single" && u.checksum && parts[0].sha256 !== u.sha256) {
    throw new UploadError(400, "checksum", "A soma de verificação não é a do arquivo informado ao iniciar.");
  }
  const { uploads } = await db();
  await uploads.updateOne({ _id: u._id, userId }, { $set: { updatedAt: new Date() } });
  return { urls: signFor(u, parts), expiresAt: expiresAt() };
}

/* ------------------------------------------------------------------ */
/* Estado (para retomar)                                               */
/* ------------------------------------------------------------------ */

export async function uploadState(userId: ObjectId, rawId: unknown) {
  await limit(`envios:estado:${userId.toHexString()}`, 300);
  const u = await ownUpload(userId, rawId);
  const parts = u.status === "enviando" && storageConfigured() ? await partsOf(u) : [];
  return { file: view(u), parts };
}

/* ------------------------------------------------------------------ */
/* Concluir                                                            */
/* ------------------------------------------------------------------ */

async function discard(u: UploadDoc, reason: string) {
  const { uploads } = await db();
  try {
    if (u.mode !== "multipart") await putObjectTagging(u.bucket, u.key, { status: "descartado" }).catch(() => undefined);
    await purgePrefix(u.bucket, uploadPrefix(u));
  } catch (err) {
    console.error("[envios] descarte", reason, err);
  }
  await uploads.updateOne({ _id: u._id, userId: u.userId }, { $set: { status: "cancelado", multipartId: null, updatedAt: new Date() } });
}

export async function completeUpload(userId: ObjectId, rawId: unknown) {
  requireStorage();
  await limit(`envios:outros:${userId.toHexString()}`, 200);
  const first = await ownUpload(userId, rawId);
  if (first.status === "pronto") return { file: view(first) };
  if (first.status !== "enviando") throw new UploadError(409, "estado", "Esse envio foi cancelado.");

  // Trava curta: dois "concluir" ao mesmo tempo não disputam o mesmo upload.
  const { uploads } = await db();
  const now = new Date();
  const locked = await uploads.findOneAndUpdate(
    {
      _id: first._id,
      userId,
      status: "enviando",
      $or: [{ completing: { $exists: false } }, { completing: null }, { completing: { $lt: new Date(now.getTime() - LOCK_MS) } }],
    } as Record<string, unknown>,
    { $set: { completing: now, updatedAt: now } as Partial<UploadDoc> },
    { returnDocument: "after" },
  );
  if (!locked) {
    const again = await ownUpload(userId, rawId);
    if (again.status === "pronto") return { file: view(again) };
    throw new UploadError(409, "concluindo", "Esse envio já está sendo concluído. Espere alguns segundos.");
  }
  const u = locked;
  const unlock = () => uploads.updateOne({ _id: u._id, userId }, { $unset: { completing: "" } as Record<string, ""> });

  try {
    const count = u.partCount ?? partCountFor(u.size, u.partSize);
    let etag: string | null = null;

    if (u.mode === "multipart" && u.multipartId) {
      const parts = await listParts(u.bucket, u.key, u.multipartId).catch(async (err) => {
        // Já concluído antes (resposta perdida): o objeto existe.
        if (err instanceof S3Error && err.code === "NoSuchUpload") return null;
        throw err;
      });
      if (parts) {
        const byNumber = new Map(parts.map((p) => [p.partNumber, p]));
        const missing: number[] = [];
        let total = 0;
        for (let n = 1; n <= count; n++) {
          const p = byNumber.get(n);
          if (!p) {
            missing.push(n);
            continue;
          }
          if (p.size !== expectedPartSize(u.size, u.partSize, n) || (u.checksum && !p.checksumSHA256)) {
            await discard(u, "parte com tamanho errado");
            throw new UploadError(422, "tamanho", "O arquivo enviado não tem o tamanho informado. O envio foi descartado; comece de novo.");
          }
          total += p.size;
        }
        if (parts.some((p) => p.partNumber > count)) {
          await discard(u, "partes a mais");
          throw new UploadError(422, "tamanho", "O arquivo enviado é maior que o informado. O envio foi descartado; comece de novo.");
        }
        if (missing.length) {
          await unlock();
          return { missing };
        }
        if (total !== u.size || total > MAX_FILE_BYTES) {
          await discard(u, "total diferente");
          throw new UploadError(422, "tamanho", "O arquivo enviado não tem o tamanho informado. O envio foi descartado; comece de novo.");
        }
        const res = await completeMultipartUpload(
          u.bucket,
          u.key,
          u.multipartId,
          parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag, checksumSHA256: p.checksumSHA256 })),
        );
        etag = res.etag;
      }
    }

    const head = await headObject(u.bucket, u.key);
    if (!head) {
      await unlock();
      if (u.mode === "single") return { missing: [1] };
      throw new UploadError(409, "incompleto", "O MinIO não encontrou o arquivo concluído. Tente concluir de novo.");
    }
    if (head.size !== u.size || head.size > MAX_FILE_BYTES) {
      await discard(u, "HEAD diferente");
      throw new UploadError(422, "tamanho", "O arquivo enviado não tem o tamanho informado. O envio foi descartado; comece de novo.");
    }
    // Cota de novo, agora com o tamanho real.
    if ((await usageOf(userId)) > USER_QUOTA_BYTES) {
      await discard(u, "cota");
      throw new UploadError(413, "cota", "O arquivo passou do seu espaço disponível e foi descartado. Exclua arquivos antigos e tente de novo.");
    }
    await putObjectTagging(u.bucket, u.key, {
      status: "pronto",
      userId: u.userId.toHexString(),
      projectId: u.projectId.toHexString(),
    });
    const done = new Date();
    const res = await uploads.findOneAndUpdate(
      { _id: u._id, userId, status: "enviando" },
      {
        $set: { status: "pronto", multipartId: null, completedAt: done, updatedAt: done, etag: etag ?? head.etag },
        $unset: { completing: "" },
      } as Record<string, unknown>,
      { returnDocument: "after" },
    );
    if (!res) {
      // Cancelado enquanto concluía: não deixa o objeto órfão.
      await discard(u, "cancelado durante a conclusão");
      throw new UploadError(409, "estado", "Esse envio foi cancelado.");
    }
    return { file: view(res) };
  } catch (err) {
    if (!(err instanceof UploadError)) await unlock().catch(() => undefined);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Cancelar / excluir                                                  */
/* ------------------------------------------------------------------ */

export async function removeUpload(userId: ObjectId, rawId: unknown) {
  requireStorage();
  await limit(`envios:outros:${userId.toHexString()}`, 200);
  const u = await ownUpload(userId, rawId);
  const { uploads } = await db();
  if (u.status === "enviando") {
    const res = await uploads.updateOne({ _id: u._id, userId, status: "enviando" }, { $set: { status: "cancelado", updatedAt: new Date() } });
    if (res.matchedCount === 1) {
      if (u.multipartId) await abortMultipartUpload(u.bucket, u.key, u.multipartId).catch(() => undefined);
      await purgePrefix(u.bucket, uploadPrefix(u));
      await uploads.updateOne({ _id: u._id, userId }, { $set: { multipartId: null } });
    }
    return { removed: "cancelado" as const };
  }
  if (u.status === "pronto") {
    // Marca como descartado e apaga: com o versionamento, a versão antiga
    // fica recuperável por 7 dias (regra de lifecycle) e depois some.
    await putObjectTagging(u.bucket, u.key, { status: "descartado", userId: u.userId.toHexString(), projectId: u.projectId.toHexString() }).catch(
      () => undefined,
    );
    await deleteObject(u.bucket, u.key);
    await uploads.deleteOne({ _id: u._id, userId });
    return { removed: "excluido" as const };
  }
  await uploads.deleteOne({ _id: u._id, userId });
  return { removed: "excluido" as const };
}

/* ------------------------------------------------------------------ */
/* Baixar                                                              */
/* ------------------------------------------------------------------ */

/** URL curta de download direto do MinIO, ou null se quem pede não pode ver. */
export async function downloadUrlFor(viewer: Pick<UserDoc, "_id"> | null, rawId: unknown): Promise<string | null> {
  if (!storageConfigured()) return null;
  const id = typeof rawId === "string" ? toObjectId(rawId) : null;
  if (!id) return null;
  // Com conta, por conta; sem conta (jogo publicado), por IP.
  if (viewer) await limit(`envios:baixar:${viewer._id.toHexString()}`, 120);
  else await limit(`envios:baixar:ip:${(await requestInfo()).ip}`, 60);
  const { uploads, projects } = await db();
  const u = await uploads.findOne({ _id: id, status: "pronto", kind: "download" });
  if (!u) return null;
  const project = await projects.findOne({ _id: u.projectId, userId: u.userId });
  if (!project || !canView(viewer, project)) return null;
  return presignDownload(u.bucket, u.key, u.filename, DOWNLOAD_URL_TTL);
}

/* ------------------------------------------------------------------ */
/* Exclusão em massa (rascunho, conta)                                 */
/* ------------------------------------------------------------------ */

/** Apaga de vez (todas as versões) os arquivos de um rascunho e seus registros. */
export async function deleteUploadsOfProject(userId: ObjectId, projectId: ObjectId) {
  if (storageConfigured()) {
    const { buckets } = s3Config();
    await purgePrefix(buckets.files, `u/${userId.toHexString()}/${projectId.toHexString()}/`);
  }
  const { uploads } = await db();
  await uploads.deleteMany({ userId, projectId });
}

/** Apaga de vez todos os arquivos de uma conta e seus registros. */
export async function deleteUploadsOfUser(userId: ObjectId) {
  if (storageConfigured()) {
    const { buckets } = s3Config();
    await purgePrefix(buckets.files, `u/${userId.toHexString()}/`);
    // Registros que apontem para outro bucket (troca de configuração) também.
    const { uploads } = await db();
    const others = await uploads.distinct("bucket", { userId, bucket: { $ne: buckets.files } });
    for (const b of others) await purgePrefix(b, `u/${userId.toHexString()}/`);
  }
  const { uploads } = await db();
  await uploads.deleteMany({ userId });
}

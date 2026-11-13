import "server-only";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { db, type BuildDoc, type BuildFileDoc, type WebEngine } from "@/lib/auth/db";
import { hit, waitText } from "@/lib/auth/ratelimit";
import {
  S3Error,
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  deleteObjects,
  listKeys,
  listParts,
  presign,
  purgePrefix,
  s3Config,
} from "@/lib/storage/s3";
import { ensureStorage } from "@/lib/storage/setup";
import { usageOf } from "@/lib/uploads/server";
import { MAX_WEB_BUILD_BYTES, MAX_WEB_BUILD_FILES, USER_QUOTA_BYTES, formatBytes } from "@/lib/storage/limits";
import { cleanBuildPath, COI_FILE, dirOf } from "./paths";
import { headersFor } from "./mime";
import { ENGINES } from "./detect";
import {
  BUILD_PART_SIZE,
  BUILD_SINGLE_MAX,
  MAX_BUILDS_PER_PROJECT,
  MAX_OPEN_BUILDS,
  PART_URL_TTL,
  PUBLIC_ID_RE,
  SIGN_BATCH,
  SINGLE_URL_TTL,
  STALE_UPLOAD_MS,
} from "./config";

/*
 * Builds de navegador no bucket jogável. O servidor (Vercel) nunca toca nos
 * bytes do jogo: só confere, registra e ASSINA URLs. O navegador envia cada
 * arquivo direto para o MinIO em b/<publicId>/<caminho>, com Content-Type,
 * Content-Encoding, Cache-Control e Content-Length fixados na assinatura.
 *
 * Toda função recebe o userId da SESSÃO e só encontra builds desse usuário:
 * um id de outra conta, inexistente ou forjado dá o mesmo "não encontrado".
 */

export class BuildError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const NOT_FOUND = "Esse build não existe ou não é da sua conta.";
const MINUTE = 60_000;

const bucket = () => s3Config().buckets.play;

/* ------------------------------------------------------------------ */
/* Índice (uma vez por instância)                                      */
/* ------------------------------------------------------------------ */

type Prep = { index?: Promise<void> };
const g = globalThis as typeof globalThis & { __vgBuilds?: Prep };
const prep: Prep = (g.__vgBuilds ??= {});

async function collections() {
  const c = await db();
  if (!prep.index) {
    prep.index = c.builds
      .createIndex({ publicId: 1 }, { unique: true, partialFilterExpression: { publicId: { $type: "string" } } })
      .then(() => undefined)
      .catch((err) => {
        prep.index = undefined;
        throw err;
      });
  }
  await prep.index;
  return c;
}

/* ------------------------------------------------------------------ */
/* Limites de ritmo                                                    */
/* ------------------------------------------------------------------ */

async function rate(kind: "criar" | "assinar" | "partes" | "escrever", userId: ObjectId) {
  const table = { criar: [30, 60], assinar: [400, 10], partes: [300, 10], escrever: [200, 10] } as const;
  const [limit, minutes] = table[kind];
  const r = await hit(`builds:${kind}:${userId.toHexString()}`, limit, minutes * MINUTE);
  if (!r.allowed) throw new BuildError(429, `Muitos pedidos seguidos. Espere ${waitText(r.retryAfterMs)} e tente de novo.`);
}

/* ------------------------------------------------------------------ */
/* Criar                                                               */
/* ------------------------------------------------------------------ */

export interface CreateInput {
  projectId: ObjectId;
  entry: string;
  engine: WebEngine;
  engineVersion: string | null;
  needsIsolation: boolean;
  width: number | null;
  height: number | null;
  files: BuildFileDoc[];
}

/** Confere e normaliza o corpo do pedido de criação. Lança BuildError(400). */
export function parseCreate(body: unknown): CreateInput {
  const bad = (m: string) => new BuildError(400, m);
  if (!body || typeof body !== "object") throw bad("Pedido inválido.");
  const b = body as Record<string, unknown>;
  const projectId = typeof b.projeto === "string" && /^[a-f0-9]{24}$/i.test(b.projeto) ? new ObjectId(b.projeto) : null;
  if (!projectId) throw bad("Salve o rascunho antes de enviar o build.");
  if (!ENGINES.includes(b.motor as WebEngine)) throw bad("Motor desconhecido.");
  const engineVersion = typeof b.versao === "string" ? b.versao.slice(0, 20) : null;
  const dim = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 64 && v <= 8192 ? v : null);
  if (!Array.isArray(b.arquivos) || b.arquivos.length === 0) throw bad("O build está vazio.");
  if (b.arquivos.length > MAX_WEB_BUILD_FILES) throw bad(`O build passa de ${MAX_WEB_BUILD_FILES.toLocaleString("pt-BR")} arquivos.`);
  const seen = new Set<string>();
  let total = 0;
  const files: BuildFileDoc[] = [];
  for (const item of b.arquivos) {
    if (!Array.isArray(item) || item.length < 2 || item.length > 3) throw bad("Lista de arquivos inválida.");
    const [rawPath, size, enc] = item as [unknown, unknown, unknown];
    const p = typeof rawPath === "string" ? cleanBuildPath(rawPath) : null;
    if (!p || p !== rawPath) throw bad(`Caminho recusado: ${JSON.stringify(String(rawPath).slice(0, 80))}.`);
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0 || size > MAX_WEB_BUILD_BYTES) throw bad(`Tamanho inválido em ${p}.`);
    if (seen.has(p)) throw bad(`Arquivo repetido: ${p}.`);
    seen.add(p);
    total += size;
    const doc: BuildFileDoc = { p, s: size };
    if (enc !== undefined && enc !== null) {
      if ((enc !== "br" && enc !== "gzip") || !/\.unityweb$/i.test(p)) throw bad(`Compressão inválida em ${p}.`);
      doc.e = enc;
    }
    files.push(doc);
  }
  if (total > MAX_WEB_BUILD_BYTES) throw bad(`O build passa do limite de ${formatBytes(MAX_WEB_BUILD_BYTES)}.`);
  const entry = typeof b.entrada === "string" ? cleanBuildPath(b.entrada) : null;
  if (!entry || !seen.has(entry) || !/\.html?$/i.test(entry)) throw bad("Escolha a página HTML que abre o jogo.");
  const needsIsolation = b.isolamento === true;
  if (needsIsolation && !seen.has(dirOf(entry) + COI_FILE)) throw bad("Falta o arquivo de isolamento ao lado da página de entrada.");
  return {
    projectId,
    entry,
    engine: b.motor as WebEngine,
    engineVersion,
    needsIsolation,
    width: dim(b.largura),
    height: dim(b.altura),
    files,
  };
}

export async function createBuild(userId: ObjectId, input: CreateInput) {
  const { projects, builds } = await collections();
  const project = await projects.findOne({ _id: input.projectId, userId, status: { $ne: "excluindo" } }, { projection: { _id: 1 } });
  if (!project) throw new BuildError(404, "Esse rascunho não existe ou não é da sua conta.");
  await rate("criar", userId);
  // Buckets, política pública de GetObject em b/* do jogável e ciclo de vida (src/lib/storage/setup.ts).
  await ensureStorage();

  // Envios abandonados há mais de um dia saem antes de contar limites.
  await sweepStale(userId);

  const [perProject, open] = await Promise.all([
    builds.countDocuments({ userId, projectId: input.projectId, status: { $in: ["enviando", "pronto"] } }),
    builds.countDocuments({ userId, status: "enviando" }),
  ]);
  if (perProject >= MAX_BUILDS_PER_PROJECT) {
    throw new BuildError(409, `Este rascunho já tem ${MAX_BUILDS_PER_PROJECT} builds de navegador. Exclua um antigo para enviar outro.`);
  }
  if (open >= MAX_OPEN_BUILDS) throw new BuildError(409, "Você já tem envios em andamento. Termine ou cancele um antes de começar outro.");

  const total = input.files.reduce((n, f) => n + f.s, 0);
  const quotaMsg = (used: number) =>
    `Não há espaço: a conta usa ${formatBytes(used)} de ${formatBytes(USER_QUOTA_BYTES)} e este build tem ${formatBytes(total)}. Exclua builds ou downloads antigos.`;
  const before = await usageOf(userId);
  if (before + total > USER_QUOTA_BYTES) throw new BuildError(413, quotaMsg(before));

  const publicId = randomBytes(16).toString("hex");
  const now = new Date();
  const _id = new ObjectId();
  const doc: BuildDoc = {
    _id,
    userId,
    projectId: input.projectId,
    sourceUploadId: null,
    bucket: bucket(),
    prefix: `b/${publicId}/`,
    entry: input.entry,
    engine: input.engine,
    needsIsolation: input.needsIsolation,
    fileCount: input.files.length,
    totalSize: total,
    status: "enviando",
    width: input.width,
    height: input.height,
    createdAt: now,
    updatedAt: now,
    publicId,
    files: input.files,
    multipart: [],
    engineVersion: input.engineVersion,
    completedAt: null,
  };
  await builds.insertOne(doc);
  // Conferido de novo depois de gravar: dois envios simultâneos não passam da cota.
  const after = await usageOf(userId);
  if (after > USER_QUOTA_BYTES) {
    await builds.deleteOne({ _id, userId });
    throw new BuildError(413, quotaMsg(after - total));
  }
  return { id: publicId };
}

/* ------------------------------------------------------------------ */
/* Assinar                                                             */
/* ------------------------------------------------------------------ */

async function openBuild(userId: ObjectId, publicId: string) {
  if (!PUBLIC_ID_RE.test(publicId)) throw new BuildError(404, NOT_FOUND);
  const { builds } = await collections();
  const build = await builds.findOne({ publicId, userId });
  if (!build) throw new BuildError(404, NOT_FOUND);
  return build;
}

function requireSending(build: BuildDoc) {
  if (build.status !== "enviando") throw new BuildError(409, "Esse build já foi concluído ou falhou. Envie de novo para trocar os arquivos.");
}

function fileMap(build: BuildDoc) {
  return new Map((build.files ?? []).map((f) => [f.p, f]));
}

/** Cabeçalhos assinados de um arquivo (o navegador precisa mandá-los iguais). */
function signedHeaders(f: BuildFileDoc) {
  const h = headersFor(f.p, f.e ?? null);
  const headers: Record<string, string> = { "content-type": h.contentType, "cache-control": h.cacheControl };
  if (h.contentEncoding) headers["content-encoding"] = h.contentEncoding;
  return headers;
}

/** URLs de PUT para arquivos pequenos (até BUILD_SINGLE_MAX), em lote. */
export async function signFiles(userId: ObjectId, publicId: string, paths: unknown) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > SIGN_BATCH) {
    throw new BuildError(400, `Mande de 1 a ${SIGN_BATCH} caminhos por pedido.`);
  }
  const build = await openBuild(userId, publicId);
  requireSending(build);
  await rate("assinar", userId);
  const map = fileMap(build);
  const out = [];
  for (const raw of paths) {
    const f = typeof raw === "string" ? map.get(raw) : undefined;
    if (!f) throw new BuildError(400, `Arquivo fora da lista declarada: ${JSON.stringify(String(raw).slice(0, 80))}.`);
    if (f.s > BUILD_SINGLE_MAX) throw new BuildError(400, `${f.p} é grande: envie em partes.`);
    const headers = signedHeaders(f);
    // Content-Length entra na assinatura: o MinIO recusa um corpo de outro tamanho.
    const url = presign("PUT", build.bucket, build.prefix + f.p, {
      expires: SINGLE_URL_TTL,
      headers: { ...headers, "content-length": String(f.s) },
    });
    out.push({ caminho: f.p, url, cabecalhos: headers });
  }
  const { builds } = await collections();
  await builds.updateOne({ _id: build._id }, { $set: { updatedAt: new Date() } });
  return out;
}

/* Multipart ---------------------------------------------------------- */

function partPlan(size: number) {
  const count = Math.ceil(size / BUILD_PART_SIZE);
  return Array.from({ length: count }, (_, i) => ({
    n: i + 1,
    size: i === count - 1 ? size - BUILD_PART_SIZE * (count - 1) : BUILD_PART_SIZE,
  }));
}

/** Abre (ou retoma) o multipart de um arquivo grande e assina todas as partes que faltam. */
export async function startMultipart(userId: ObjectId, publicId: string, rawPath: unknown) {
  const build = await openBuild(userId, publicId);
  requireSending(build);
  await rate("partes", userId);
  const f = typeof rawPath === "string" ? fileMap(build).get(rawPath) : undefined;
  if (!f) throw new BuildError(400, "Arquivo fora da lista declarada.");
  if (f.s <= BUILD_SINGLE_MAX) throw new BuildError(400, `${f.p} é pequeno: envie num pedido só.`);
  const key = build.prefix + f.p;
  const { builds } = await collections();

  let uploadId = build.multipart?.find((m) => m.p === f.p)?.id ?? null;
  const done = new Set<number>();
  const plan = partPlan(f.s);
  if (uploadId) {
    try {
      for (const part of await listParts(build.bucket, key, uploadId)) {
        const expected = plan[part.partNumber - 1];
        if (expected && part.size === expected.size) done.add(part.partNumber);
      }
    } catch (err) {
      // Só "o multipart sumiu" (abortado ou expirado) recomeça o arquivo. Uma falha passageira
      // (503, tempo esgotado) sobe como erro: o cliente tenta de novo sem perder as partes enviadas.
      if (!(err instanceof S3Error && err.code === "NoSuchUpload")) throw err;
      await builds.updateOne({ _id: build._id }, { $pull: { multipart: { p: f.p } } });
      uploadId = null;
    }
  }
  if (!uploadId) {
    const created = await createMultipartUpload(build.bucket, key, signedHeaders(f));
    const res = await builds.updateOne(
      { _id: build._id, status: "enviando", "multipart.p": { $ne: f.p } },
      { $push: { multipart: { p: f.p, id: created } }, $set: { updatedAt: new Date() } },
    );
    if (res.matchedCount !== 1) {
      // Outro pedido abriu o mesmo arquivo ao mesmo tempo: fica o dele.
      await abortMultipartUpload(build.bucket, key, created).catch(() => {});
      throw new BuildError(409, "Esse arquivo já está sendo enviado. Tente de novo em instantes.");
    }
    uploadId = created;
  }
  const partes = plan
    .filter((p) => !done.has(p.n))
    .map((p) => ({
      n: p.n,
      tamanho: p.size,
      url: presign("PUT", build.bucket, key, {
        expires: PART_URL_TTL,
        query: { partNumber: String(p.n), uploadId: uploadId! },
        headers: { "content-length": String(p.size) },
      }),
    }));
  return { tamanhoParte: BUILD_PART_SIZE, total: plan.length, feitas: [...done], partes };
}

/**
 * Fecha o multipart de um arquivo. As ETags vêm do próprio MinIO (ListParts),
 * não do navegador: assim o navegador nem precisa ler o cabeçalho ETag.
 */
export async function completeFileMultipart(userId: ObjectId, publicId: string, rawPath: unknown) {
  const build = await openBuild(userId, publicId);
  requireSending(build);
  await rate("partes", userId);
  const f = typeof rawPath === "string" ? fileMap(build).get(rawPath) : undefined;
  if (!f) throw new BuildError(400, "Arquivo fora da lista declarada.");
  const open = build.multipart?.find((m) => m.p === f.p);
  if (!open) throw new BuildError(409, "Esse arquivo não tem envio em partes aberto.");
  const key = build.prefix + f.p;
  const plan = partPlan(f.s);
  const parts = await listParts(build.bucket, key, open.id);
  const byNumber = new Map(parts.map((p) => [p.partNumber, p]));
  const missing = plan.filter((p) => byNumber.get(p.n)?.size !== p.size).map((p) => p.n);
  if (missing.length) throw new BuildError(409, "Faltam partes deste arquivo.", { faltam: missing });
  await completeMultipartUpload(
    build.bucket,
    key,
    open.id,
    plan.map((p) => ({ partNumber: p.n, etag: byNumber.get(p.n)!.etag })),
  );
  const { builds } = await collections();
  await builds.updateOne({ _id: build._id }, { $pull: { multipart: { p: f.p } }, $set: { updatedAt: new Date() } });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Concluir                                                            */
/* ------------------------------------------------------------------ */

export async function finishBuild(userId: ObjectId, publicId: string) {
  const build = await openBuild(userId, publicId);
  if (build.status === "pronto") return summary(build);
  requireSending(build);
  await rate("escrever", userId);
  const { builds } = await collections();

  const listed = await listKeys(build.bucket, build.prefix);
  const real = new Map(listed.map((o) => [o.key.slice(build.prefix.length), o.size]));
  const declared = build.files ?? [];
  const missing = declared.filter((f) => real.get(f.p) !== f.s).map((f) => f.p);
  if (missing.length) {
    throw new BuildError(409, `Faltam ${missing.length} arquivo(s) no armazenamento.`, { faltam: missing.slice(0, 1000) });
  }
  const declaredSet = new Set(declared.map((f) => f.p));
  const extra = listed.filter((o) => !declaredSet.has(o.key.slice(build.prefix.length))).map((o) => o.key);
  if (extra.length) await deleteObjects(build.bucket, extra);
  for (const m of build.multipart ?? []) await abortMultipartUpload(build.bucket, build.prefix + m.p, m.id).catch(() => {});

  const total = declared.reduce((n, f) => n + (real.get(f.p) ?? 0), 0);
  // A cota conta o tamanho declarado deste build; troca pelo real (iguais: o Content-Length é assinado).
  const others = (await usageOf(userId)) - build.totalSize;
  if (others + total > USER_QUOTA_BYTES) {
    await purge(build);
    throw new BuildError(413, `O build passou do espaço da conta (${formatBytes(USER_QUOTA_BYTES)}) e foi apagado.`);
  }
  const now = new Date();
  const res = await builds.findOneAndUpdate(
    { _id: build._id, userId, status: "enviando" },
    { $set: { status: "pronto", totalSize: total, fileCount: declared.length, updatedAt: now, completedAt: now, multipart: [] } },
    { returnDocument: "after", projection: { files: 0 } },
  );
  if (!res) throw new BuildError(409, "O build mudou durante a conclusão. Atualize a página.");
  return summary(res);
}

/* ------------------------------------------------------------------ */
/* Listar, excluir, limpar                                             */
/* ------------------------------------------------------------------ */

export function summary(b: BuildDoc) {
  return {
    id: b.publicId!,
    motor: b.engine,
    versao: b.engineVersion ?? null,
    entrada: b.entry,
    isolamento: b.needsIsolation,
    arquivos: b.fileCount,
    tamanho: b.totalSize,
    estado: b.status,
    largura: b.width,
    altura: b.height,
    criadoEm: b.createdAt.toISOString(),
    concluidoEm: b.completedAt ? b.completedAt.toISOString() : null,
  };
}
export type BuildSummary = ReturnType<typeof summary>;

export async function listBuilds(userId: ObjectId, projectId: ObjectId): Promise<BuildSummary[]> {
  const { builds } = await collections();
  await sweepStale(userId);
  const docs = await builds
    .find({ userId, projectId, publicId: { $type: "string" } }, { projection: { files: 0, multipart: 0 } })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  return docs.map(summary);
}

export async function deleteBuild(userId: ObjectId, publicId: string) {
  const build = await openBuild(userId, publicId);
  await rate("escrever", userId);
  await purge(build);
  return { ok: true };
}

/**
 * Apaga os objetos de um build e depois o registro. purgePrefix aborta os
 * multipart abertos e remove todas as versões e marcadores sob b/<id>/.
 */
export async function purge(build: Pick<BuildDoc, "_id" | "bucket" | "prefix"> & Pick<Partial<BuildDoc>, "multipart">) {
  if (!/^b\/[a-f0-9]{32}\/$/.test(build.prefix)) throw new Error(`prefixo inesperado: ${build.prefix}`);
  // Os multiparts abertos são abortados pelo id que guardamos: listar por prefixo de pasta
  // não é confiável no MinIO (ele lista por nome de objeto), e partes órfãs ocupariam espaço.
  for (const m of build.multipart ?? []) {
    await abortMultipartUpload(build.bucket, build.prefix + m.p, m.id).catch(() => {});
  }
  await purgePrefix(build.bucket, build.prefix);
  const { builds } = await collections();
  await builds.deleteOne({ _id: build._id });
}

/** Envios parados há mais de um dia: apaga objetos e registro. */
async function sweepStale(userId: ObjectId) {
  const { builds } = await collections();
  const stale = await builds
    .find({ userId, status: "enviando", updatedAt: { $lt: new Date(Date.now() - STALE_UPLOAD_MS) } }, { projection: { _id: 1, bucket: 1, prefix: 1, multipart: 1 } })
    .limit(5)
    .toArray();
  for (const b of stale) await purge(b).catch((err) => console.error("[builds] limpeza", err));
}

/** Build pronto para a página de jogar (sem a lista de arquivos). */
export async function buildForPlay(publicId: string) {
  if (!PUBLIC_ID_RE.test(publicId)) return null;
  const { builds, projects } = await collections();
  const build = await builds.findOne({ publicId }, { projection: { files: 0, multipart: 0 } });
  if (!build) return null;
  const project = await projects.findOne({ _id: build.projectId, userId: build.userId }, { projection: { title: 1, userId: 1, status: 1, track: 1, publicSlug: 1 } });
  return { build, project };
}

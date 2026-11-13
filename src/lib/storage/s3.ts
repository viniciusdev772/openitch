import "server-only";
import { createHash, createHmac } from "node:crypto";

/*
 * Cliente S3 próprio (AWS Signature Version 4) para o MinIO, sem bibliotecas
 * de terceiros. Path-style (endpoint/bucket/key), que é o que o MinIO usa.
 *
 * Ambiente:
 *   S3_ENDPOINT      URL pública HTTPS do MinIO (API S3), ex.: https://minio.exemplo.com
 *   S3_ACCESS_KEY    chave de acesso (de preferência um usuário de serviço, não o root)
 *   S3_SECRET_KEY    segredo
 *   S3_REGION        opcional, padrão us-east-1
 *   S3_BUCKET_FILES  opcional, padrão vibegames-files (privado: downloads e zips originais)
 *   S3_BUCKET_PLAY   opcional, padrão vibegames-play  (leitura pública: builds jogáveis extraídos)
 */

export interface S3Config {
  endpoint: URL;
  /** Caminho base do endpoint sem barra no fim ("" na raiz). URL.pathname nunca fica vazio. */
  basePath: string;
  accessKey: string;
  secretKey: string;
  region: string;
  buckets: { files: string; play: string };
}

let cached: S3Config | null = null;
export function s3Config(): S3Config {
  if (cached) return cached;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error("Armazenamento não configurado: defina S3_ENDPOINT, S3_ACCESS_KEY e S3_SECRET_KEY (veja .env.example).");
  }
  const url = new URL(endpoint);
  cached = {
    endpoint: url,
    basePath: url.pathname.replace(/\/+$/, ""),
    accessKey,
    secretKey,
    region: process.env.S3_REGION || "us-east-1",
    buckets: {
      files: process.env.S3_BUCKET_FILES || "vibegames-files",
      play: process.env.S3_BUCKET_PLAY || "vibegames-play",
    },
  };
  return cached;
}

export function storageConfigured(): boolean {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

/* ------------------------------------------------------------------ */
/* SigV4                                                               */
/* ------------------------------------------------------------------ */

const UNSIGNED = "UNSIGNED-PAYLOAD";
const sha256hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** RFC 3986: tudo codificado, menos A-Z a-z 0-9 - _ . ~ (e "/" no caminho). */
function enc(s: string, keepSlash = false): string {
  const out = encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return keepSlash ? out.replace(/%2F/g, "/") : out;
}

function amzDate(d = new Date()) {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { stamp: iso, day: iso.slice(0, 8) };
}

function signingKey(secret: string, day: string, region: string) {
  const kDate = hmac("AWS4" + secret, day);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function objectPath(bucket: string, key?: string) {
  const { basePath } = s3Config();
  return `${basePath}/${enc(bucket)}${key !== undefined ? "/" + enc(key, true) : ""}`;
}

function canonicalQuery(q: Record<string, string>) {
  return Object.keys(q)
    .sort()
    .map((k) => `${enc(k)}=${enc(q[k])}`)
    .join("&");
}

function canonicalHeaders(h: Record<string, string>) {
  const keys = Object.keys(h)
    .map((k) => k.toLowerCase())
    .sort();
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) lower[k.toLowerCase()] = String(v).trim().replace(/\s+/g, " ");
  return {
    canonical: keys.map((k) => `${k}:${lower[k]}\n`).join(""),
    signed: keys.join(";"),
  };
}

/**
 * URL pré-assinada (query string). `headers` são os cabeçalhos que o cliente
 * PRECISA mandar exatamente assim (entram na assinatura), ex.: content-type.
 */
export function presign(
  method: "GET" | "PUT" | "HEAD" | "DELETE" | "POST",
  bucket: string,
  key: string,
  opts: { expires?: number; query?: Record<string, string>; headers?: Record<string, string> } = {},
): string {
  const cfg = s3Config();
  const { stamp, day } = amzDate();
  const scope = `${day}/${cfg.region}/s3/aws4_request`;
  const headers = { host: cfg.endpoint.host, ...(opts.headers ?? {}) };
  const { canonical, signed } = canonicalHeaders(headers);
  const query: Record<string, string> = {
    ...(opts.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKey}/${scope}`,
    "X-Amz-Date": stamp,
    "X-Amz-Expires": String(Math.min(Math.max(opts.expires ?? 900, 1), 604800)),
    "X-Amz-SignedHeaders": signed,
  };
  const path = objectPath(bucket, key);
  const creq = [method, path, canonicalQuery(query), canonical, signed, UNSIGNED].join("\n");
  const sts = ["AWS4-HMAC-SHA256", stamp, scope, sha256hex(creq)].join("\n");
  const sig = createHmac("sha256", signingKey(cfg.secretKey, day, cfg.region)).update(sts).digest("hex");
  return `${cfg.endpoint.origin}${path}?${canonicalQuery(query)}&X-Amz-Signature=${sig}`;
}

/** Requisição assinada no cabeçalho Authorization, feita pelo servidor. */
export async function s3Fetch(
  method: "GET" | "PUT" | "POST" | "DELETE" | "HEAD",
  bucket: string,
  key: string | undefined,
  opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: string | Uint8Array } = {},
): Promise<Response> {
  const cfg = s3Config();
  const { stamp, day } = amzDate();
  const scope = `${day}/${cfg.region}/s3/aws4_request`;
  const body = opts.body ?? "";
  const payloadHash = sha256hex(body);
  const headers: Record<string, string> = {
    host: cfg.endpoint.host,
    "x-amz-date": stamp,
    "x-amz-content-sha256": payloadHash,
    ...(opts.headers ?? {}),
  };
  if (body.length && !Object.keys(headers).some((k) => k.toLowerCase() === "content-md5")) {
    headers["content-md5"] = createHash("md5").update(body).digest("base64");
  }
  const { canonical, signed } = canonicalHeaders(headers);
  const query = opts.query ?? {};
  const path = objectPath(bucket, key);
  const creq = [method, path, canonicalQuery(query), canonical, signed, payloadHash].join("\n");
  const sts = ["AWS4-HMAC-SHA256", stamp, scope, sha256hex(creq)].join("\n");
  const sig = createHmac("sha256", signingKey(cfg.secretKey, day, cfg.region)).update(sts).digest("hex");
  const qs = canonicalQuery(query);
  const { host: _host, ...sendHeaders } = headers;
  void _host;
  return fetch(`${cfg.endpoint.origin}${path}${qs ? "?" + qs : ""}`, {
    method,
    headers: {
      ...sendHeaders,
      authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${sig}`,
    },
    body: method === "GET" || method === "HEAD" || !body.length ? undefined : typeof body === "string" ? body : Buffer.from(body),
    cache: "no-store",
  });
}

export class S3Error extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(`S3 ${status} ${code}: ${message}`);
    this.status = status;
    this.code = code;
  }
}

async function ok(res: Response): Promise<string> {
  const text = await res.text();
  if (!res.ok) throw new S3Error(res.status, xmlTag(text, "Code") ?? "Unknown", xmlTag(text, "Message") ?? text.slice(0, 200));
  return text;
}

/* ------------------------------------------------------------------ */
/* XML mínimo                                                          */
/* ------------------------------------------------------------------ */

export function xmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? xmlDecode(m[1]) : null;
}
export function xmlAll(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
}
const xmlDecode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
export const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/* ------------------------------------------------------------------ */
/* Operações                                                           */
/* ------------------------------------------------------------------ */

export async function listBuckets(): Promise<string[]> {
  const cfg = s3Config();
  // ListBuckets é GET na raiz: sem bucket no caminho.
  const { stamp, day } = amzDate();
  const scope = `${day}/${cfg.region}/s3/aws4_request`;
  const payloadHash = sha256hex("");
  const headers = { host: cfg.endpoint.host, "x-amz-date": stamp, "x-amz-content-sha256": payloadHash };
  const { canonical, signed } = canonicalHeaders(headers);
  const path = cfg.basePath || "/";
  const creq = ["GET", path, "", canonical, signed, payloadHash].join("\n");
  const sts = ["AWS4-HMAC-SHA256", stamp, scope, sha256hex(creq)].join("\n");
  const sig = createHmac("sha256", signingKey(cfg.secretKey, day, cfg.region)).update(sts).digest("hex");
  const res = await fetch(`${cfg.endpoint.origin}${path}`, {
    headers: {
      "x-amz-date": stamp,
      "x-amz-content-sha256": payloadHash,
      authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${sig}`,
    },
    cache: "no-store",
  });
  return xmlAll(await ok(res), "Name");
}

export async function headObject(bucket: string, key: string) {
  const res = await s3Fetch("HEAD", bucket, key);
  if (res.status === 404) return null;
  if (!res.ok) throw new S3Error(res.status, "HeadFailed", key);
  return {
    size: Number(res.headers.get("content-length") ?? 0),
    etag: res.headers.get("etag"),
    contentType: res.headers.get("content-type"),
  };
}

export async function deleteObject(bucket: string, key: string) {
  const res = await s3Fetch("DELETE", bucket, key);
  if (!res.ok && res.status !== 404) await ok(res);
}

/** Apaga até 1000 chaves por chamada (DeleteObjects). */
export async function deleteObjects(bucket: string, keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    const body =
      `<Delete><Quiet>true</Quiet>` + chunk.map((k) => `<Object><Key>${xmlEscape(k)}</Key></Object>`).join("") + `</Delete>`;
    await ok(await s3Fetch("POST", bucket, undefined, { query: { delete: "" }, body, headers: { "content-type": "application/xml" } }));
  }
}

/** Lista chaves sob um prefixo (ListObjectsV2, paginado). */
export async function listKeys(bucket: string, prefix: string): Promise<{ key: string; size: number }[]> {
  const out: { key: string; size: number }[] = [];
  let token: string | undefined;
  do {
    const query: Record<string, string> = { "list-type": "2", prefix, "max-keys": "1000" };
    if (token) query["continuation-token"] = token;
    const xml = await ok(await s3Fetch("GET", bucket, undefined, { query }));
    for (const c of xmlAll(xml, "Contents")) out.push({ key: xmlTag(c, "Key") ?? "", size: Number(xmlTag(c, "Size") ?? 0) });
    token = xmlTag(xml, "IsTruncated") === "true" ? (xmlTag(xml, "NextContinuationToken") ?? undefined) : undefined;
  } while (token);
  return out;
}

/* Multipart ---------------------------------------------------------- */

export async function createMultipartUpload(
  bucket: string,
  key: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const xml = await ok(await s3Fetch("POST", bucket, key, { query: { uploads: "" }, headers }));
  const id = xmlTag(xml, "UploadId");
  if (!id) throw new S3Error(500, "NoUploadId", key);
  return id;
}

/** URL pré-assinada para enviar uma parte (1..10000) direto do navegador. */
export function presignUploadPart(bucket: string, key: string, uploadId: string, partNumber: number, expires = 3600) {
  return presign("PUT", bucket, key, { expires, query: { partNumber: String(partNumber), uploadId } });
}

export async function listParts(bucket: string, key: string, uploadId: string) {
  const parts: { partNumber: number; etag: string; size: number; checksumSHA256?: string }[] = [];
  let marker: string | undefined;
  do {
    const query: Record<string, string> = { uploadId, "max-parts": "1000" };
    if (marker) query["part-number-marker"] = marker;
    const xml = await ok(await s3Fetch("GET", bucket, key, { query }));
    for (const p of xmlAll(xml, "Part")) {
      parts.push({
        partNumber: Number(xmlTag(p, "PartNumber")),
        etag: xmlTag(p, "ETag") ?? "",
        size: Number(xmlTag(p, "Size") ?? 0),
        ...(xmlTag(p, "ChecksumSHA256") ? { checksumSHA256: xmlTag(p, "ChecksumSHA256") as string } : {}),
      });
    }
    marker = xmlTag(xml, "IsTruncated") === "true" ? (xmlTag(xml, "NextPartNumberMarker") ?? undefined) : undefined;
  } while (marker);
  return parts;
}

export async function completeMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string; checksumSHA256?: string }[],
) {
  const body =
    `<CompleteMultipartUpload>` +
    [...parts]
      .sort((a, b) => a.partNumber - b.partNumber)
      .map(
        (p) =>
          `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${xmlEscape(p.etag)}</ETag>` +
          (p.checksumSHA256 ? `<ChecksumSHA256>${xmlEscape(p.checksumSHA256)}</ChecksumSHA256>` : "") +
          `</Part>`,
      )
      .join("") +
    `</CompleteMultipartUpload>`;
  const xml = await ok(await s3Fetch("POST", bucket, key, { query: { uploadId }, body, headers: { "content-type": "application/xml" } }));
  // O S3 pode responder 200 com <Error> no corpo.
  if (xml.includes("<Error>")) throw new S3Error(500, xmlTag(xml, "Code") ?? "CompleteFailed", xmlTag(xml, "Message") ?? "");
  return { etag: xmlTag(xml, "ETag") };
}

export async function abortMultipartUpload(bucket: string, key: string, uploadId: string) {
  const res = await s3Fetch("DELETE", bucket, key, { query: { uploadId } });
  if (!res.ok && res.status !== 404) await ok(res);
}

/**
 * URL de uma parte com o tamanho exato e (opcional) o SHA-256 da parte
 * assinados. O navegador manda Content-Length sozinho; se o corpo tiver outro
 * tamanho, a assinatura não confere e o MinIO recusa (403). Com o checksum
 * assinado, o MinIO recalcula o SHA-256 e recusa a parte corrompida (400).
 */
export function presignUploadPartChecked(
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  opts: { contentLength: number; sha256?: string | null; expires?: number },
) {
  const headers: Record<string, string> = { "content-length": String(opts.contentLength) };
  if (opts.sha256) headers["x-amz-checksum-sha256"] = opts.sha256;
  return presign("PUT", bucket, key, { expires: opts.expires ?? 3600, query: { partNumber: String(partNumber), uploadId }, headers });
}

/** Uploads multipart abertos sob um prefixo (ListMultipartUploads, paginado). */
export async function listMultipartUploads(bucket: string, prefix: string) {
  const out: { key: string; uploadId: string; initiated: Date | null }[] = [];
  let keyMarker: string | undefined;
  let idMarker: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const query: Record<string, string> = { uploads: "", prefix, "max-uploads": "1000" };
    if (keyMarker) query["key-marker"] = keyMarker;
    if (idMarker) query["upload-id-marker"] = idMarker;
    const xml = await ok(await s3Fetch("GET", bucket, undefined, { query }));
    for (const u of xmlAll(xml, "Upload")) {
      const initiated = xmlTag(u, "Initiated");
      out.push({ key: xmlTag(u, "Key") ?? "", uploadId: xmlTag(u, "UploadId") ?? "", initiated: initiated ? new Date(initiated) : null });
    }
    if (xmlTag(xml, "IsTruncated") !== "true") break;
    keyMarker = xmlTag(xml, "NextKeyMarker") ?? undefined;
    idMarker = xmlTag(xml, "NextUploadIdMarker") ?? undefined;
    if (!keyMarker) break;
  }
  return out;
}

/** Todas as versões e marcadores de exclusão sob um prefixo (ListObjectVersions). */
export async function listObjectVersions(bucket: string, prefix: string) {
  const out: { key: string; versionId: string; size: number; deleteMarker: boolean }[] = [];
  let keyMarker: string | undefined;
  let idMarker: string | undefined;
  for (let page = 0; page < 10_000; page++) {
    const query: Record<string, string> = { versions: "", prefix, "max-keys": "1000" };
    if (keyMarker) query["key-marker"] = keyMarker;
    if (idMarker) query["version-id-marker"] = idMarker;
    const xml = await ok(await s3Fetch("GET", bucket, undefined, { query }));
    for (const v of xmlAll(xml, "Version")) {
      out.push({ key: xmlTag(v, "Key") ?? "", versionId: xmlTag(v, "VersionId") ?? "null", size: Number(xmlTag(v, "Size") ?? 0), deleteMarker: false });
    }
    for (const v of xmlAll(xml, "DeleteMarker")) {
      out.push({ key: xmlTag(v, "Key") ?? "", versionId: xmlTag(v, "VersionId") ?? "null", size: 0, deleteMarker: true });
    }
    if (xmlTag(xml, "IsTruncated") !== "true") break;
    keyMarker = xmlTag(xml, "NextKeyMarker") ?? undefined;
    idMarker = xmlTag(xml, "NextVersionIdMarker") ?? undefined;
    if (!keyMarker) break;
  }
  return out;
}

/**
 * Apaga versões específicas (DeleteObjects com VersionId), até 1000 por
 * chamada. Objetos gravados antes do versionamento têm VersionId "null", que
 * precisa ir explícito: sem ele o MinIO só cria um marcador de exclusão.
 */
export async function deleteObjectVersions(bucket: string, items: { key: string; versionId: string }[]) {
  for (let i = 0; i < items.length; i += 1000) {
    const chunk = items.slice(i, i + 1000);
    const body =
      `<Delete><Quiet>true</Quiet>` +
      chunk.map((o) => `<Object><Key>${xmlEscape(o.key)}</Key><VersionId>${xmlEscape(o.versionId)}</VersionId></Object>`).join("") +
      `</Delete>`;
    const xml = await ok(await s3Fetch("POST", bucket, undefined, { query: { delete: "" }, body, headers: { "content-type": "application/xml" } }));
    const errors = xmlAll(xml, "Error");
    if (errors.length) throw new S3Error(500, xmlTag(errors[0], "Code") ?? "DeleteFailed", xmlTag(errors[0], "Key") ?? "");
  }
}

/**
 * Apaga de vez tudo sob um prefixo: aborta uploads multipart abertos e
 * remove todas as versões e marcadores (nada fica para o versionamento
 * recuperar). Recusa prefixo vazio ou sem "/" no fim, para nunca apagar um
 * bucket inteiro por engano.
 */
export async function purgePrefix(bucket: string, prefix: string): Promise<{ objects: number; uploads: number }> {
  if (!prefix || !prefix.endsWith("/") || prefix.startsWith("/") || prefix.split("/").some((seg, i, a) => (seg === "" && i < a.length - 1) || seg === "." || seg === "..")) {
    throw new Error(`purgePrefix: prefixo recusado (${JSON.stringify(prefix)})`);
  }
  let uploads = 0;
  for (const u of await listMultipartUploads(bucket, prefix)) {
    await abortMultipartUpload(bucket, u.key, u.uploadId);
    uploads++;
  }
  let objects = 0;
  // Uma volta normalmente basta; repete se algo foi gravado no meio.
  for (let round = 0; round < 5; round++) {
    const versions = await listObjectVersions(bucket, prefix);
    if (!versions.length) break;
    await deleteObjectVersions(bucket, versions);
    objects += versions.filter((v) => !v.deleteMarker).length;
  }
  return { objects, uploads };
}

/* Configuração de bucket --------------------------------------------- */

export async function ensureBucket(bucket: string) {
  const res = await s3Fetch("HEAD", bucket, undefined);
  if (res.ok) return false;
  await ok(await s3Fetch("PUT", bucket, undefined));
  return true;
}

export async function putBucketPolicy(bucket: string, policy: object) {
  await ok(await s3Fetch("PUT", bucket, undefined, { query: { policy: "" }, body: JSON.stringify(policy), headers: { "content-type": "application/json" } }));
}

export async function putBucketVersioning(bucket: string, enabled: boolean) {
  const body = `<VersioningConfiguration><Status>${enabled ? "Enabled" : "Suspended"}</Status></VersioningConfiguration>`;
  await ok(await s3Fetch("PUT", bucket, undefined, { query: { versioning: "" }, body, headers: { "content-type": "application/xml" } }));
}

export async function putBucketLifecycle(bucket: string, xmlRules: string) {
  const body = `<LifecycleConfiguration>${xmlRules}</LifecycleConfiguration>`;
  await ok(await s3Fetch("PUT", bucket, undefined, { query: { lifecycle: "" }, body, headers: { "content-type": "application/xml" } }));
}

/** CORS por bucket (MinIO AIStor e versões recentes). Devolve false se o servidor não suporta. */
export async function putBucketCors(bucket: string, xmlRules: string): Promise<boolean> {
  const body = `<CORSConfiguration>${xmlRules}</CORSConfiguration>`;
  const res = await s3Fetch("PUT", bucket, undefined, { query: { cors: "" }, body, headers: { "content-type": "application/xml" } });
  if (res.ok) return true;
  const text = await res.text();
  if (res.status === 501 || /NotImplemented/.test(text)) return false;
  throw new S3Error(res.status, xmlTag(text, "Code") ?? "Unknown", xmlTag(text, "Message") ?? text.slice(0, 200));
}

/** Criptografia padrão SSE-S3 no bucket. Devolve false se o servidor não tem KMS configurado. */
export async function putBucketEncryption(bucket: string): Promise<boolean> {
  const body =
    `<ServerSideEncryptionConfiguration><Rule><ApplyServerSideEncryptionByDefault><SSEAlgorithm>AES256</SSEAlgorithm></ApplyServerSideEncryptionByDefault></Rule></ServerSideEncryptionConfiguration>`;
  const res = await s3Fetch("PUT", bucket, undefined, { query: { encryption: "" }, body, headers: { "content-type": "application/xml" } });
  if (res.ok) return true;
  await res.text();
  return false;
}

export async function putObjectTagging(bucket: string, key: string, tags: Record<string, string>) {
  const body =
    `<Tagging><TagSet>` +
    Object.entries(tags)
      .map(([k, v]) => `<Tag><Key>${xmlEscape(k)}</Key><Value>${xmlEscape(v)}</Value></Tag>`)
      .join("") +
    `</TagSet></Tagging>`;
  await ok(await s3Fetch("PUT", bucket, key, { query: { tagging: "" }, body, headers: { "content-type": "application/xml" } }));
}

/** Download direto do MinIO, com nome de arquivo, sem passar bytes pela Vercel. */
export function presignDownload(bucket: string, key: string, filename: string, expires = 600) {
  const safe = filename.replace(/[^\w.\- ]+/g, "_");
  return presign("GET", bucket, key, {
    expires,
    query: { "response-content-disposition": `attachment; filename="${safe}"; filename*=UTF-8''${enc(filename)}` },
  });
}

/**
 * URL pública de um objeto do bucket jogável (leitura anônima por política).
 * Com S3_PLAY_PUBLIC_URL (outro domínio apontando para o mesmo MinIO), os jogos
 * rodam numa origem separada da API S3, longe dos outros buckets do servidor.
 */
export function publicUrl(bucket: string, key: string) {
  const cfg = s3Config();
  const play = process.env.S3_PLAY_PUBLIC_URL;
  if (play) {
    const u = new URL(play);
    const base = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${base}/${enc(bucket)}/${enc(key, true)}`;
  }
  return `${cfg.endpoint.origin}${objectPath(bucket, key)}`;
}

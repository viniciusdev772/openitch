import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream, openAsBlob } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  ensureBucket,
  headObject,
  publicUrl,
  s3Config,
  s3Fetch,
} from "@/lib/storage/s3";
import { AUTO_JS, BOXEDWINE64, pageFrom, urlOf64 } from "./exe64";
import { CACHE_IMMUTABLE } from "./mime";

/*
 * Instala o Boxedwine64 no bucket jogável, uma vez por versão (exe64.ts). Cada
 * arquivo vem do site publicado do projeto, é conferido (tamanho e SHA-256) e
 * gravado em BOXEDWINE64.dir com cache imutável. Os dois arquivos nossos
 * (__vg_auto.js e a página jogar.html) são gerados aqui.
 *
 * ~240 MB no total: cada chamada envia o que couber em INSTALL_BUDGET_MS e diz
 * quantos faltam; quem chama (POST /api/jogar-exe/instalar?motor=64) repete até
 * terminar. Arquivos grandes vão para um temporário (hash calculado enquanto
 * grava) e sobem em partes de 5 MiB lidas de lá.
 */

// ponytail: ~240 MB passam pela Vercel uma vez por versão do Boxedwine64; se pesar, rode a instalação fora dela.

const PART = 5 * 1024 * 1024;
const INSTALL_BUDGET_MS = 180_000;
const LOCK_ID = `instalar-boxedwine64-${BOXEDWINE64.version}`;
const LOCK_MS = 6 * 60 * 1000;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".zip": "application/zip",
};
const typeOf = (name: string) => TYPES[name.slice(name.lastIndexOf("."))] ?? "application/octet-stream";

const AUTO = new TextEncoder().encode(AUTO_JS);

/** O que precisa estar no bucket: os arquivos do projeto e os nossos dois. */
type Item = { name: string; size: number | null };
const items = (): Item[] => [...BOXEDWINE64.files.map((f) => ({ name: f.name, size: f.size as number })), { name: "__vg_auto.js", size: AUTO.length }, { name: BOXEDWINE64.page, size: null }];

export async function missing64(): Promise<string[]> {
  const { buckets } = s3Config();
  const list = items();
  const heads = await Promise.all(list.map((i) => headObject(buckets.play, BOXEDWINE64.dir + i.name)));
  return list.filter((i, n) => !heads[n] || (i.size !== null && heads[n]!.size !== i.size)).map((i) => i.name);
}

export const page64Url = () => publicUrl(s3Config().buckets.play, BOXEDWINE64.dir + BOXEDWINE64.page);

async function put(key: string, body: Uint8Array, name: string) {
  const { buckets } = s3Config();
  const res = await s3Fetch("PUT", buckets.play, key, { body, headers: { "content-type": typeOf(name), "cache-control": CACHE_IMMUTABLE } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${key}: ${res.status} ${text.slice(0, 200)}`);
}

/** Baixa um arquivo do projeto conferindo tamanho e SHA-256; pequenos voltam em memória, grandes ficam num temporário. */
async function download(name: string): Promise<{ bytes?: Uint8Array; file?: string }> {
  const f = BOXEDWINE64.files.find((x) => x.name === name)!;
  const res = await fetch(urlOf64(name), { cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`O Boxedwine64 respondeu ${res.status} para ${name}.`);
  const hash = createHash("sha256");
  if (f.size <= PART) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    hash.update(bytes);
    check(name, bytes.length, hash.digest("hex"));
    return { bytes };
  }
  const file = join(tmpdir(), `bw64-${randomBytes(6).toString("hex")}-${name}`);
  let size = 0;
  await pipeline(
    Readable.fromWeb(res.body as NodeReadableStream<Uint8Array>),
    new Transform({
      transform(chunk: Buffer, _e, cb) {
        hash.update(chunk);
        size += chunk.length;
        cb(null, chunk);
      },
    }),
    createWriteStream(file),
  );
  try {
    check(name, size, hash.digest("hex"));
  } catch (err) {
    await rm(file, { force: true });
    throw err;
  }
  return { file };
}

function check(name: string, size: number, sha: string) {
  const f = BOXEDWINE64.files.find((x) => x.name === name)!;
  if (size !== f.size || sha !== f.sha256) {
    throw new Error(`${name} do Boxedwine64 mudou (${size} bytes, ${sha.slice(0, 12)}…). Atualize a versão fixada em exe64.ts.`);
  }
}

async function uploadFile(key: string, file: string, name: string) {
  const { buckets } = s3Config();
  const blob = (await openAsBlob(file)) as unknown as Blob;
  const uploadId = await createMultipartUpload(buckets.play, key, { "content-type": typeOf(name), "cache-control": CACHE_IMMUTABLE });
  const parts: { partNumber: number; etag: string }[] = [];
  try {
    for (let off = 0; off < blob.size; off += PART) {
      const partNumber = parts.length + 1;
      const body = new Uint8Array(await blob.slice(off, off + PART).arrayBuffer());
      const res = await s3Fetch("PUT", buckets.play, key, { query: { partNumber: String(partNumber), uploadId }, body });
      const text = await res.text();
      if (!res.ok) throw new Error(`${key}, parte ${partNumber}: ${res.status} ${text.slice(0, 200)}`);
      parts.push({ partNumber, etag: res.headers.get("etag") ?? "" });
    }
    await completeMultipartUpload(buckets.play, key, uploadId, parts);
  } catch (err) {
    await abortMultipartUpload(buckets.play, key, uploadId).catch(() => {});
    throw err;
  }
}

/** Envia o que falta até o orçamento de tempo. Devolve quantos arquivos ainda faltam. */
async function installSome(): Promise<number> {
  const { buckets } = s3Config();
  await ensureBucket(buckets.play);
  const started = Date.now();
  const missing = await missing64();
  for (const name of missing) {
    if (Date.now() - started > INSTALL_BUDGET_MS) break;
    const key = BOXEDWINE64.dir + name;
    if (name === "__vg_auto.js") {
      await put(key, AUTO, name);
    } else if (name === BOXEDWINE64.page) {
      const { bytes } = await download("wine64.html");
      await put(key, new TextEncoder().encode(pageFrom(new TextDecoder().decode(bytes!))), name);
    } else {
      const got = await download(name);
      try {
        if (got.bytes) await put(key, got.bytes, name);
        else await uploadFile(key, got.file!, name);
      } finally {
        if (got.file) await rm(got.file, { force: true });
      }
    }
    console.log("[boxedwine64]", key, "instalado");
  }
  return (await missing64()).length;
}

/**
 * Instala um pedaço do Boxedwine64, com trava no Mongo (coleção meta) para não
 * rodar duas instalações ao mesmo tempo. "pronto" quando não falta nada.
 */
export async function install64(): Promise<{ estado: "pronto" } | { estado: "instalando"; faltam: number | null }> {
  if ((await missing64()).length === 0) return { estado: "pronto" };
  const { db } = await import("@/lib/auth/db");
  const { meta } = await db();
  const now = new Date();
  try {
    const got = await meta.findOneAndUpdate(
      { _id: LOCK_ID, $or: [{ until: { $exists: false } }, { until: { $lt: now } }] },
      { $set: { until: new Date(now.getTime() + LOCK_MS) } },
      { upsert: true, returnDocument: "after" },
    );
    if (!got) return { estado: "instalando", faltam: null };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { estado: "instalando", faltam: null };
    throw err;
  }
  try {
    const faltam = await installSome();
    return faltam === 0 ? { estado: "pronto" } : { estado: "instalando", faltam };
  } finally {
    await meta.updateOne({ _id: LOCK_ID }, { $set: { until: new Date(0) } });
  }
}

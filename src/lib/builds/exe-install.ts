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
  s3Config,
  s3Fetch,
} from "@/lib/storage/s3";
import { BOXEDWINE } from "./exe";
import { CACHE_IMMUTABLE } from "./mime";
import { chunkStream, entryBlob, openEntry, readZip } from "./zip";

/*
 * Instala o Boxedwine no bucket jogável, uma vez por versão: baixa o zip
 * oficial da release fixada em exe.ts, confere o SHA-256, tira os quatro
 * arquivos de SingleThreaded/ e grava cada um em BOXEDWINE.dir com cache
 * imutável. Quem chama: a rota POST /api/jogar-exe/instalar (o próprio site,
 * na primeira partida) e, como alternativa, scripts/enviar-boxedwine.ts.
 *
 * Memória: o zip (~122 MB) vai para um arquivo temporário (calculando o hash
 * enquanto grava) e é lido de lá por openAsBlob, sem ficar na memória; cada
 * arquivo grande sobe descompactado em partes de 5 MiB direto do fluxo
 * (zip.ts confere tamanho e CRC no fim, e o envio é abortado se não conferir).
 */

// ponytail: único caminho em que bytes grandes passam pela Vercel (~122 MB de download do GitHub e ~40 MB enviados ao MinIO), uma vez por versão do Boxedwine; se pesar, rode scripts/enviar-boxedwine.ts fora da Vercel.

const PART = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".zip": "application/zip",
};
const LOCK_ID = `instalar-boxedwine-${BOXEDWINE.version}`;
const LOCK_MS = 10 * 60 * 1000;

/** Nomes dos arquivos do Boxedwine que faltam no bucket (ou estão com tamanho errado). */
export async function missingRuntimeFiles(): Promise<string[]> {
  const { buckets } = s3Config();
  const heads = await Promise.all(BOXEDWINE.files.map((f) => headObject(buckets.play, BOXEDWINE.dir + f.name)));
  return BOXEDWINE.files.filter((f, i) => heads[i]?.size !== f.size).map((f) => f.name);
}

/** Baixa a release e envia o que falta. Sem trava: quem chama garante que roda sozinho. */
export async function uploadRuntime(log: (line: string) => void = () => {}): Promise<void> {
  const { buckets } = s3Config();
  await ensureBucket(buckets.play);
  const missing = await missingRuntimeFiles();
  if (missing.length === 0) return;

  const file = join(tmpdir(), `boxedwine-${BOXEDWINE.version}-${randomBytes(6).toString("hex")}.zip`);
  try {
    log(`Baixando ${BOXEDWINE.releaseZip}`);
    const res = await fetch(BOXEDWINE.releaseZip);
    if (!res.ok || !res.body) throw new Error(`GitHub respondeu ${res.status} ao baixar o Boxedwine.`);
    const hash = createHash("sha256");
    await pipeline(
      Readable.fromWeb(res.body as NodeReadableStream<Uint8Array>),
      new Transform({
        transform(chunk: Buffer, _enc, cb) {
          hash.update(chunk);
          cb(null, chunk);
        },
      }),
      createWriteStream(file),
    );
    const sha = hash.digest("hex");
    if (sha !== BOXEDWINE.releaseSha256) throw new Error(`SHA-256 do Boxedwine não confere (${sha}).`);

    const zip = (await openAsBlob(file)) as unknown as Blob;
    const { entries } = await readZip(zip, { maxFiles: 1000, maxTotalBytes: 1024 ** 3, maxRatio: 400 });
    for (const f of BOXEDWINE.files.filter((x) => missing.includes(x.name))) {
      const entry = entries.find((e) => e.path === `SingleThreaded/${f.name}`);
      if (!entry || entry.size !== f.size) throw new Error(`${f.name} não está no zip do Boxedwine como esperado.`);
      const key = BOXEDWINE.dir + f.name;
      const headers = { "content-type": TYPES[f.name.slice(f.name.lastIndexOf("."))], "cache-control": CACHE_IMMUTABLE };
      if (entry.size <= PART) {
        const body = new Uint8Array(await (await entryBlob(zip, entry)).arrayBuffer());
        const put = await s3Fetch("PUT", buckets.play, key, { body, headers });
        const text = await put.text();
        if (!put.ok) throw new Error(`${key}: ${put.status} ${text.slice(0, 200)}`);
      } else {
        // Em partes: o proxy na frente do MinIO corta requisições com mais de 60 s.
        const uploadId = await createMultipartUpload(buckets.play, key, headers);
        const parts: { partNumber: number; etag: string }[] = [];
        try {
          for await (const part of chunkStream(await openEntry(zip, entry), PART)) {
            const partNumber = parts.length + 1;
            const body = new Uint8Array(await part.arrayBuffer());
            const put = await s3Fetch("PUT", buckets.play, key, { query: { partNumber: String(partNumber), uploadId }, body });
            const text = await put.text();
            if (!put.ok) throw new Error(`${key}, parte ${partNumber}: ${put.status} ${text.slice(0, 200)}`);
            parts.push({ partNumber, etag: put.headers.get("etag") ?? "" });
          }
          await completeMultipartUpload(buckets.play, key, uploadId, parts);
        } catch (err) {
          await abortMultipartUpload(buckets.play, key, uploadId).catch(() => {});
          throw err;
        }
      }
      log(`${key}: enviado (${(entry.size / 1024 / 1024).toFixed(1)} MB).`);
    }
  } finally {
    await rm(file, { force: true });
  }
}

/**
 * Instala o Boxedwine se faltar, com uma trava no Mongo (coleção meta, vale
 * 10 min) para não rodar duas instalações ao mesmo tempo. "instalando" quando
 * outra chamada já está cuidando disso.
 */
export async function installRuntime(): Promise<"pronto" | "instalando"> {
  if ((await missingRuntimeFiles()).length === 0) return "pronto";
  const { db } = await import("@/lib/auth/db");
  const { meta } = await db();
  const now = new Date();
  try {
    const got = await meta.findOneAndUpdate(
      { _id: LOCK_ID, $or: [{ until: { $exists: false } }, { until: { $lt: now } }] },
      { $set: { until: new Date(now.getTime() + LOCK_MS) } },
      { upsert: true, returnDocument: "after" },
    );
    if (!got) return "instalando";
  } catch (err) {
    // A trava existe e não venceu: o upsert bate na chave repetida.
    if ((err as { code?: number }).code === 11000) return "instalando";
    throw err;
  }
  try {
    await uploadRuntime((line) => console.log("[boxedwine]", line));
    return "pronto";
  } finally {
    await meta.updateOne({ _id: LOCK_ID }, { $set: { until: new Date(0) } });
  }
}

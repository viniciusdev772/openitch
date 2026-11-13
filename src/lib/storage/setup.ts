import "server-only";
import type { Collection } from "mongodb";
import { db } from "@/lib/auth/db";
import {
  deleteObjectVersions,
  ensureBucket,
  listObjectVersions,
  putBucketCors,
  putBucketEncryption,
  putBucketLifecycle,
  putBucketPolicy,
  putBucketVersioning,
  s3Config,
  s3Fetch,
} from "./s3";

/*
 * Configuração dos buckets, feita uma vez e conferida por instância (como os
 * índices em db.ts). Roda antes da primeira assinatura de URL. Tudo é
 * idempotente: aplicar de novo não muda nada.
 *
 * O que o MinIO comunitário aceita (testado no servidor local e no do dono,
 * ver o relatório da frente "upload"):
 * - versionamento: sim;
 * - lifecycle: NoncurrentVersionExpiration, ExpiredObjectDeleteMarker e
 *   Expiration com filtro por tag: sim. AbortIncompleteMultipartUpload: NÃO
 *   (o XML é recusado); o MinIO já descarta sozinho uploads multipart parados
 *   há 24 h (api stale_uploads_expiry), e o servidor do site aborta os
 *   abandonados ao listar ou iniciar envios;
 * - política de bucket: sim;
 * - CORS por bucket (PutBucketCors): NÃO (NotImplemented); vale o CORS
 *   global, que ecoa a origem e expõe ETag;
 * - SSE-S3: só com KMS configurado no servidor; é testado antes de ligar.
 *
 * Gravamos no Mongo a versão desta configuração já aplicada, para que cada
 * instância nova da Vercel não refaça seis chamadas ao MinIO.
 */

/** Suba este número quando mudar o que ensureStorage aplica. */
const SETUP_VERSION = 3;
const SETUP_ID = "storage";

export interface StorageCaps {
  /** CORS por bucket aplicado (senão vale o CORS global do MinIO). */
  bucketCors: boolean;
  /** Regra de lifecycle para multipart incompleto aceita. */
  abortRule: boolean;
  /** Criptografia SSE-S3 ligada no bucket de arquivos. */
  sse: boolean;
}

interface SetupDoc {
  _id: string;
  version: number;
  endpoint: string;
  buckets: string[];
  caps: StorageCaps;
  at: Date;
}

type Cache = { setup?: Promise<StorageCaps> };
const g = globalThis as typeof globalThis & { __vibegamesStorage?: Cache };
const cache: Cache = (g.__vibegamesStorage ??= {});

/** Origens do site que podem enviar e baixar direto do MinIO pelo navegador. */
export function siteOrigins(): string[] {
  const env = process.env.S3_CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  return env?.length ? env : ["https://openitch.vercel.app", "https://openitch-*.vercel.app", "http://localhost:*"];
}

function corsXml(origins: string[]) {
  return (
    `<CORSRule>` +
    origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join("") +
    ["GET", "PUT", "HEAD", "POST"].map((m) => `<AllowedMethod>${m}</AllowedMethod>`).join("") +
    `<AllowedHeader>*</AllowedHeader>` +
    ["ETag", "Content-Length", "Content-Range", "Accept-Ranges", "x-amz-checksum-sha256"].map((h) => `<ExposeHeader>${h}</ExposeHeader>`).join("") +
    `<MaxAgeSeconds>3600</MaxAgeSeconds>` +
    `</CORSRule>`
  );
}

const RULE_NONCURRENT = `<Rule><ID>versoes-antigas-7-dias</ID><Status>Enabled</Status><Filter><Prefix></Prefix></Filter><NoncurrentVersionExpiration><NoncurrentDays>7</NoncurrentDays></NoncurrentVersionExpiration></Rule>`;
const RULE_MARKERS = `<Rule><ID>marcadores-orfaos</ID><Status>Enabled</Status><Filter><Prefix></Prefix></Filter><Expiration><ExpiredObjectDeleteMarker>true</ExpiredObjectDeleteMarker></Expiration></Rule>`;
const RULE_DISCARDED = `<Rule><ID>descartados</ID><Status>Enabled</Status><Filter><Tag><Key>status</Key><Value>descartado</Value></Tag></Filter><Expiration><Days>1</Days></Expiration></Rule>`;
const RULE_ABORT = `<Rule><ID>multipart-parado-1-dia</ID><Status>Enabled</Status><Filter><Prefix></Prefix></Filter><AbortIncompleteMultipartUpload><DaysAfterInitiation>1</DaysAfterInitiation></AbortIncompleteMultipartUpload></Rule>`;

async function tryCors(bucket: string, origins: string[]): Promise<boolean> {
  try {
    if (await putBucketCors(bucket, corsXml(origins))) return true;
  } catch {
    // Curinga recusado: tenta só com origens exatas.
    try {
      const exact = origins.filter((o) => !o.includes("*"));
      if (exact.length && (await putBucketCors(bucket, corsXml(exact)))) return true;
    } catch {
      /* cai no CORS global */
    }
  }
  return false;
}

/** SSE-S3 só é ligado se um PUT criptografado de teste passar. */
async function trySse(bucket: string): Promise<boolean> {
  const key = ".vibegames-setup/sse-probe";
  const res = await s3Fetch("PUT", bucket, key, { body: "1", headers: { "x-amz-server-side-encryption": "AES256" } });
  await res.text();
  if (!res.ok) return false;
  const versions = (await listObjectVersions(bucket, ".vibegames-setup/")).map((v) => ({ key: v.key, versionId: v.versionId }));
  if (versions.length) await deleteObjectVersions(bucket, versions);
  return putBucketEncryption(bucket);
}

async function apply(): Promise<StorageCaps> {
  const { buckets } = s3Config();
  await ensureBucket(buckets.files);
  await ensureBucket(buckets.play);

  // Arquivos (privado): versionamento + limpeza automática.
  await putBucketVersioning(buckets.files, true);
  let abortRule = true;
  try {
    await putBucketLifecycle(buckets.files, RULE_ABORT + RULE_NONCURRENT + RULE_MARKERS + RULE_DISCARDED);
  } catch {
    abortRule = false;
    await putBucketLifecycle(buckets.files, RULE_NONCURRENT + RULE_MARKERS + RULE_DISCARDED);
  }
  try {
    await putBucketLifecycle(buckets.play, RULE_ABORT + RULE_DISCARDED);
  } catch {
    await putBucketLifecycle(buckets.play, RULE_DISCARDED);
  }

  // Jogável: leitura anônima SÓ de objetos em b/ (sem listar o bucket).
  await putBucketPolicy(buckets.play, {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "LeituraPublicaDosBuilds",
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${buckets.play}/b/*`],
      },
    ],
  });

  const origins = siteOrigins();
  const corsFiles = await tryCors(buckets.files, origins);
  const corsPlay = await tryCors(buckets.play, origins);
  let sse = false;
  try {
    sse = await trySse(buckets.files);
  } catch {
    sse = false;
  }
  return { bucketCors: corsFiles && corsPlay, abortRule, sse };
}

/**
 * Garante buckets, versionamento, lifecycle, política e CORS. Cacheado por
 * instância; se falhar, a próxima chamada tenta de novo.
 */
export function ensureStorage(): Promise<StorageCaps> {
  if (!cache.setup) {
    cache.setup = (async () => {
      const cfg = s3Config();
      const endpoint = cfg.endpoint.origin;
      const bucketList = [cfg.buckets.files, cfg.buckets.play];
      const { meta } = await setupCollection();
      const done = await meta.findOne({ _id: SETUP_ID });
      if (done && done.version === SETUP_VERSION && done.endpoint === endpoint && done.buckets.join() === bucketList.join()) {
        return done.caps;
      }
      const caps = await apply();
      await meta.updateOne(
        { _id: SETUP_ID },
        { $set: { version: SETUP_VERSION, endpoint, buckets: bucketList, caps, at: new Date() } },
        { upsert: true },
      );
      return caps;
    })().catch((err) => {
      cache.setup = undefined;
      throw err;
    });
  }
  return cache.setup;
}

async function setupCollection() {
  const { meta } = await db();
  return { meta: meta as unknown as Collection<SetupDoc> };
}

/** Esquece a configuração gravada (use depois de trocar o servidor ou os buckets). */
export async function resetStorageSetup() {
  cache.setup = undefined;
  const { meta } = await setupCollection();
  await meta.deleteOne({ _id: SETUP_ID });
}

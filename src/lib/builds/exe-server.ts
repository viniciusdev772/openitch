import "server-only";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { db } from "@/lib/auth/db";
import { canView } from "@/lib/projects/access";
import { ensureStorage } from "@/lib/storage/setup";
import { headObject, publicUrl, s3Config, s3Fetch } from "@/lib/storage/s3";
import { BOXEDWINE, canPlayExe, canTryExe } from "./exe";
import { missingRuntimeFiles } from "./exe-install";
import { EXE_LAUNCHER_HTML } from "./exe-launcher";
import { CACHE_IMMUTABLE } from "./mime";

/*
 * Servidor do "Jogar no navegador" de downloads de Windows. A página do
 * Boxedwine tem o hash do conteúdo no nome: cada mudança em exe-launcher.ts
 * vira um arquivo novo, gravado uma vez (algumas centenas de bytes de HTML do
 * servidor para o MinIO; nada do jogo nem do Wine passa pela Vercel).
 */

const LAUNCHER_KEY = `${BOXEDWINE.dir}jogar-${createHash("sha256").update(EXE_LAUNCHER_HTML).digest("hex").slice(0, 12)}.html`;

type Cache = { launcher?: Promise<void> };
const g = globalThis as typeof globalThis & { __vgExe?: Cache };
const cache: Cache = (g.__vgExe ??= {});

/** Boxedwine ainda não está no bucket (POST /api/jogar-exe/instalar o instala). */
export class ExeRuntimeMissing extends Error {}

/**
 * Confere que o Boxedwine está no bucket jogável e grava a página que roda o
 * jogo, se faltar. Devolve a URL dela. Cacheado por instância quando dá certo.
 */
export async function exeLauncherUrl(): Promise<string> {
  const { buckets } = s3Config();
  if (!cache.launcher) {
    cache.launcher = (async () => {
      await ensureStorage();
      if ((await missingRuntimeFiles()).length > 0) throw new ExeRuntimeMissing();
      if (await headObject(buckets.play, LAUNCHER_KEY)) return;
      const res = await s3Fetch("PUT", buckets.play, LAUNCHER_KEY, {
        body: EXE_LAUNCHER_HTML,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": CACHE_IMMUTABLE },
      });
      await res.text();
      if (!res.ok) throw new Error(`Não deu para gravar a página do Boxedwine (${res.status}).`);
    })().catch((err) => {
      cache.launcher = undefined;
      throw err;
    });
  }
  await cache.launcher;
  return publicUrl(buckets.play, LAUNCHER_KEY);
}

/**
 * O download de Windows que pode rodar no navegador, se quem vê pode vê-lo
 * (mesma regra de /baixar: o dono, ou todos com o jogo publicado). Senão null,
 * sem dizer se existe.
 */
export async function exeForPlay(viewer: { _id: ObjectId } | null, rawId: string, forced = false) {
  if (!/^[a-f0-9]{24}$/.test(rawId)) return null;
  const { uploads, projects } = await db();
  const upload = await uploads.findOne({ _id: new ObjectId(rawId), status: "pronto", kind: "download" });
  // "Tentar mesmo assim" (forced): qualquer arquivo de Windows, acima do limite ou de outro formato.
  if (!upload || !(forced ? canTryExe(upload) : canPlayExe(upload))) return null;
  const project = await projects.findOne(
    { _id: upload.projectId, userId: upload.userId },
    { projection: { title: 1, userId: 1, status: 1, track: 1, publicSlug: 1 } },
  );
  if (!project || !canView(viewer, project)) return null;
  return { upload, project };
}

import "server-only";
import { randomBytes } from "node:crypto";
import type { ObjectId } from "mongodb";
import { db } from "@/lib/auth/db";
import { sha256 } from "@/lib/auth/crypto";
import { COVER_KEY_RE, coverUrl, forgetOptimized } from "@/lib/projects/cover-store";
import { copyObject, deleteObject, listKeys, purgePrefix, storageConfigured } from "@/lib/storage/s3";

/*
 * Links que giram quando a moderação tira um jogo do ar (ou fecha a conta).
 *
 * O build jogável (b/<publicId>/) e as imagens (b/capa-<aleatório>/) ficam no
 * bucket de leitura pública: o segredo é só o nome aleatório na URL. Tirar o
 * jogo do catálogo não mata um link que já circulou (o iframe expõe a URL a
 * quem jogou). Aqui os objetos vão para um nome novo e os antigos são apagados:
 * o link vazado morre, e o conteúdo continua para o dono rever e recorrer.
 *
 * Não precisa girar: os downloads (bucket privado, URL assinada de 10 min a
 * cada clique) e as URLs de envio (1 h, e a conta suspensa não assina mais).
 */

const hex = () => randomBytes(16).toString("hex");

async function each<T>(xs: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (i < xs.length) await fn(xs[i++]);
  }));
}

async function rotateBuilds(projectId: ObjectId) {
  const { builds } = await db();
  const list = await builds
    .find({ projectId, status: "pronto", publicId: { $type: "string" } }, { projection: { _id: 1, bucket: 1, prefix: 1 } })
    .toArray();
  for (const b of list) {
    const publicId = hex();
    const prefix = `b/${publicId}/`;
    try {
      const keys = await listKeys(b.bucket, b.prefix);
      // ponytail: cópia no próprio MinIO, 16 por vez; um build de 20 mil arquivos leva dezenas de segundos.
      await each(keys, 16, (k) => copyObject(b.bucket, k.key, prefix + k.key.slice(b.prefix.length)));
    } catch (err) {
      await purgePrefix(b.bucket, prefix).catch(() => undefined);
      throw err;
    }
    const res = await builds.updateOne({ _id: b._id, prefix: b.prefix }, { $set: { publicId, prefix, updatedAt: new Date() } });
    // Trocou: some o antigo. Alguém trocou antes (excluiu o build): some a cópia.
    await purgePrefix(b.bucket, res.modifiedCount ? b.prefix : prefix);
  }
}

type Img = { bucket: string; key: string; url: string };

async function rotateImages(projectId: ObjectId) {
  const { projects, moderation } = await db();
  const p = await projects.findOne({ _id: projectId }, { projection: { coverImage: 1, screenshots: 1, moderation: 1, updatedAt: 1 } });
  if (!p) return;
  const moved: { from: Img; to: Img }[] = [];
  const move = async (img: Img | null | undefined) => {
    if (!img || !COVER_KEY_RE.test(img.key)) return img ?? null;
    const key = img.key.replace(/^b\/capa-[a-f0-9]{32}\//, `b/capa-${hex()}/`);
    await copyObject(img.bucket, img.key, key);
    const to = { bucket: img.bucket, key, url: coverUrl(key) };
    moved.push({ from: img, to });
    return to;
  };
  let coverImage: Img | null;
  let screenshots: (Img | null)[];
  try {
    coverImage = await move(p.coverImage);
    screenshots = await Promise.all((p.screenshots ?? []).map(move));
  } catch (err) {
    for (const m of moved) await deleteObject(m.to.bucket, m.to.key).catch(() => undefined);
    throw err;
  }
  if (!moved.length) return;
  // Só grava se ninguém mexeu no projeto enquanto copiava.
  const res = await projects.updateOne(
    { _id: projectId, updatedAt: p.updatedAt },
    { $set: { coverImage, screenshots: screenshots.filter((x): x is Img => x !== null) } },
  );
  const gone = moved.map((m) => (res.modifiedCount ? m.from : m.to));
  for (const g of gone) await deleteObject(g.bucket, g.key).catch(() => undefined);
  await forgetOptimized(gone.map((g) => coverUrl(g.key)));
  if (!res.modifiedCount) return;

  // As decisões guardam as URLs e o hash do conteúdo: atualiza, para o recurso ainda ver as imagens
  // e a mesma página continuar reconhecida como "o conteúdo que foi removido".
  const urls = new Map(moved.map((m) => [m.from.url, m.to.url]));
  const docs = await moderation
    .find({ targetKey: `jogo:${projectId.toHexString()}`, images: { $in: [...urls.keys()] } }, { projection: { snapshot: 1, images: 1 } })
    .toArray();
  for (const d of docs) {
    const images = d.images.map((u) => urls.get(u) ?? u);
    const contentHash = sha256(JSON.stringify([d.snapshot, images]));
    await moderation.updateOne({ _id: d._id }, { $set: { images, contentHash } });
    if (p.moderation?.decisionId.equals(d._id)) {
      await projects.updateOne({ _id: projectId, "moderation.decisionId": d._id }, { $set: { "moderation.contentHash": contentHash } });
    }
  }
}

/** Gira os links públicos de um jogo. Falha não desfaz a decisão: fica no log. */
export async function rotateLinks(projectId: ObjectId) {
  if (!storageConfigured()) return;
  try {
    await rotateBuilds(projectId);
    await rotateImages(projectId);
    console.info(`[moderacao] links girados: jogo:${projectId.toHexString()}`);
  } catch (err) {
    console.error(`[moderacao] girar links de jogo:${projectId.toHexString()}`, err);
  }
}

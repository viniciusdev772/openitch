import "server-only";
import { cache } from "react";
import type { ObjectId } from "mongodb";
import { PLATFORMS, TRACKS, makeCatalog, EMPTY_CATALOG, jamBySlug, type Catalog, type Creator, type Download, type Game, type Platform } from "@/data/catalog";
import { db, type ProjectDoc } from "@/lib/auth/db";
import { DRAFT_COVERS } from "@/lib/projects/limits";
import { formatBytes } from "@/lib/storage/limits";

/*
 * O catálogo público, lido do MongoDB: só projetos com status "publicado".
 * Uma leitura por renderização (React cache). As páginas do programa são
 * regeneradas a cada minuto (revalidate) e na hora em que alguém publica,
 * edita ou tira do ar (revalidatePublic), então o banco não é consultado a
 * cada visita.
 *
 * Nada de rascunho, e-mail ou id interno sai daqui: só os campos que a página
 * pública imprime.
 */

/** Teto de jogos lidos de uma vez (o catálogo inteiro cabe numa página por enquanto). */
const MAX_GAMES = 2000;
const PLATFORM_ORDER = Object.keys(PLATFORMS) as Platform[];
const TRACK_IDS = new Set<string>(TRACKS.map((t) => t.id));

/** Parágrafos da descrição: separados por linha em branco; quebras simples viram espaço. */
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

type Files = { downloads: Map<string, Download[]>; play: Map<string, string> };

async function filesOf(ids: ObjectId[]): Promise<Files> {
  const { uploads, builds } = await db();
  const [ups, bs] = await Promise.all([
    uploads
      .find(
        { projectId: { $in: ids }, kind: "download", status: "pronto" },
        { projection: { projectId: 1, platform: 1, filename: 1, size: 1, createdAt: 1 } },
      )
      .sort({ createdAt: 1 })
      .toArray(),
    builds
      .find(
        { projectId: { $in: ids }, status: "pronto", publicId: { $type: "string" } },
        { projection: { projectId: 1, publicId: 1, completedAt: 1, updatedAt: 1 } },
      )
      .sort({ completedAt: -1, updatedAt: -1 })
      .toArray(),
  ]);
  const downloads = new Map<string, Download[]>();
  for (const u of ups) {
    const key = u.projectId.toHexString();
    const list = downloads.get(key) ?? [];
    list.push({ platform: u.platform, file: u.filename, size: formatBytes(u.size), href: `/baixar/${u._id.toHexString()}` });
    downloads.set(key, list);
  }
  for (const list of downloads.values()) {
    list.sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));
  }
  // O build mais recente de cada projeto é o que a página do jogo abre.
  const play = new Map<string, string>();
  for (const b of bs) {
    const key = b.projectId.toHexString();
    if (!play.has(key)) play.set(key, `/jogar/${b.publicId}`);
  }
  return { downloads, play };
}

function toGame(p: ProjectDoc, creator: Creator, files: Files): Game | null {
  if (!p.publicSlug || !p.number || !p.publishedAt) return null;
  const key = p._id.toHexString();
  const downloads = files.downloads.get(key) ?? [];
  const play = files.play.get(key);
  const cover = DRAFT_COVERS.find((c) => c.style === p.cover) ?? DRAFT_COVERS[0];
  // A página só promete a plataforma que tem arquivo de verdade.
  const platforms = PLATFORM_ORDER.filter(
    (x) => p.platforms.includes(x) && (x === "web" ? Boolean(play) : downloads.some((d) => d.platform === x)),
  );
  const price: Game["price"] =
    p.price.kind === "fixed"
      ? { kind: "fixed", amount: p.price.cents / 100 }
      : p.price.kind === "pwyw"
        ? { kind: "pwyw", minimum: p.price.minimumCents / 100 }
        : { kind: "free" };
  return {
    slug: p.publicSlug,
    number: p.number,
    title: p.title,
    tagline: p.tagline,
    description: paragraphs(p.description),
    creator: creator.slug,
    creatorName: creator.name,
    track: TRACK_IDS.has(p.track) ? p.track : "experimental",
    tags: p.tags,
    platforms,
    price,
    published: p.publishedAt.toISOString(),
    updated: p.updatedAt.toISOString(),
    session: "",
    languages: [],
    cover: cover.style,
    palette: cover.palette,
    downloads: downloads.filter((d) => platforms.includes(d.platform)),
    play,
    jam: p.jam && jamBySlug(p.jam) ? p.jam : undefined,
  };
}

async function load(): Promise<Catalog> {
  const { projects, users } = await db();
  const docs = await projects.find({ status: "publicado" }).sort({ publishedAt: -1 }).limit(MAX_GAMES).toArray();
  if (docs.length === 0) return EMPTY_CATALOG;

  const userIds = [...new Map(docs.map((d) => [d.userId.toHexString(), d.userId])).values()];
  const [people, files] = await Promise.all([
    users
      .find({ _id: { $in: userIds }, creatorSlug: { $type: "string" } }, { projection: { name: 1, creatorSlug: 1, firstPublishedAt: 1 } })
      .toArray(),
    filesOf(docs.map((d) => d._id)),
  ]);
  const byUser = new Map<string, Creator>();
  for (const u of people) {
    byUser.set(u._id.toHexString(), {
      slug: u.creatorSlug!,
      name: u.name,
      city: "",
      bio: "",
      joined: u.firstPublishedAt?.toISOString(),
    });
  }
  const games = docs.flatMap((d) => {
    const creator = byUser.get(d.userId.toHexString());
    const g = creator ? toGame(d, creator, files) : null;
    return g ? [g] : [];
  });
  const active = new Set(games.map((g) => g.creator));
  return makeCatalog(
    games,
    [...byUser.values()].filter((c) => active.has(c.slug)),
  );
}

/**
 * O catálogo publicado, uma vez por renderização. No build sem banco
 * configurado (ou fora do ar), sai vazio: as páginas se refazem no primeiro
 * minuto em produção. Em produção, um erro sobe, e a regeneração mantém a
 * última versão boa da página.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const building = process.env.NEXT_PHASE === "phase-production-build";
  if (building && !process.env.MONGODB_URI) return EMPTY_CATALOG;
  try {
    return await load();
  } catch (err) {
    if (!building) throw err;
    console.error("[catalogo] build sem acesso ao banco; páginas saem vazias até a próxima regeneração", err);
    return EMPTY_CATALOG;
  }
});

// Devlogs and release notes for published games. Empty until games publish
// notes. Lookups take the catalogue snapshot the page loaded.

import type { Catalog, Game } from "./catalog";

export type DevlogKind = "lancamento" | "atualizacao" | "devlog" | "jam";

export interface Devlog {
  slug: string;
  /** Slug of a game in catalog.ts */
  game: string;
  kind: DevlogKind;
  title: string;
  /** ISO timestamp, São Paulo time */
  at: string;
  body: string[];
}

export const DEVLOG_KINDS: Record<DevlogKind, string> = {
  lancamento: "Lançamento",
  atualizacao: "Atualização",
  devlog: "Devlog",
  jam: "Jam",
};

export const DEVLOGS: Devlog[] = [];

const byNewest = (a: Devlog, b: Devlog) => +new Date(b.at) - +new Date(a.at);

export const devlogsByNewest = () => [...DEVLOGS].sort(byNewest);
export const devlogBySlug = (slug: string) => DEVLOGS.find((d) => d.slug === slug);

/** The game a note belongs to, or undefined when it is not in the programme (any more). */
export const devlogGame = (cat: Catalog, d: Devlog): Game | undefined => cat.gameBySlug(d.game);

export const devlogCreator = (cat: Catalog, d: Devlog) => {
  const g = devlogGame(cat, d);
  return g ? cat.creatorBySlug(g.creator) : undefined;
};

/** Notes whose game is in the programme, newest first. */
export const liveDevlogs = (cat: Catalog) => devlogsByNewest().filter((d) => cat.gameBySlug(d.game));

/** Other notes by the same creator, newest first. */
export function devlogsBySameCreator(cat: Catalog, d: Devlog): Devlog[] {
  const creator = devlogGame(cat, d)?.creator;
  if (!creator) return [];
  return DEVLOGS.filter((x) => x.slug !== d.slug && cat.gameBySlug(x.game)?.creator === creator).sort(byNewest);
}

/** Previous (older) and next (newer) notes in date order. */
export function devlogNeighbours(d: Devlog): { older?: Devlog; newer?: Devlog } {
  const list = devlogsByNewest();
  const i = list.findIndex((x) => x.slug === d.slug);
  return { newer: i > 0 ? list[i - 1] : undefined, older: i < list.length - 1 ? list[i + 1] : undefined };
}

// Synthetic devlogs and release notes for the sample catalogue. Every note,
// date and detail here is invented demonstration material, written for games
// that already exist in catalog.ts.

import { creatorBySlug, gameBySlug, type Game } from "./catalog";

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

/** The game a note belongs to. Every note points at an existing catalogue game. */
export const devlogGame = (d: Devlog): Game => gameBySlug(d.game)!;

export const devlogCreator = (d: Devlog) => creatorBySlug(devlogGame(d).creator);

/** Other notes by the same creator, newest first. */
export function devlogsBySameCreator(d: Devlog): Devlog[] {
  const creator = devlogGame(d).creator;
  return DEVLOGS.filter((x) => x.slug !== d.slug && gameBySlug(x.game)?.creator === creator).sort(byNewest);
}

/** Previous (older) and next (newer) notes in date order. */
export function devlogNeighbours(d: Devlog): { older?: Devlog; newer?: Devlog } {
  const list = devlogsByNewest();
  const i = list.findIndex((x) => x.slug === d.slug);
  return { newer: i > 0 ? list[i - 1] : undefined, older: i < list.length - 1 ? list[i + 1] : undefined };
}

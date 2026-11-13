// The programme catalogue: published games and their creators. The data comes
// from the database (src/lib/catalog/server.ts loads it per render); this file
// only holds the lookups, so server pages and client islands share them.

import type { Creator, Game, Jam } from "./base";

export * from "./base";
import { JAMS } from "./jams";
export { JAMS };

export const jamBySlug = (slug: string) => JAMS.find((j) => j.slug === slug);

const byNewest = (a: Game, b: Game) => +new Date(b.published) - +new Date(a.published);
const tagKey = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** What a page needs to look things up in one snapshot of the catalogue. */
export interface Catalog {
  /** Newest first. */
  games: Game[];
  creators: Creator[];
  gameBySlug(slug: string): Game | undefined;
  creatorBySlug(slug: string): Creator | undefined;
  /** The creator's display name for a game ("" when unknown). */
  creatorName(game: Game): string;
  gamesByCreator(slug: string): Game[];
  gamesByJam(slug: string): Game[];
  /** Games carrying a tag, matched without case or accents. */
  gamesByTag(tag: string): Game[];
  /** Tags with how many games carry each, most used first. */
  tagCounts(): { tag: string; count: number }[];
  /** The host's creator page, when the host has one. */
  jamHost(jam: Jam): Creator | undefined;
  /** Jams a creator hosts. */
  jamsByHost(slug: string): Jam[];
}

/** Builds the lookups over one snapshot. Games are kept newest first. */
export function makeCatalog(games: Game[], creators: Creator[]): Catalog {
  const sorted = [...games].sort(byNewest);
  const gameMap = new Map(sorted.map((g) => [g.slug, g]));
  const creatorMap = new Map(creators.map((c) => [c.slug, c]));
  const creatorBySlug = (slug: string) => creatorMap.get(slug);
  const jamHost = (jam: Jam) => (jam.hostSlug ? creatorBySlug(jam.hostSlug) : creators.find((c) => c.name === jam.host));
  let counts: { tag: string; count: number }[] | null = null;
  return {
    games: sorted,
    creators,
    gameBySlug: (slug) => gameMap.get(slug),
    creatorBySlug,
    creatorName: (g) => g.creatorName ?? creatorBySlug(g.creator)?.name ?? "",
    gamesByCreator: (slug) => sorted.filter((g) => g.creator === slug),
    gamesByJam: (slug) => sorted.filter((g) => g.jam === slug),
    gamesByTag: (tag) => {
      const k = tagKey(tag);
      return sorted.filter((g) => g.tags.some((t) => tagKey(t) === k));
    },
    tagCounts: () => {
      if (counts) return counts;
      const tally = new Map<string, number>();
      for (const g of sorted) for (const t of g.tags) tally.set(t, (tally.get(t) ?? 0) + 1);
      counts = [...tally]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"));
      return counts;
    },
    jamHost,
    jamsByHost: (slug) => JAMS.filter((j) => jamHost(j)?.slug === slug),
  };
}

/** An empty programme (no games, no creators). */
export const EMPTY_CATALOG = makeCatalog([], []);

// Synthetic sample catalogue. Every game, creator, jam and number here is
// invented demonstration material; the UI labels it as such.

import {
  TRACKS,
  trackById,
  pickNow,
  type Game,
  type Jam,
  type Creator,
} from "./base";

export * from "./base";
import { JAMS } from "./jams";
export { JAMS };

export const CREATORS: Creator[] = [];

export const GAMES: Game[] = [];


export const creatorBySlug = (slug: string) => CREATORS.find((c) => c.slug === slug);
export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug);
export const gamesByNewest = () =>
  [...GAMES].sort((a, b) => +new Date(b.published) - +new Date(a.published));


const byNewest = (a: Game, b: Game) => +new Date(b.published) - +new Date(a.published);

export const gamesByCreator = (slug: string) => GAMES.filter((g) => g.creator === slug).sort(byNewest);
export const jamBySlug = (slug: string) => JAMS.find((j) => j.slug === slug);
export const gamesByJam = (slug: string) => GAMES.filter((g) => g.jam === slug).sort(byNewest);

const tagKey = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Games carrying a tag, matched without case or accents. */
export const gamesByTag = (tag: string) => {
  const k = tagKey(tag);
  return GAMES.filter((g) => g.tags.some((t) => tagKey(t) === k)).sort(byNewest);
};

/** Every tag in the catalogue, once, in pt-BR alphabetical order. */
export const allTags = () =>
  [...new Set(GAMES.flatMap((g) => g.tags))].sort((a, b) => a.localeCompare(b, "pt-BR"));

/** Tags with how many games carry each, most used first. */
export const tagCounts = () => {
  const counts = new Map<string, number>();
  for (const g of GAMES) for (const t of g.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"));
};

/** The host's creator page, when the host has one. */
export const jamHost = (jam: Jam) =>
  jam.hostSlug ? creatorBySlug(jam.hostSlug) : CREATORS.find((c) => c.name === jam.host);


/** Jams a creator hosts. */
export const jamsByHost = (slug: string) => JAMS.filter((j) => jamHost(j)?.slug === slug);

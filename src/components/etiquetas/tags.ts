// The tag index, built from the catalogue. Tags are grouped by slug, so
// spellings that differ only in case, accents or punctuation ("Física",
// "física"; "pixel art", "pixel-art") are one entry, shown with the spelling
// most games use. Games are joined by that same slug, so the count, the tag
// page, the catalogue's ?etiqueta= filter and related tags always agree.

import { TRACKS, type Game, type TrackId } from "@/data/base";
import { fold, tagSlug } from "./slug";

export type TagTrack = { id: TrackId; count: number };

export type TagInfo = {
  tag: string;
  slug: string;
  /** Games carrying the tag, newest first. */
  games: Game[];
  count: number;
  /** Tracks the tag appears in, in programme order. */
  tracks: TagTrack[];
  /** The track most of its games sit in; ties go to the newest game's track. */
  main: TrackId;
};

/** Billing step by how many games carry the tag: 1, 2–3, 4–6, 7 or more. */
export type Bill = 1 | 2 | 3 | 4;
export const billing = (count: number): Bill => (count >= 7 ? 4 : count >= 4 ? 3 : count >= 2 ? 2 : 1);

/** One index per catalogue snapshot (the games array is the key). */
const cache = new WeakMap<readonly Game[], TagInfo[]>();

const byNewest = (a: Game, b: Game) => +new Date(b.published) - +new Date(a.published);

/** Tags with how many games carry each, most used first. */
function tagCounts(games: readonly Game[]) {
  const counts = new Map<string, number>();
  for (const g of games) for (const t of g.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"));
}

/** Every tag of these games once, alphabetical in pt-BR. */
export function tagIndex(games: readonly Game[]): TagInfo[] {
  const hit = cache.get(games);
  if (hit) return hit;
  // tagCounts() is most-used first, so the first spelling seen per slug wins.
  const bySlug = new Map<string, string>();
  for (const { tag } of tagCounts(games)) {
    const slug = tagSlug(tag);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, tag);
  }
  // Each game once per slug, even when it carries two spellings of one tag.
  const gamesBySlug = new Map<string, Game[]>();
  for (const g of [...games].sort(byNewest)) {
    for (const slug of new Set(g.tags.map(tagSlug))) {
      if (!slug) continue;
      const list = gamesBySlug.get(slug);
      if (list) list.push(g);
      else gamesBySlug.set(slug, [g]);
    }
  }
  const index = [...bySlug].map(([slug, tag]) => {
    const games = gamesBySlug.get(slug)!;
    const tally = new Map<TrackId, number>();
    for (const g of games) tally.set(g.track, (tally.get(g.track) ?? 0) + 1);
    const tracks = TRACKS.filter((t) => tally.has(t.id)).map((t) => ({ id: t.id, count: tally.get(t.id)! }));
    const top = Math.max(...tracks.map((t) => t.count));
    const main = games.find((g) => tally.get(g.track) === top)!.track;
    return { tag, slug, games, count: games.length, tracks, main };
  });
  index.sort((a, b) => a.tag.localeCompare(b.tag, "pt-BR", { sensitivity: "base" }));
  cache.set(games, index);
  return index;
}

export const tagBySlug = (games: readonly Game[], slug: string) => tagIndex(games).find((t) => t.slug === slug);

/** The index letter of a tag: its first letter without accent, or "#" for anything else. */
export function initialOf(tag: string): string {
  const c = fold(tag).trim().charAt(0);
  return c >= "a" && c <= "z" ? c.toUpperCase() : "#";
}

/** Tags grouped under their initial letter, in letter order ("#" last). */
export function tagsByLetter(games: readonly Game[]): { letter: string; tags: TagInfo[] }[] {
  const groups = new Map<string, TagInfo[]>();
  for (const t of tagIndex(games)) {
    const l = initialOf(t.tag);
    groups.set(l, [...(groups.get(l) ?? []), t]);
  }
  return [...groups]
    .map(([letter, tags]) => ({ letter, tags }))
    .sort((a, b) => (a.letter === "#" ? 1 : b.letter === "#" ? -1 : a.letter.localeCompare(b.letter)));
}

/** Tags that share at least one game with this one, most shared first. */
export function relatedTags(games: readonly Game[], info: TagInfo, limit = 12): { info: TagInfo; together: number }[] {
  const shared = new Map<string, number>();
  for (const g of info.games) {
    const seen = new Set<string>();
    for (const t of g.tags) {
      const s = tagSlug(t);
      if (!s || s === info.slug || seen.has(s)) continue;
      seen.add(s);
      shared.set(s, (shared.get(s) ?? 0) + 1);
    }
  }
  return [...shared]
    .map(([slug, together]) => ({ info: tagBySlug(games, slug)!, together }))
    .filter((r) => r.info)
    .sort((a, b) => b.together - a.together || b.info.count - a.info.count || a.info.tag.localeCompare(b.info.tag, "pt-BR"))
    .slice(0, limit);
}

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

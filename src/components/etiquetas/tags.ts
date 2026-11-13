// The tag index, built from the sample catalogue. Tags are grouped by slug, so
// two spellings that differ only in case or accents ("Física", "física") are
// one entry, shown with the spelling most games use.

import { TRACKS, type Game, type TrackId, gamesByTag, tagCounts } from "@/data/catalog";
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

let cache: TagInfo[] | null = null;

/** Every tag once, alphabetical in pt-BR. */
export function tagIndex(): TagInfo[] {
  if (cache) return cache;
  // tagCounts() is most-used first, so the first spelling seen per slug wins.
  const bySlug = new Map<string, string>();
  for (const { tag } of tagCounts()) {
    const slug = tagSlug(tag);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, tag);
  }
  cache = [...bySlug].map(([slug, tag]) => {
    const games = gamesByTag(tag);
    const tally = new Map<TrackId, number>();
    for (const g of games) tally.set(g.track, (tally.get(g.track) ?? 0) + 1);
    const tracks = TRACKS.filter((t) => tally.has(t.id)).map((t) => ({ id: t.id, count: tally.get(t.id)! }));
    const top = Math.max(...tracks.map((t) => t.count));
    const main = games.find((g) => tally.get(g.track) === top)!.track;
    return { tag, slug, games, count: games.length, tracks, main };
  });
  cache.sort((a, b) => a.tag.localeCompare(b.tag, "pt-BR", { sensitivity: "base" }));
  return cache;
}

export const tagBySlug = (slug: string) => tagIndex().find((t) => t.slug === slug);

/** The index letter of a tag: its first letter without accent, or "#" for anything else. */
export function initialOf(tag: string): string {
  const c = fold(tag).trim().charAt(0);
  return c >= "a" && c <= "z" ? c.toUpperCase() : "#";
}

/** Tags grouped under their initial letter, in letter order ("#" last). */
export function tagsByLetter(): { letter: string; tags: TagInfo[] }[] {
  const groups = new Map<string, TagInfo[]>();
  for (const t of tagIndex()) {
    const l = initialOf(t.tag);
    groups.set(l, [...(groups.get(l) ?? []), t]);
  }
  return [...groups]
    .map(([letter, tags]) => ({ letter, tags }))
    .sort((a, b) => (a.letter === "#" ? 1 : b.letter === "#" ? -1 : a.letter.localeCompare(b.letter)));
}

/** Tags that share at least one game with this one, most shared first. */
export function relatedTags(info: TagInfo, limit = 12): { info: TagInfo; together: number }[] {
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
    .map(([slug, together]) => ({ info: tagBySlug(slug)!, together }))
    .filter((r) => r.info)
    .sort((a, b) => b.together - a.together || b.info.count - a.info.count || a.info.tag.localeCompare(b.info.tag, "pt-BR"))
    .slice(0, limit);
}

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Catalogue search: accent-blind matching over title, tagline, creator, city
// and tags, plus "tags near what was typed" for the empty state.

import type { Game, TrackId } from "@/data/base";
import { fold } from "@/components/etiquetas/slug";
import { tagIndex, type TagInfo } from "@/components/etiquetas/tags";

/** The words of a query, folded; every word must match somewhere. */
export const terms = (q: string) => fold(q).split(/\s+/).filter(Boolean).slice(0, 8);

const hayCache = new WeakMap<Game, string>();

/** Everything a game can be found by, folded into one string. */
export function haystack(g: Game): string {
  let hay = hayCache.get(g);
  if (hay === undefined) {
    hay = fold([g.title, g.tagline, g.creatorName ?? "", ...g.tags].join(" · "));
    hayCache.set(g, hay);
  }
  return hay;
}

/** What a game asks for, for sorting by price: free is 0, pay-what-you-want counts its minimum. */
export const priceValue = (g: Game) => (g.price.kind === "fixed" ? g.price.amount : g.price.kind === "pwyw" ? g.price.minimum : 0);

/** Edit distance, capped: returns cap + 1 as soon as the words are further apart than cap. */
function distance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** How close a tag is to one typed word: 3 contains it, 2 a typo away, 1 same start, 0 unrelated. */
function closeness(tag: string, word: string): number {
  const t = fold(tag);
  if (word.length >= 2 && (t.includes(word) || (word.includes(t) && t.length >= 3))) return 3;
  const cap = word.length >= 6 ? 2 : word.length >= 4 ? 1 : 0;
  if (cap && t.split(/[\s-]+/).some((part) => distance(part, word, cap) <= cap)) return 2;
  if (word.length >= 3 && t.startsWith(word.slice(0, 3))) return 1;
  return 0;
}

/**
 * Tags to offer when a search or filter finds nothing. Close spellings of the
 * words typed come first; with nothing close, the most used tags of the
 * chosen track (or of the whole catalogue).
 */
export function nearTags(games: readonly Game[], words: string[], track: TrackId | null, limit = 8): TagInfo[] {
  const all = tagIndex(games);
  if (words.length) {
    const scored = all
      .map((t) => ({ t, score: Math.max(...words.map((w) => closeness(t.tag, w))) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.t.count - a.t.count)
      .map((x) => x.t);
    if (scored.length) return scored.slice(0, limit);
  }
  const pool = track ? games.filter((g) => g.track === track) : games;
  const inPool = (t: TagInfo) => t.games.filter((g) => pool.includes(g)).length;
  return all
    .map((t) => ({ t, n: inPool(t) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.t.tag.localeCompare(b.t.tag, "pt-BR"))
    .slice(0, limit)
    .map((x) => x.t);
}

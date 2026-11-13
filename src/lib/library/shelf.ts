import "server-only";
import {
  CREATORS,
  GAMES,
  PLATFORMS,
  creatorBySlug,
  gameBySlug,
  gamesByCreator,
  shortPrice,
  trackById,
  type Game,
  type Platform,
} from "@/data/catalog";
import type { ShelfData, ShelfGame, ShelfPerson } from "@/components/library/shelf-types";
import type { ShelfItem } from "./rules";

const ALL: Platform[] = ["web", "windows", "macos", "linux", "android"];
const SUGGESTIONS = 4;

function row(g: Game): ShelfGame {
  const t = trackById(g.track);
  return {
    slug: g.slug,
    number: String(g.number).padStart(4, "0"),
    title: g.title,
    tagline: g.tagline,
    creator: g.creator,
    creatorName: creatorBySlug(g.creator)?.name ?? "",
    track: { name: t.name, color: t.color, on: t.on },
    platforms: ALL.map((p) => ({ code: PLATFORMS[p].code, name: PLATFORMS[p].name, on: g.platforms.includes(p) })),
    price: shortPrice(g.price),
    published: g.published,
  };
}

function person(slug: string, at?: string): ShelfPerson | null {
  const c = creatorBySlug(slug);
  if (!c) return null;
  return { slug, name: c.name, city: c.city, count: GAMES.filter((g) => g.creator === slug).length, at };
}

const isPerson = (p: ShelfPerson | null): p is ShelfPerson => p !== null;

/**
 * Monta, no servidor, só os campos que cada linha da estante imprime. As
 * Novidades levam os jogos de quem você segue e das sugestões, para que
 * seguir alguém ali mesmo já traga os jogos dessa pessoa sem outra ida ao servidor.
 */
export function shelfData(saves: ShelfItem[], follows: ShelfItem[]): ShelfData {
  const saved = saves.flatMap((s) => {
    const g = gameBySlug(s.slug);
    return g ? [{ game: row(g), at: s.at }] : [];
  });
  const following = follows.map((f) => person(f.slug, f.at)).filter(isPerson);
  const suggested =
    following.length > 0
      ? []
      : [...new Set(saves.map((s) => gameBySlug(s.slug)?.creator).filter((c): c is string => Boolean(c)))]
          .slice(0, SUGGESTIONS)
          .map((slug) => person(slug))
          .filter(isPerson);
  const creators = new Set([...following, ...suggested].map((p) => p.slug));
  const news = [...creators]
    .flatMap((slug) => gamesByCreator(slug))
    .sort((a, b) => +new Date(b.published) - +new Date(a.published))
    .map(row);
  return { saved, following, suggested, news };
}

/** Criadores do programa para a estante vazia, com quantos jogos cada um tem. */
export function programmeCreators(): ShelfPerson[] {
  return CREATORS.map((c) => person(c.slug)).filter(isPerson);
}

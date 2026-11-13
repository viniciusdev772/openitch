import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Catalog, Game } from "@/data/catalog";
import { trackById } from "@/data/catalog";
import { Cover } from "@/components/Cover";
import { trackStyle } from "@/components/bits";
import { colecaoCurator, colecaoEntries, type Colecao } from "@/data/colecoes";

/** "1 jogo", "5 jogos", with the number in the programme's numeral face. */
export function GameCount({ n }: { n: number }) {
  return (
    <>
      <span className="num">{n}</span> {n === 1 ? "jogo" : "jogos"}
    </>
  );
}

/** Field class for a block: paper text and lime focus on ultramarine. */
export function fieldClass(c: Colecao) {
  return trackById(c.track).on === "--paper" ? "on-field" : "";
}

/** The first covers of a block, framed like row thumbnails. Decorative: the titles carry the names. */
export function MiniCovers({ games }: { games: Game[] }) {
  return (
    <span className="col-covers" aria-hidden>
      {games.map((g) => (
        <span key={g.slug} className="col-cover">
          <Cover game={g} label="" />
        </span>
      ))}
    </span>
  );
}

/**
 * One block as a ruled programme row: game count in the numeral column,
 * title, intro and curator, then the first three covers. The row fills with
 * the block's track field on hover.
 */
export function ColecaoRow({ cat, c, headingLevel = 3 }: { cat: Catalog; c: Colecao; headingLevel?: 2 | 3 }) {
  const entries = colecaoEntries(cat, c);
  const H = `h${headingLevel}` as "h2" | "h3";
  return (
    <li>
      <Link href={`/colecoes/${c.slug}`} className="col-row" style={trackStyle(c.track)}>
        <span className="col-row-count">
          <span className="num">{entries.length}</span>
          <small>{entries.length === 1 ? "jogo" : "jogos"}</small>
        </span>
        <div className="col-row-text">
          <H>{c.title}</H>
          <p className="col-row-intro">{c.intro}</p>
          <p className="col-row-by">Curadoria: {colecaoCurator(cat, c).name}</p>
        </div>
        <MiniCovers games={entries.slice(0, 3).map((e) => e.game)} />
        <ArrowRight aria-hidden className="col-row-arrow" />
      </Link>
    </li>
  );
}

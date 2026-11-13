import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/jams-criadores.css";
import { CREATORS, GAMES, TRACKS, type Creator, type Game, type TrackId, formatDate } from "@/data/catalog";
import { trackStyle } from "@/components/bits";

export const metadata: Metadata = {
  title: "Criadores",
  description: "Todas as pessoas, duplas e coletivos que publicam no programa, com cidade, jogos e trilhas.",
};

type Props = { searchParams: Promise<{ ordem?: string | string[] }> };
type Order = "recentes" | "az";

type Row = {
  creator: Creator;
  games: Game[];
  latest?: Game;
  tracks: TrackId[];
  main?: TrackId;
};

/** One roster row per creator: their games, the newest one, and the tracks they publish in. */
function roster(): Row[] {
  return CREATORS.map((creator) => {
    const games = GAMES.filter((g) => g.creator === creator.slug).sort(
      (a, b) => +new Date(b.published) - +new Date(a.published),
    );
    const tally = new Map<TrackId, number>();
    for (const g of games) tally.set(g.track, (tally.get(g.track) ?? 0) + 1);
    const tracks = TRACKS.map((t) => t.id).filter((id) => tally.has(id));
    // Main track: the one they publish in most; ties go to the newest game's track.
    const main = [...tracks].sort((a, b) => (tally.get(b) ?? 0) - (tally.get(a) ?? 0))[0];
    const top = games[0] && tally.get(games[0].track) === tally.get(main) ? games[0].track : main;
    return { creator, games, latest: games[0], tracks, main: top };
  });
}

/** Day and short month for the numeral column, in the programme's time zone. */
function dayMonth(iso: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).formatToParts(
    new Date(iso),
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: get("day"), month: get("month").replace(".", "") };
}

const ORDERS: { id: Order; label: string; href: string }[] = [
  { id: "recentes", label: "Mais recentes", href: "/criadores" },
  { id: "az", label: "A–Z", href: "/criadores?ordem=az" },
];

export default async function CreatorsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const order: Order = sp.ordem === "az" ? "az" : "recentes";
  const rows = roster().sort((a, b) =>
    order === "az"
      ? a.creator.name.localeCompare(b.creator.name, "pt-BR", { sensitivity: "base" })
      : +new Date(b.latest?.published ?? 0) - +new Date(a.latest?.published ?? 0),
  );

  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <h1>Criadores</h1>
          <p>Quem publica no programa: pessoas, duplas e coletivos. Cada nome abre a página com todos os jogos de quem fez.</p>
        </div>
      </header>

      <section className="wrap roster-wrap" aria-labelledby="lista-criadores">
        <h2 id="lista-criadores" className="visually-hidden">
          Lista de criadores
        </h2>
        <div className="results-bar">
          <p>
            <span className="num">{rows.length}</span> {rows.length === 1 ? "criador" : "criadores"} no programa
          </p>
          <nav className="seg seg--links" aria-label="Ordem da lista">
            {ORDERS.map((o) => (
              <Link key={o.id} href={o.href} aria-current={order === o.id ? "true" : undefined} scroll={false}>
                {o.label}
              </Link>
            ))}
          </nav>
        </div>

        <ol className="roster">
          {rows.map(({ creator, games, latest, tracks, main }) => (
            <li key={creator.slug}>
              <div className="roster-row" style={main ? trackStyle(main) : undefined}>
                <p className="roster-date">
                  {latest ? (
                    <time dateTime={latest.published} aria-label={formatDate(latest.published)}>
                      {dayMonth(latest.published).day} <small>{dayMonth(latest.published).month}</small>
                    </time>
                  ) : (
                    <span aria-hidden>—</span>
                  )}
                  <small>{latest ? "último jogo" : "sem jogos"}</small>
                </p>
                <div className="roster-name">
                  <h3>
                    <Link className="roster-link" href={`/criador/${creator.slug}`}>
                      {creator.name}
                    </Link>
                  </h3>
                  <p>{creator.bio}</p>
                </div>
                <p className="roster-city">{creator.city}</p>
                <p className="roster-count">
                  <b>{games.length}</b> {games.length === 1 ? "jogo" : "jogos"}
                </p>
                <ul className="roster-tracks" aria-label="Trilhas em que publica">
                  {tracks.map((id) => {
                    const t = TRACKS.find((x) => x.id === id)!;
                    return (
                      <li key={id} style={{ "--sw": `var(${t.color})` } as React.CSSProperties}>
                        <i aria-hidden />
                        <span>{t.name}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="roster-latest">
                  {latest ? (
                    <>
                      <small>Mais recente</small>
                      <Link href={`/jogo/${latest.slug}`}>{latest.title}</Link>
                    </>
                  ) : (
                    <small>Ainda sem jogos publicados</small>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

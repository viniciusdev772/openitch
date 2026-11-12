"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  CREATORS,
  GAMES,
  PLATFORMS,
  TRACKS,
  type Platform,
  type TrackId,
  shortPrice,
} from "@/data/catalog";
import Link from "next/link";
import { Entry, TrackChip, trackStyle } from "@/components/bits";
import { Cover } from "@/components/Cover";

type PriceFilter = "all" | "free" | "paid" | "pwyw";
type Sort = "new" | "az" | "price";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [track, setTrack] = useState<TrackId | null>((params.get("trilha") as TrackId) || null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [price, setPrice] = useState<PriceFilter>("all");
  const [sort, setSort] = useState<Sort>("new");

  // Keep tabs and links in sync when the URL changes from outside (thumb index).
  useEffect(() => {
    setTrack((params.get("trilha") as TrackId) || null);
    const pq = params.get("q");
    if (pq !== null) setQ(pq);
  }, [params]);

  const setTrackAndUrl = (t: TrackId | null) => {
    setTrack(t);
    const sp = new URLSearchParams(params.toString());
    if (t) sp.set("trilha", t);
    else sp.delete("trilha");
    router.replace(`/jogos${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const results = useMemo(() => {
    const nq = norm(q.trim());
    let list = GAMES.filter((g) => {
      if (track && g.track !== track) return false;
      if (platforms.length && !platforms.some((p) => g.platforms.includes(p))) return false;
      if (price === "free" && g.price.kind !== "free") return false;
      if (price === "paid" && g.price.kind !== "fixed") return false;
      if (price === "pwyw" && g.price.kind !== "pwyw") return false;
      if (nq) {
        const creator = CREATORS.find((c) => c.slug === g.creator)?.name ?? "";
        const hay = norm([g.title, g.tagline, creator, ...g.tags].join(" "));
        if (!hay.includes(nq)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title, "pt-BR");
      if (sort === "price") {
        const v = (g: (typeof GAMES)[number]) => (g.price.kind === "fixed" ? g.price.amount : g.price.kind === "pwyw" ? g.price.minimum : 0);
        return v(a) - v(b);
      }
      return +new Date(b.published) - +new Date(a.published);
    });
    return list;
  }, [q, track, platforms, price, sort]);

  const featured = results.length > 9 ? results.slice(0, 8) : results;
  const index = results.length > 9 ? results.slice(8) : [];

  const active = track ? TRACKS.find((t) => t.id === track)! : null;
  const filtersOn = !!(q || track || platforms.length || price !== "all");
  const clear = () => {
    setQ("");
    setPlatforms([]);
    setPrice("all");
    setTrackAndUrl(null);
  };

  return (
    <>
      <header className={`page-head${active?.on === "--paper" ? " on-field" : ""}`} style={active ? trackStyle(active.id) : undefined}>
        <div className="wrap">
          <h1>{active ? active.name : "Catálogo"}</h1>
          <p>{active ? active.blurb : "Todas as entradas do programa. Cada filtro é um controle à vista: nada escondido em menus."}</p>
        </div>
      </header>

      <div className="wrap catalog">
        <aside className="filters" aria-label="Filtros">
          <div id="busca">
            <label className="field-label" htmlFor="q">
              Buscar
            </label>
            <input
              id="q"
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Jogo, criador ou tag"
            />
          </div>

          <fieldset>
            <legend>Trilha</legend>
            <div className="track-toggles">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="track-toggle"
                  aria-pressed={track === t.id}
                  style={trackStyle(t.id)}
                  onClick={() => setTrackAndUrl(track === t.id ? null : t.id)}
                >
                  <span>
                    <i aria-hidden />
                    {t.name}
                  </span>
                  <small>{GAMES.filter((g) => g.track === t.id).length}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Plataforma</legend>
            <div className="platform-toggles">
              {(Object.keys(PLATFORMS) as Platform[]).map((p) => {
                const on = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    className="platform-toggle"
                    aria-pressed={on}
                    onClick={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                  >
                    <span className="code" aria-hidden>
                      {PLATFORMS[p].code}
                    </span>
                    {PLATFORMS[p].name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend>Preço</legend>
            <div className="seg">
              {(
                [
                  ["all", "Todos"],
                  ["free", "Grátis"],
                  ["paid", "Fixo"],
                  ["pwyw", "Você decide"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={price === k} onClick={() => setPrice(k)}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset style={{ borderBottom: 0 }}>
            <legend>Ordem</legend>
            <div className="seg">
              {(
                [
                  ["new", "Mais novos"],
                  ["az", "A–Z"],
                  ["price", "Preço"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
        </aside>

        <section aria-label="Resultados">
          <div className="results-bar">
            <p aria-live="polite">
              <span className="num">{results.length}</span> {results.length === 1 ? "entrada" : "entradas"}
              {q && <> para “{q}”</>}
            </p>
            {filtersOn && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={clear}>
                <X aria-hidden /> Limpar filtros
              </button>
            )}
          </div>

          {results.length ? (
            <>
              <div className="results">
                {featured.map((g, i) => (
                  <Entry key={g.slug} game={g} variant={i === 0 ? "lead" : i === 5 ? "wide" : "card"} showTrack={!track} />
                ))}
              </div>
              {index.length > 0 && (
                <section className="index-list" aria-labelledby="indice">
                  <h2 id="indice">Índice do programa</h2>
                  <ol>
                    {index.map((g) => (
                      <li key={g.slug}>
                        <Link href={`/jogo/${g.slug}`} style={trackStyle(g.track)}>
                          <span className="no">{String(g.number).padStart(4, "0")}</span>
                          <span className="thumb">
                            <Cover game={g} label="" />
                          </span>
                          <span>
                            <h3>{g.title}</h3>
                            <p>{g.tagline}</p>
                          </span>
                          <TrackChip id={g.track} />
                          <span className="price-tag">{shortPrice(g.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          ) : (
            <div className="empty">
              <h2>Nada nesta combinação</h2>
              <p>Nenhuma entrada atende a todos os filtros. Tire um deles ou busque por outra palavra.</p>
              <button type="button" className="btn" onClick={clear}>
                Limpar filtros
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { PLATFORMS, TRACKS, type Game, type Platform, type TrackId, shortPrice } from "@/data/base";
import { Entry, TrackChip, trackStyle } from "@/components/bits";
import { Cover } from "@/components/Cover";
import { tagBySlug, tagIndex, type TagInfo } from "@/components/etiquetas/tags";
import { haystack, nearTags, priceValue, terms } from "./search";

type PriceFilter = "all" | "gratis" | "pago" | "livre";
type Sort = "recentes" | "az" | "preco";

const PRICES: [PriceFilter, string][] = [
  ["all", "Todos"],
  ["gratis", "Grátis"],
  ["pago", "Pago"],
  ["livre", "Pague o que quiser"],
];
const SORTS: [Sort, string][] = [
  ["recentes", "Mais recentes"],
  ["az", "A-Z"],
  ["preco", "Preço"],
];
const PLATFORM_IDS = Object.keys(PLATFORMS) as Platform[];
const TOP_TAGS = 8;
const MAX_Q = 80;

/** Everything the catalogue shows, read from the address. Unknown values are dropped. */
type Filters = {
  q: string;
  track: TrackId | null;
  platforms: Platform[];
  price: PriceFilter;
  sort: Sort;
  tag: TagInfo | null;
};

function readFilters(games: readonly Game[], sp: URLSearchParams): Filters {
  const t = sp.get("trilha");
  const p = sp.get("preco");
  const o = sp.get("ordem");
  const tag = sp.get("etiqueta");
  return {
    q: (sp.get("q") ?? "").slice(0, MAX_Q),
    track: TRACKS.some((x) => x.id === t) ? (t as TrackId) : null,
    platforms: PLATFORM_IDS.filter((id) => (sp.get("plataforma") ?? "").split(",").includes(id)),
    price: PRICES.some(([k]) => k === p && k !== "all") ? (p as PriceFilter) : "all",
    sort: SORTS.some(([k]) => k === o) ? (o as Sort) : "recentes",
    tag: tag ? (tagBySlug(games, tag) ?? null) : null,
  };
}

/** The address for a set of filters, defaults left out, always in the same order. */
function hrefFor(f: Filters): string {
  const sp = new URLSearchParams();
  const q = f.q.trim();
  if (q) sp.set("q", q);
  if (f.tag) sp.set("etiqueta", f.tag.slug);
  if (f.track) sp.set("trilha", f.track);
  if (f.platforms.length) sp.set("plataforma", f.platforms.join(","));
  if (f.price !== "all") sp.set("preco", f.price);
  if (f.sort !== "recentes") sp.set("ordem", f.sort);
  const s = sp.toString();
  return `/jogos${s ? `?${s}` : ""}`;
}

function matches(g: Game, f: Filters, qTerms: string[], ignore: { q?: boolean; rest?: boolean } = {}) {
  if (!ignore.rest) {
    if (f.track && g.track !== f.track) return false;
    if (f.platforms.length && !f.platforms.some((p) => g.platforms.includes(p))) return false;
    if (f.price === "gratis" && g.price.kind !== "free") return false;
    if (f.price === "pago" && g.price.kind !== "fixed") return false;
    if (f.price === "livre" && g.price.kind !== "pwyw") return false;
    if (f.tag && !f.tag.games.some((x) => x.slug === g.slug)) return false;
  }
  if (!ignore.q && qTerms.length) {
    const hay = haystack(g);
    if (!qTerms.every((t) => hay.includes(t))) return false;
  }
  return true;
}

/** The catalogue with its filters. `games` is the published programme, newest first, as the server loaded it. */
export function Catalog({ games }: { games: Game[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const filters = useMemo(() => readFilters(games, new URLSearchParams(params.toString())), [games, params]);

  // The search box types ahead of the address; the address follows after a pause.
  const [q, setQ] = useState(filters.q);
  const written = useRef(filters.q);
  useEffect(() => {
    // The address changed from outside (back button, a link, "Limpar"): follow it.
    // Compared trimmed: the address drops the trailing space of a word still being typed.
    if (filters.q.trim() !== written.current.trim()) {
      written.current = filters.q;
      setQ(filters.q);
    }
  }, [filters.q]);
  // The other filters as last asked for: the address, or a toggle whose push has not landed yet.
  // The pending search write reads them here when it fires, never from the render it was set in.
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  }, [filters]);
  const typing = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (q.trim() === written.current.trim()) return;
    const id = setTimeout(() => {
      typing.current = undefined;
      // A toggle may have written this text already (it carries the box's text along).
      if (q.trim() === written.current.trim()) return;
      written.current = q;
      router.replace(hrefFor({ ...latest.current, q }), { scroll: false });
    }, 300);
    typing.current = id;
    return () => clearTimeout(id);
  }, [q, router]);

  const live: Filters = { ...filters, q };
  /** Toggles and choices add a history step, so the back button undoes them one by one. */
  const go = (next: Partial<Filters>) => {
    const f = { ...live, ...next };
    // The text goes along with this step: a search write still waiting would only repeat it, with stale filters.
    clearTimeout(typing.current);
    typing.current = undefined;
    written.current = f.q;
    latest.current = f;
    if (next.q !== undefined) setQ(next.q);
    router.push(hrefFor(f), { scroll: false });
  };

  const qTerms = useMemo(() => terms(q), [q]);

  const results = useMemo(() => {
    const list = games.filter((g) => matches(g, filters, qTerms));
    return list.sort((a, b) => {
      if (filters.sort === "az") return a.title.localeCompare(b.title, "pt-BR");
      if (filters.sort === "preco") {
        const d = priceValue(a) - priceValue(b);
        if (d) return d;
      }
      return +new Date(b.published) - +new Date(a.published);
    });
  }, [games, filters, qTerms]);

  const featured = results.length > 9 ? results.slice(0, 8) : results;
  const index = results.length > 9 ? results.slice(8) : [];

  const active = filters.track ? TRACKS.find((t) => t.id === filters.track)! : null;
  const narrowed = !!(filters.track || filters.platforms.length || filters.price !== "all" || filters.tag);
  const filtersOn = !!(q.trim() || narrowed);
  const clear = () => go({ q: "", track: null, platforms: [], price: "all", tag: null });

  // Tags offered as filter toggles: the most used, plus the active one if it is not among them.
  const topTags = useMemo(() => {
    const top = [...tagIndex(games)].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR")).slice(0, TOP_TAGS);
    return filters.tag && !top.some((t) => t.slug === filters.tag!.slug) ? [filters.tag, ...top] : top;
  }, [games, filters.tag]);

  // Empty state helpers: what the search finds without the other filters, and tags near the words typed.
  const withoutFilters = useMemo(
    () => (qTerms.length && narrowed ? games.filter((g) => matches(g, filters, qTerms, { rest: true })).length : 0),
    [games, filters, qTerms, narrowed],
  );
  const near = useMemo(
    () => (results.length ? [] : nearTags(games, qTerms, filters.track)),
    [games, results.length, qTerms, filters.track],
  );

  const summary = (
    <>
      <span className="num">{results.length}</span> {results.length === 1 ? "entrada" : "entradas"}
      {filters.tag && <> com a etiqueta "{filters.tag.tag}"</>}
      {q.trim() && <> para "{q.trim()}"</>}
    </>
  );

  return (
    <>
      <header className={`page-head${active?.on === "--paper" ? " on-field" : ""}`} style={active ? trackStyle(active.id) : undefined}>
        <div className="wrap">
          <h1>{active ? active.name : "Catálogo"}</h1>
          <p>{active ? active.blurb : "Todas as entradas do programa, com todos os filtros à vista."}</p>
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
              maxLength={MAX_Q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Jogo, criador, cidade ou etiqueta"
              aria-describedby="q-hint"
            />
            <p id="q-hint" className="field-hint">
              Acentos e maiúsculas não contam.
            </p>
          </div>

          <fieldset>
            <legend>Trilha</legend>
            <div className="track-toggles">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="track-toggle"
                  aria-pressed={filters.track === t.id}
                  style={trackStyle(t.id)}
                  onClick={() => go({ track: filters.track === t.id ? null : t.id })}
                >
                  <span>
                    <i aria-hidden />
                    {t.name}
                  </span>
                  <small>{games.filter((g) => g.track === t.id).length}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Etiqueta</legend>
            <div className="tag-toggles">
              {topTags.map((t) => {
                const on = filters.tag?.slug === t.slug;
                return (
                  <button key={t.slug} type="button" aria-pressed={on} onClick={() => go({ tag: on ? null : t })}>
                    {t.tag} <span className="num">{t.count}</span>
                  </button>
                );
              })}
            </div>
            <Link className="tag-all" href="/etiquetas">
              Todas as {tagIndex(games).length} etiquetas <ArrowRight aria-hidden />
            </Link>
          </fieldset>

          <fieldset>
            <legend>Plataforma</legend>
            <div className="platform-toggles">
              {PLATFORM_IDS.map((p) => {
                const on = filters.platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    className="platform-toggle"
                    aria-pressed={on}
                    onClick={() => go({ platforms: on ? filters.platforms.filter((x) => x !== p) : [...filters.platforms, p] })}
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
              {PRICES.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={filters.price === k} onClick={() => go({ price: k })}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset style={{ borderBottom: 0 }}>
            <legend>Ordem</legend>
            <div className="seg">
              {SORTS.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={filters.sort === k} onClick={() => go({ sort: k })}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
        </aside>

        <section aria-label="Resultados">
          <div className="results-bar">
            <p aria-live="polite" aria-atomic="true">
              {summary}
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
                  <Entry
                    key={g.slug}
                    game={g}
                    variant={i === 0 ? "lead" : i === 5 ? "wide" : "card"}
                    showTrack={!filters.track}
                    showTags
                  />
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
            <div className="empty catalog-empty">
              <h2>Nada nesta combinação</h2>
              <p>
                {q.trim() && !narrowed
                  ? `Nenhum título, criador, cidade ou etiqueta tem "${q.trim()}". Confira a grafia ou tente uma palavra mais curta.`
                  : "Nenhuma entrada atende a todos os filtros ao mesmo tempo. Tire um deles ou busque por outra palavra."}
              </p>
              <div className="catalog-empty-actions">
                {withoutFilters > 0 && (
                  <button type="button" className="btn" onClick={() => go({ track: null, platforms: [], price: "all", tag: null })}>
                    Ver {withoutFilters} {withoutFilters === 1 ? "entrada" : "entradas"} com "{q.trim()}" sem os outros filtros
                  </button>
                )}
                <button type="button" className={withoutFilters > 0 ? "btn btn--ghost" : "btn"} onClick={clear}>
                  Limpar filtros
                </button>
              </div>
              {near.length > 0 && (
                <div className="catalog-near">
                  <h3>{qTerms.length ? "Etiquetas parecidas com a busca" : "Etiquetas por perto"}</h3>
                  <ul className="tags">
                    {near.map((t) => (
                      <li key={t.slug}>
                        <Link href={`/etiqueta/${t.slug}`}>
                          {t.tag} <span className="num">{t.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {filters.tag && results.length > 0 && (
            <p className="catalog-tag-note">
              Etiqueta "{filters.tag.tag}": <Link href={`/etiqueta/${filters.tag.slug}`}>ver a página da etiqueta</Link>, com as
              trilhas e as etiquetas que aparecem junto.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

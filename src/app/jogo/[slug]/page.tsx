import "@/styles/estante.css";
import "@/styles/jogo.css";
import type { Metadata } from "next";
import Link from "next/link";
import { tagHref } from "@/components/etiquetas/slug";
import { notFound } from "next/navigation";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import {
  GAMES,
  PLATFORMS,
  creatorBySlug,
  entryNumber,
  formatDate,
  formatPrice,
  gameBySlug,
  jamBySlug,
  trackById,
} from "@/data/catalog";
import { Cover } from "@/components/Cover";
import { OrbitaGame } from "@/components/OrbitaGame";
import { Entry, PlatformCodes, TrackChip, trackStyle } from "@/components/bits";
import { LibraryButton } from "@/components/library/LibraryButton";
import { LibraryState } from "@/components/library/LibraryState";
import { BuyCard } from "./BuyCard";
import { Controls, DayNumeral, gameLog } from "./parts";

/*
 * Página estática (generateStaticParams, nenhuma API de pedido). O que muda
 * por visitante (Guardar / Seguir) mora na ilha <LibraryState>, que lê o
 * estado no cliente com uma só requisição.
 */

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = gameBySlug(slug);
  return g ? { title: g.title, description: g.tagline } : {};
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const game = gameBySlug(slug);
  if (!game) notFound();
  const creator = creatorBySlug(game.creator)!;
  const track = trackById(game.track);
  const more = GAMES.filter((g) => g.creator === game.creator && g.slug !== game.slug);
  const related = more.length ? more : GAMES.filter((g) => g.track === game.track && g.slug !== game.slug).slice(0, 4);
  const playable = game.platforms.includes("web");
  const controls = game.controls ?? [];
  const access = game.accessibility ?? [];
  const notes = game.contentNotes ?? [];
  const credits = game.credits ?? [];
  const log = gameLog(game);

  return (
    <LibraryState game={game.slug} creator={creator.slug}>
      <section id="palco" className={`game-stage${track.on === "--paper" ? " on-field" : ""}`} style={trackStyle(game.track)}>
        <div className="wrap">
          <nav className="crumbs" aria-label="Trilha de navegação">
            <Link href="/jogos">Catálogo</Link>
            <span aria-hidden>/</span>
            <Link href={`/jogos?trilha=${track.id}`}>{track.name}</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{game.title}</span>
          </nav>
          {game.playable === "orbita" ? (
            <div className="stage-frame stage-frame--game">
              <OrbitaGame label={`${game.title}, jogo de navegador`} />
            </div>
          ) : (
            <div className="stage-frame stage-frame--art">
              <div className="stage-art" style={{ "--g": `var(${game.palette[0]})` } as React.CSSProperties}>
                <Cover game={game} fit="meet" />
              </div>
              <div className="stage-launch">
                <p>
                  {playable
                    ? "Este jogo roda no navegador. A build de amostra não acompanha esta demonstração."
                    : `Disponível para ${game.platforms.map((p) => PLATFORMS[p].name).join(", ")}. Baixe ao lado.`}
                </p>
                {playable && (
                  <span className="btn btn--lime btn--sm" aria-disabled="true">
                    Jogar no navegador
                  </span>
                )}
              </div>
            </div>
          )}
          {notes.length > 0 && (
            <aside className="stage-notes" id="avisos" aria-labelledby="avisos-titulo">
              <TriangleAlert aria-hidden />
              <h2 id="avisos-titulo">Avisos de conteúdo</h2>
              <ul>
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </section>

      <div className="wrap game-body" id="palco-info">
        <article>
          <header className="game-title">
            <div className="meta">
              <span className="num game-no">{entryNumber(game.number)}</span>
              <TrackChip id={game.track} />
              <PlatformCodes platforms={game.platforms} />
            </div>
            <h1>{game.title}</h1>
            <p className="tagline">{game.tagline}</p>
            <p className="by">
              por <Link href={`/criador/${creator.slug}`}>{creator.name}</Link>
            </p>
          </header>

          <div className="prose">
            {game.description.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {(controls.length > 0 || access.length > 0) && (
            <section className="game-part game-how" aria-labelledby="como-jogar">
              <h2 id="como-jogar">Como jogar</h2>
              <div className="game-how-cols">
                {controls.length > 0 && (
                  <div>
                    <h3>Controles</h3>
                    <Controls lines={controls} />
                  </div>
                )}
                {access.length > 0 && (
                  <div>
                    <h3>Acessibilidade</h3>
                    <ul className="game-access">
                      {access.map((a) => (
                        <li key={a}>
                          <Check aria-hidden />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          <dl className="details">
            <dt>Preço</dt>
            <dd>{formatPrice(game.price)}</dd>
            <dt>Publicado</dt>
            <dd>{formatDate(game.published)}</dd>
            <dt>Atualizado</dt>
            <dd>{formatDate(game.updated)}</dd>
            <dt>Duração</dt>
            <dd>{game.session}</dd>
            <dt>Idiomas</dt>
            <dd>{game.languages.join(", ")}</dd>
            <dt>Tags</dt>
            <dd>
              <span className="tags">
                {game.tags.map((t) => (
                  <Link key={t} href={tagHref(t) ?? `/jogos?q=${encodeURIComponent(t)}`}>
                    {t}
                  </Link>
                ))}
              </span>
            </dd>
            {game.jam && (
              <>
                <dt>Jam</dt>
                <dd>
                  <Link href={`/jams/${game.jam}`}>Entrada da {jamBySlug(game.jam)?.title ?? "jam"}</Link>
                </dd>
              </>
            )}
          </dl>
        </article>

        <aside className="buy" aria-label="Obter o jogo">
          <BuyCard
            price={game.price}
            title={game.title}
            downloads={game.downloads.map((d) => ({ ...d, code: PLATFORMS[d.platform].code, name: PLATFORMS[d.platform].name }))}
            playable={playable}
            save={<LibraryButton kind="save" slug={game.slug} />}
          />
          <div className="creator-card">
            <Link className="name" href={`/criador/${creator.slug}`}>
              {creator.name}
            </Link>
            <p>
              {creator.city}. {creator.bio}
            </p>
            <LibraryButton kind="follow" slug={creator.slug} name={creator.name} small />
          </div>
        </aside>
      </div>

      {(log.length > 0 || credits.length > 0) && (
        <div className="wrap game-after">
          {log.length > 0 && (
            <section className="game-part" aria-labelledby="diario">
              <h2 id="diario">Diário do jogo</h2>
              <ol className="game-log">
                {log.map((n) => (
                  <li key={`${n.date}-${n.title}`}>
                    <DayNumeral iso={n.date} />
                    <div>
                      <h3>{n.title}</h3>
                      <p>{n.body}</p>
                      {n.href && (
                        <Link href={n.href} className="game-log-more">
                          Ler a nota completa
                          <span className="visually-hidden">: {n.title}</span>
                          <ArrowRight aria-hidden />
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {credits.length > 0 && (
            <section className="game-part" aria-labelledby="ficha">
              <h2 id="ficha">Ficha técnica</h2>
              <dl className="credits">
                {credits.map((c) => (
                  <div key={`${c.role}-${c.name}`}>
                    <dt>{c.role}</dt>
                    <dd>{c.name}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}

      {related.length > 0 && (
        <section className="wrap more" aria-labelledby="mais">
          <h2 id="mais">{more.length ? `Mais de ${creator.name}` : `Mais em ${track.name}`}</h2>
          <div className="more-grid">
            {related.map((g) => (
              <Entry key={g.slug} game={g} />
            ))}
          </div>
        </section>
      )}
    </LibraryState>
  );
}

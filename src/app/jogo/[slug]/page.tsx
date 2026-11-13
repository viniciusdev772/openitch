import "@/styles/estante.css";
import "@/styles/jogo.css";
import type { Metadata } from "next";
import Link from "next/link";
import { tagHref } from "@/components/etiquetas/slug";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, Check, Play, TriangleAlert } from "lucide-react";
import { PLATFORMS, entryNumber, formatDate, formatPrice, jamBySlug, trackById } from "@/data/catalog";
import { getCatalog, movedSlug } from "@/lib/catalog/server";
import { creatorLine } from "@/components/creatorLine";
import { Cover } from "@/components/Cover";
import { Entry, PlatformCodes, TrackChip, trackStyle } from "@/components/bits";
import { LibraryButton } from "@/components/library/LibraryButton";
import { LibraryState } from "@/components/library/LibraryState";
import { OwnerBar } from "@/components/library/OwnerBar";
import { BuyCard } from "./BuyCard";
import { Controls, DayNumeral, gameLog } from "./parts";

/*
 * Página sem API de pedido: renderizada na primeira visita e guardada
 * (revalidate), refeita na hora quando o jogo é publicado, editado ou sai do
 * ar. O que muda por visitante (Guardar / Seguir) mora na ilha
 * <LibraryState>, que lê o estado no cliente com uma só requisição.
 */

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = (await getCatalog()).gameBySlug(slug);
  return g ? { title: g.title, description: g.tagline } : {};
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const game = catalog.gameBySlug(slug);
  if (!game) {
    // Endereço antigo de um jogo que mudou de endereço: leva ao atual.
    const moved = await movedSlug(slug);
    if (moved) permanentRedirect(`/jogo/${moved}`);
    notFound();
  }
  const creator = catalog.creatorBySlug(game.creator);
  if (!creator) notFound();
  const track = trackById(game.track);
  const more = catalog.gamesByCreator(game.creator).filter((g) => g.slug !== game.slug);
  const related = more.length ? more : catalog.games.filter((g) => g.track === game.track && g.slug !== game.slug).slice(0, 4);
  const playable = Boolean(game.play);
  const controls = game.controls ?? [];
  const access = game.accessibility ?? [];
  const notes = game.contentNotes ?? [];
  const credits = game.credits ?? [];
  const log = gameLog(game);

  return (
    <LibraryState game={game.slug} creator={creator.slug}>
      <OwnerBar title={game.title} />
      <section id="palco" className={`game-stage${track.on === "--paper" ? " on-field" : ""}`} style={trackStyle(game.track)}>
        <div className="wrap">
          <nav className="crumbs" aria-label="Trilha de navegação">
            <Link href="/jogos">Catálogo</Link>
            <span aria-hidden>/</span>
            <Link href={`/jogos?trilha=${track.id}`}>{track.name}</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{game.title}</span>
          </nav>
            <div className="stage-frame stage-frame--art">
              <div className="stage-art" style={{ "--g": `var(${game.palette[0]})` } as React.CSSProperties}>
                <Cover game={game} fit="meet" />
              </div>
              <div className="stage-launch">
                <p>
                  {playable
                    ? "Este jogo roda no navegador, sem instalar nada. Abre numa tela própria, com tela cheia."
                    : game.platforms.length
                      ? `Disponível para ${game.platforms.map((p) => PLATFORMS[p].name).join(", ")}. Baixe ao lado.`
                      : "Os arquivos deste jogo estão sendo trocados. Volte em instantes."}
                </p>
                {game.play && (
                  <Link href={game.play} className="btn btn--lime btn--sm">
                    <Play aria-hidden /> Jogar no navegador
                  </Link>
                )}
              </div>
            </div>
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
            {game.session && (
              <>
                <dt>Duração</dt>
                <dd>{game.session}</dd>
              </>
            )}
            {game.languages.length > 0 && (
              <>
                <dt>Idiomas</dt>
                <dd>{game.languages.join(", ")}</dd>
              </>
            )}
            {game.tags.length > 0 && (
              <>
                <dt>Etiquetas</dt>
                <dd>
                  <span className="tags">
                    {game.tags.map((t) => (
                      <Link key={t} href={tagHref(t) ?? `/jogos?q=${encodeURIComponent(t)}`}>
                        {t}
                      </Link>
                    ))}
                  </span>
                </dd>
              </>
            )}
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
            downloads={game.downloads.map((d) => ({
              file: d.file,
              size: d.size,
              href: d.href ?? null,
              code: PLATFORMS[d.platform].code,
              name: PLATFORMS[d.platform].name,
            }))}
            play={game.play ?? null}
            save={<LibraryButton kind="save" slug={game.slug} />}
          />
          <div className="creator-card">
            <Link className="name" href={`/criador/${creator.slug}`}>
              {creator.name}
            </Link>
            <p>{creatorLine(creator)}</p>
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

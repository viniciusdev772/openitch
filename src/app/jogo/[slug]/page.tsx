import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GAMES,
  PLATFORMS,
  creatorBySlug,
  entryNumber,
  formatDate,
  formatPrice,
  gameBySlug,
  trackById,
} from "@/data/catalog";
import { Cover } from "@/components/Cover";
import { OrbitaGame } from "@/components/OrbitaGame";
import { Entry, PlatformCodes, TrackChip, trackStyle } from "@/components/bits";
import { BuyCard } from "./BuyCard";

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

  return (
    <>
      <section className={`game-stage${track.on === "--paper" ? " on-field" : ""}`} style={trackStyle(game.track)}>
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
        </div>
      </section>

      <div className="wrap game-body">
        <article>
          <header className="game-title">
            <div className="meta">
              <span className="num" style={{ fontSize: "1.125rem", color: "var(--ink)" }}>
                {entryNumber(game.number)}
              </span>
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
                  <Link key={t} href={`/jogos?q=${encodeURIComponent(t)}`}>
                    {t}
                  </Link>
                ))}
              </span>
            </dd>
            {game.jam && (
              <>
                <dt>Jam</dt>
                <dd>
                  <Link href={`/jams#${game.jam}`}>Entrada da Mini Jam Silêncio</Link>
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
          />
          <div className="creator-card">
            <span className="field-label" style={{ marginBottom: 0 }}>
              Quem fez
            </span>
            <Link className="name" href={`/criador/${creator.slug}`}>
              {creator.name}
            </Link>
            <p>
              {creator.city}. {creator.bio}
            </p>
          </div>
        </aside>
      </div>

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
    </>
  );
}

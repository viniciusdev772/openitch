import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Play } from "lucide-react";
import "@/styles/colecoes.css";
import { entryNumber, shortPrice, type Catalog } from "@/data/catalog";
import { getCatalog } from "@/lib/catalog/server";
import { creatorLine } from "@/components/creatorLine";
import { Cover } from "@/components/Cover";
import { PlatformCodes, trackStyle } from "@/components/bits";
import {
  COLECOES,
  colecaoBySlug,
  colecaoCurator,
  colecaoEntries,
  colecoesWithGame,
  type Colecao,
} from "@/data/colecoes";
import { ColecaoRow, GameCount, fieldClass } from "@/components/colecoes/parts";

type Props = { params: Promise<{ slug: string }> };

// Only the blocks in the programme exist; any other address is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return COLECOES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = colecaoBySlug(slug);
  if (!c) return { title: "Coleção não encontrada" };
  return {
    title: `${c.title} · Coleções`,
    description: c.intro,
    alternates: { canonical: `/colecoes/${c.slug}` },
  };
}

export default async function ColecaoPage({ params }: Props) {
  const { slug } = await params;
  const c = colecaoBySlug(slug);
  if (!c) notFound();

  const cat = await getCatalog();
  const entries = colecaoEntries(cat, c);
  const curator = colecaoCurator(cat, c);
  const others = COLECOES.filter((o) => o.slug !== c.slug);

  return (
    <>
      <header className={`page-head col-head ${fieldClass(c)}`} style={trackStyle(c.track)}>
        <div className="wrap">
          <div className="col-head-text">
            <nav className="crumbs" aria-label="Trilha de navegação">
              <Link href="/colecoes">Coleções</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{c.title}</span>
            </nav>
            <h1>{c.title}</h1>
          </div>
          <div className="col-head-aside">
            <p>{c.intro}</p>
            <p className="col-sign">
              Curadoria:{" "}
              {curator.kind === "creator" ? (
                <Link href={`/criador/${curator.creator.slug}`}>{curator.name}</Link>
              ) : (
                curator.name
              )}{" "}
              · <GameCount n={entries.length} />
            </p>
          </div>
        </div>
      </header>

      <div className="wrap col-page">
        <section aria-labelledby="ordem">
          <h2 id="ordem" className="col-h2">
            Ordem do programa
          </h2>
          <ol className="col-order">
            {entries.map(({ game, note }, i) => {
              const maker = cat.creatorBySlug(game.creator);
              const href = `/jogo/${game.slug}`;
              const alsoIn = colecoesWithGame(game.slug).filter((o) => o.slug !== c.slug);
              return (
                <li key={game.slug} className="col-item" data-lead={i === 0 || undefined}>
                  <span className="col-no" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* The cover repeats the title link for pointer users only. */}
                  <Link href={href} className="entry-art col-art" tabIndex={-1} aria-hidden>
                    <Cover game={game} label="" />
                    {i === 0 && game.platforms.includes("web") && (
                      <span className="play-flag">
                        <Play aria-hidden fill="currentColor" /> Joga aqui
                      </span>
                    )}
                  </Link>
                  <div className="col-game">
                    <p className="entry-line">
                      <span className="num">{entryNumber(game.number)}</span>
                      <PlatformCodes platforms={game.platforms} />
                    </p>
                    <h3>
                      <Link href={href}>{game.title}</Link>
                    </h3>
                    <p className="col-tagline">{game.tagline}</p>
                    <p className="col-meta">
                      {maker && <span>{maker.name}</span>}
                      <span>{game.session}</span>
                      <span className="price-tag">{shortPrice(game.price)}</span>
                    </p>
                    {alsoIn.length > 0 && (
                      <p className="col-also">
                        Também em{" "}
                        {alsoIn.map((o, k) => (
                          <span key={o.slug}>
                            {k > 0 && ", "}
                            <Link href={`/colecoes/${o.slug}`}>{o.title}</Link>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <p className="col-note">
                    <span className="visually-hidden">Nota da curadoria: </span>
                    {note}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <CuratorNote cat={cat} c={c} />

        <section className="col-others" aria-labelledby="outras">
          <h2 id="outras" className="col-h2">
            Outras coleções
          </h2>
          <ol className="col-rows">
            {others.map((o) => (
              <ColecaoRow cat={cat} key={o.slug} c={o} />
            ))}
          </ol>
          <p className="col-back">
            <Link className="btn btn--ghost btn--sm" href="/colecoes">
              Todas as coleções <ArrowRight aria-hidden />
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}

/** Who put the block together: the creator's card, or the team's house rule. */
function CuratorNote({ cat, c }: { cat: Catalog; c: Colecao }) {
  const curator = colecaoCurator(cat, c);
  if (curator.kind === "team") {
    return (
      <aside className="col-curator" aria-labelledby="quem-montou">
        <h2 id="quem-montou">{curator.name}</h2>
        <p>
          Quem assina uma coleção não põe nela os próprios jogos. Quando um bloco precisa de um jogo de quem o montaria, ele
          sai com a assinatura da equipe do programa.
        </p>
      </aside>
    );
  }
  const { creator } = curator;
  const published = cat.gamesByCreator(creator.slug).length;
  return (
    <aside className="col-curator" aria-labelledby="quem-montou">
      <h2 id="quem-montou">{creator.name}</h2>
      <p>{creatorLine(creator)}</p>
      <Link className="col-curator-link" href={`/criador/${creator.slug}`}>
        <span>
          Página de {creator.name}
          {published > 0 && (
            <>
              , com <GameCount n={published} /> no programa
            </>
          )}
        </span>
        <ArrowRight aria-hidden />
      </Link>
    </aside>
  );
}

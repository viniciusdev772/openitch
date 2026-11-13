import "@/styles/estante.css";
import "@/styles/jogo.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { formatDay } from "@/data/catalog";
import { getCatalog } from "@/lib/catalog/server";
import { creatorLine } from "@/components/creatorLine";
import { DEVLOGS, DEVLOG_KINDS } from "@/data/devlogs";
import { Entry, Joined, TrackChip, trackStyle } from "@/components/bits";
import { LibraryButton } from "@/components/library/LibraryButton";
import { LibraryState } from "@/components/library/LibraryState";
import { OwnerBar } from "@/components/library/OwnerBar";
import { DayNumeral } from "@/app/jogo/[slug]/parts";

/*
 * Página sem API de pedido: renderizada na primeira visita e guardada
 * (revalidate), refeita quando um jogo de quem faz é publicado ou sai do ar.
 * O botão Seguir lê o estado de quem está vendo na ilha <LibraryState>.
 */

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCatalog()).creatorBySlug(slug);
  return c ? { title: c.name, description: creatorLine(c) } : {};
}

/** Só links https saem para fora; qualquer outra coisa no dado não vira link. */
const safeHref = (href: string) => {
  try {
    const u = new URL(href);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
};

const byNewest = <T,>(at: (x: T) => string) => (a: T, b: T) => +new Date(at(b)) - +new Date(at(a));

export default async function CreatorPage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const creator = catalog.creatorBySlug(slug);
  if (!creator) notFound();
  const games = catalog.gamesByCreator(slug);
  const members = creator.members ?? [];
  const links = (creator.links ?? []).flatMap((l) => {
    const href = safeHref(l.href);
    return href ? [{ label: l.label, href, host: new URL(href).hostname }] : [];
  });
  const jams = [...catalog.jamsByHost(slug)].sort(byNewest((j) => j.start));
  const notes = DEVLOGS.filter((d) => catalog.gameBySlug(d.game)?.creator === slug).sort(byNewest((d) => d.at));

  return (
    <LibraryState creator={creator.slug}>
      <OwnerBar title={creator.name} kind="profile" />
      <header className="page-head">
        <div className="wrap">
          <h1>{creator.name}</h1>
          <div className="creator-head-side">
            <p>{creatorLine(creator)}</p>
            {(members.length > 0 || links.length > 0) && (
              <dl className="creator-facts">
                {members.length > 0 && (
                  <div>
                    <dt>Quem faz</dt>
                    <dd>
                      <Joined>{members.map((m) => m)}</Joined>
                    </dd>
                  </div>
                )}
                {links.length > 0 && (
                  <div>
                    <dt>Fora daqui</dt>
                    <dd>
                      <ul className="creator-links">
                        {links.map((l) => (
                          <li key={l.href}>
                            <a href={l.href} rel="external noopener" target="_blank">
                              <span>{l.label}</span>
                              <small>{l.host}</small>
                              <ArrowUpRight aria-hidden />
                              <span className="visually-hidden"> (site externo, abre em outra aba)</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <LibraryButton kind="follow" slug={creator.slug} name={creator.name} />
          </div>
        </div>
      </header>

      <section className="wrap creator-games" aria-label="Jogos">
        <div className="results-bar">
          <p>
            <span className="num">{games.length}</span> {games.length === 1 ? "entrada" : "entradas"} no programa
          </p>
        </div>
        <div className="results">
          {games.map((g) => (
            <Entry key={g.slug} game={g} showTrack />
          ))}
        </div>
      </section>

      {(jams.length > 0 || notes.length > 0) && (
        <div className="wrap creator-more">
          {notes.length > 0 && (
            <section className="game-part" aria-labelledby="diario">
              <h2 id="diario">Diário</h2>
              <ol className="game-log game-log--links">
                {notes.map((n) => {
                  const game = catalog.gameBySlug(n.game)!;
                  return (
                    <li key={n.slug}>
                      <DayNumeral iso={n.at} />
                      <div>
                        <h3>
                          <Link href={`/novidades/${n.slug}`}>{n.title}</Link>
                        </h3>
                        <p>{n.body[0]}</p>
                        <small>
                          {DEVLOG_KINDS[n.kind]} · <Link href={`/jogo/${game.slug}`}>{game.title}</Link>
                        </small>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          {jams.length > 0 && (
            <section className="game-part" aria-labelledby="jams">
              <h2 id="jams">Jams que organiza</h2>
              <ol className="creator-jams">
                {jams.map((j) => (
                  <li key={j.slug} style={trackStyle(j.track)}>
                    <DayNumeral iso={j.start} />
                    <div>
                      <h3>
                        <Link href={`/jams/${j.slug}`}>{j.title}</Link>
                      </h3>
                      <p>
                        Tema: {j.theme}. {j.summary}
                      </p>
                      <small>
                        <TrackChip id={j.track} />
                        <span>
                          {formatDay(j.start)} → {formatDay(j.end)}
                        </span>
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </LibraryState>
  );
}

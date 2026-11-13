import "@/styles/leitura.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { formatDay, formatTime, trackById } from "@/data/catalog";
import {
  DEVLOGS,
  DEVLOG_KINDS,
  devlogBySlug,
  devlogCreator,
  devlogGame,
  devlogNeighbours,
  devlogsBySameCreator,
} from "@/data/devlogs";
import { Entry, trackStyle } from "@/components/bits";
import { GuideStrip } from "@/components/leitura/Guide";
import { DiaryCompact } from "@/components/leitura/Diary";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return DEVLOGS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const note = devlogBySlug(slug);
  if (!note) return {};
  const game = devlogGame(note);
  return {
    title: `${note.title} · ${game.title}`,
    description: note.body[0],
  };
}

export default async function NovidadePage({ params }: Props) {
  const { slug } = await params;
  const note = devlogBySlug(slug);
  if (!note) notFound();
  const game = devlogGame(note);
  const creator = devlogCreator(note);
  const track = trackById(game.track);
  const more = devlogsBySameCreator(note);
  const { older, newer } = devlogNeighbours(note);

  return (
    <>
      <header
        className={`page-head note-head${track.on === "--paper" ? " on-field" : ""}`}
        style={trackStyle(game.track)}
      >
        <div className="wrap">
          <div>
            <nav className="crumbs" aria-label="Trilha de navegação">
              <Link href="/novidades">Novidades</Link>
              <span aria-hidden>/</span>
              <Link href={`/jogo/${game.slug}`}>{game.title}</Link>
            </nav>
            <h1>{note.title}</h1>
          </div>
          <div className="note-when">
            <time dateTime={note.at}>
              <b>{formatDay(note.at)}</b>
              <small>{formatTime(note.at)}</small>
            </time>
            <p>
              {DEVLOG_KINDS[note.kind]} de <Link href={`/jogo/${game.slug}`}>{game.title}</Link>
              {creator ? (
                <>
                  , por <Link href={`/criador/${creator.slug}`}>{creator.name}</Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </header>
      <GuideStrip current="novidades" exact={false} />

      <div className="wrap note-body">
        <article className="note-prose" aria-label={note.title}>
          {note.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </article>

        <aside className="note-side" aria-label="Sobre o jogo">
          <section aria-labelledby="note-jogo">
            <h2 id="note-jogo">O jogo</h2>
            <Entry game={game} showTrack />
          </section>

          {more.length > 0 && creator ? (
            <section aria-labelledby="note-mais">
              <h2 id="note-mais">Mais de {creator.name}</h2>
              <DiaryCompact notes={more} />
              <p className="note-side-link">
                <Link href={`/criador/${creator.slug}`}>Todos os jogos de {creator.name}</Link>
              </p>
            </section>
          ) : null}
        </aside>
      </div>

      <nav className="wrap note-pager" aria-label="Outras notas do diário">
        {older ? (
          <Link href={`/novidades/${older.slug}`} rel="prev" className="note-pager-prev">
            <small>
              <ArrowLeft aria-hidden size={16} /> Nota anterior
            </small>
            <span>{older.title}</span>
          </Link>
        ) : (
          <span />
        )}
        <Link href="/novidades" className="note-pager-all">
          Todas as notas
        </Link>
        {newer ? (
          <Link href={`/novidades/${newer.slug}`} rel="next" className="note-pager-next">
            <small>
              Nota seguinte <ArrowRight aria-hidden size={16} />
            </small>
            <span>{newer.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}

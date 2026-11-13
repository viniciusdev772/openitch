import Link from "next/link";
import { creatorBySlug, entryNumber, formatDate, formatDay, formatTime, trackById } from "@/data/catalog";
import { DEVLOG_KINDS, devlogGame, type Devlog } from "@/data/devlogs";
import { Cover } from "@/components/Cover";
import { TrackChip, trackStyle } from "@/components/bits";

type Billing = "lead" | "thumb" | "row";

/** Lead for the newest note, a thumbnail for launches, plain rows for the rest. */
function billingFor(note: Devlog, index: number): Billing {
  if (index === 0) return "lead";
  return note.kind === "lancamento" ? "thumb" : "row";
}

const dayKey = (iso: string) => formatDate(iso);

/** "12 de nov" printed as a numeral with its month: 12 nov. */
function Day({ iso }: { iso: string }) {
  const m = formatDay(iso).match(/^(\d+)\D+?([^\d\s]+)$/);
  if (!m) return <b>{formatDay(iso)}</b>;
  return (
    <b>
      {m[1]} <span>{m[2]}</span>
    </b>
  );
}

/**
 * The programme diary: a ruled list in date order. The numeral column prints
 * the day once per day, like a printed timetable, and the time on every row.
 * Each row links to the full note, and separately to the game's page.
 */
export function Diary({ notes }: { notes: Devlog[] }) {
  return (
    <ol className="diary">
      {notes.map((note, i) => {
        const game = devlogGame(note);
        const creator = creatorBySlug(game.creator);
        const track = trackById(game.track);
        const billing = billingFor(note, i);
        const firstOfDay = i === 0 || dayKey(notes[i - 1].at) !== dayKey(note.at);
        return (
          <li key={note.slug} className="diary-item" data-first-of-day={firstOfDay || undefined}>
            <article
              className={`diary-row diary-row--${billing}`}
              style={trackStyle(game.track)}
              data-dark={track.on === "--paper" || undefined}
            >
              <time className="diary-when" dateTime={note.at}>
                {firstOfDay ? <Day iso={note.at} /> : <span className="visually-hidden">{formatDay(note.at)}, </span>}
                <small>{formatTime(note.at)}</small>
              </time>
              {billing !== "row" ? (
                <span className="diary-thumb" aria-hidden>
                  <Cover game={game} label="" />
                </span>
              ) : null}
              <div className="diary-what">
                <h3>
                  <Link href={`/novidades/${note.slug}`} className="diary-link">
                    {note.title}
                  </Link>
                </h3>
                <p className="diary-excerpt">{note.body[0]}</p>
                <p className="diary-meta">
                  {DEVLOG_KINDS[note.kind]} · {creator?.name}
                </p>
              </div>
              <div className="diary-game">
                <Link href={`/jogo/${game.slug}`}>
                  <span className="visually-hidden">Página do jogo </span>
                  {game.title}
                </Link>
                <span className="diary-game-line">
                  <span className="num">{entryNumber(game.number)}</span>
                  <TrackChip id={game.track} />
                </span>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact ruled list for the side of a note: date numerals and titles. */
export function DiaryCompact({ notes }: { notes: Devlog[] }) {
  return (
    <ol className="diary-compact">
      {notes.map((note) => {
        const game = devlogGame(note);
        return (
          <li key={note.slug}>
            <time className="diary-when" dateTime={note.at}>
              <Day iso={note.at} />
            </time>
            <span>
              <Link href={`/novidades/${note.slug}`}>{note.title}</Link>
              <small>
                {DEVLOG_KINDS[note.kind]} ·{" "}
                <Link href={`/jogo/${game.slug}`}>{game.title}</Link>
              </small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

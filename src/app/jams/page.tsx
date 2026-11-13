import type { Metadata } from "next";
import Link from "next/link";
import { GAMES, JAMS, formatDay, trackById } from "@/data/catalog";
import { JamSchedule } from "@/components/JamSchedule";
import { trackStyle } from "@/components/bits";
import { pickNow } from "@/components/jams/clock";
import "@/styles/jams-criadores.css";

export const metadata: Metadata = { title: "Jams" };

// Os cartões seguem o mesmo relógio da agenda; a página se refaz a cada 5 minutos.
export const revalidate = 300;

export default function JamsPage() {
  const NOW = pickNow();
  return (
    <>
      <header className="page-head on-field" style={trackStyle("experimental")}>
        <div className="wrap">
          <h1>Jams</h1>
          <p>Maratonas com tema e relógio. Quando o prazo zera, as entradas entram no programa de uma vez, na mesma hora.</p>
        </div>
      </header>
      <section className="wrap" style={{ paddingTop: 48, paddingBottom: 128 }}>
        <JamSchedule />
        <div className="jam-list">
          {JAMS.filter((j) => NOW <= new Date(j.end).getTime())
            .sort((a, b) => +new Date(a.start) - +new Date(b.start))
            .map((j) => {
            const s = new Date(j.start).getTime();
            const e = new Date(j.end).getTime();
            const state = NOW > e ? "past" : NOW >= s ? "live" : "next";
            const tr = trackById(j.track);
            const entries = GAMES.filter((g) => g.jam === j.slug);
            return (
              <article
                key={j.slug}
                id={j.slug}
                className={`jam-card${tr.on === "--paper" && state !== "past" ? " on-field" : ""}`}
                data-state={state}
                style={trackStyle(j.track)}
              >
                <div className="state">
                  <span>{state === "live" ? "Rolando agora" : state === "past" ? "Encerrada" : "Em breve"}</span>
                  <span>
                    {formatDay(j.start)} → {formatDay(j.end)}
                  </span>
                </div>
                <h3>
                  <Link href={`/jams/${j.slug}`}>{j.title}</Link>
                </h3>
                <p className="theme">Tema: {j.theme}</p>
                <p>{j.summary}</p>
                {entries.length > 0 && (
                  <p>
                    Inclui{" "}
                    {entries.map((g) => (
                      <Link key={g.slug} href={`/jogo/${g.slug}`}>
                        {g.title}
                      </Link>
                    ))}
                  </p>
                )}
                <div className="foot">
                  <span>Organiza: {j.host}</span>
                  <span>{j.entries > 0 ? `${j.entries} entradas` : "inscrições abertas"}</span>
                </div>
              </article>
            );
          })}
        </div>
        <section className="jam-past" aria-labelledby="encerradas">
          <h2 id="encerradas">Encerradas</h2>
          <ol>
            {JAMS.filter((j) => NOW > new Date(j.end).getTime()).map((j) => (
              <li key={j.slug} id={j.slug}>
                <strong>
                  <Link href={`/jams/${j.slug}`}>{j.title}</Link>
                </strong>
                <span>Tema: {j.theme}</span>
                <span>
                  {GAMES.filter((g) => g.jam === j.slug).map((g) => (
                    <Link key={g.slug} href={`/jogo/${g.slug}`}>
                      {g.title}
                    </Link>
                  ))}{" "}
                  e mais {j.entries - GAMES.filter((g) => g.jam === j.slug).length} entradas
                </span>
                <span>
                  {formatDay(j.start)} → {formatDay(j.end)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </section>
    </>
  );
}

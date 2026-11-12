import type { Metadata } from "next";
import Link from "next/link";
import { GAMES, JAMS, formatDay, trackById } from "@/data/catalog";
import { JamSchedule } from "@/components/JamSchedule";
import { trackStyle } from "@/components/bits";

export const metadata: Metadata = { title: "Jams" };

const SAMPLE_NOW = new Date("2026-11-12T15:00:00-03:00").getTime();

export default function JamsPage() {
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
          {JAMS.map((j) => {
            const s = new Date(j.start).getTime();
            const e = new Date(j.end).getTime();
            const state = SAMPLE_NOW > e ? "past" : SAMPLE_NOW >= s ? "live" : "next";
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
                <h3>{j.title}</h3>
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
      </section>
    </>
  );
}

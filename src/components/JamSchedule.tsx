"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JAMS, formatDay, trackById } from "@/data/catalog";

const RANGE_START = new Date("2026-11-01T00:00:00-03:00").getTime();
const RANGE_END = new Date("2026-12-07T00:00:00-03:00").getTime();
const DAY = 86400000;
const FALLBACK_NOW = new Date("2026-11-12T15:00:00-03:00").getTime();

const pct = (t: number) => ((Math.min(Math.max(t, RANGE_START), RANGE_END) - RANGE_START) / (RANGE_END - RANGE_START)) * 100;

/** Festival schedule grid with a running "agora" line. Glow means live, nothing else. */
export function JamSchedule() {
  const [now, setNow] = useState(FALLBACK_NOW);
  useEffect(() => {
    const t = Date.now();
    // Outside the sample window, keep the sample date so the grid stays meaningful.
    if (t > RANGE_START && t < RANGE_END) setNow(t);
    const iv = setInterval(() => {
      const n = Date.now();
      if (n > RANGE_START && n < RANGE_END) setNow(n);
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  const ticks = [];
  for (let t = RANGE_START; t < RANGE_END; t += 7 * DAY) ticks.push(t);

  return (
    <div className="schedule" role="table" aria-label="Agenda de jams, novembro a dezembro de 2026">
      <div className="schedule-axis" role="row">
        <span role="columnheader">Jam</span>
        <div className="ticks" role="columnheader" aria-label="Semanas">
          {ticks.map((t) => (
            <span key={t} style={{ left: `${pct(t)}%` }}>
              {formatDay(new Date(t).toISOString())}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: "relative" }}>
        {JAMS.map((j) => {
          const s = new Date(j.start).getTime();
          const e = new Date(j.end).getTime();
          const state = now > e ? "past" : now >= s ? "live" : "next";
          const tr = trackById(j.track);
          return (
            <div className="schedule-row" role="row" key={j.slug}>
              <div className="who" role="cell">
                <Link href={`/jams#${j.slug}`}>{j.title}</Link>
                <small>
                  {state === "live" ? "rolando agora" : state === "past" ? "encerrada" : "em breve"} · tema “{j.theme}”
                </small>
              </div>
              <div className="lane" role="cell">
                {(() => {
                  const w = Math.max(pct(e) - pct(s), 1.5);
                  const label = `${formatDay(j.start)} → ${formatDay(j.end)}`;
                  const narrow = w < 12;
                  return (
                    <>
                <span
                  className="schedule-bar"
                  data-state={state}
                  style={
                    {
                      left: `${pct(s)}%`,
                      width: `${w}%`,
                      "--c": `var(${tr.color})`,
                      "--on": `var(${tr.on})`,
                    } as React.CSSProperties
                  }
                  title={label}
                >
                  {narrow ? "" : label}
                </span>
                {narrow && (
                  <span className="schedule-label" style={{ left: `${pct(e)}%` }}>
                    {label}
                  </span>
                )}
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
        <div
          className="schedule-overlay"
          aria-hidden
          style={{ position: "absolute", top: 0, bottom: 0, left: 220, right: 0, pointerEvents: "none" }}
        >
          <div className="schedule-now" style={{ left: `${pct(now)}%` }}>
            <span>agora</span>
          </div>
        </div>
      </div>
    </div>
  );
}

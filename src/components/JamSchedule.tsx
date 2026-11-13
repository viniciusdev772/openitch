"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { JAMS, formatDay, trackById } from "@/data/catalog";

const RANGE_START = new Date("2026-11-01T00:00:00-03:00").getTime();
const RANGE_END = new Date("2026-12-07T00:00:00-03:00").getTime();
const DAY = 86400000;
const FALLBACK_NOW = new Date("2026-11-12T15:00:00-03:00").getTime();

const pct = (t: number) => ((Math.min(Math.max(t, RANGE_START), RANGE_END) - RANGE_START) / (RANGE_END - RANGE_START)) * 100;

/** Festival schedule grid with a running "agora" line. Glow means live, nothing else. */
export function JamSchedule() {
  const [now, setNow] = useState(FALLBACK_NOW);
  const [laneW, setLaneW] = useState(1000);
  const axisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pick = () => {
      const n = Date.now();
      // Outside the sample window, keep the sample date so the grid stays meaningful.
      if (n > RANGE_START && n < RANGE_END) setNow(n);
    };
    pick();
    const iv = setInterval(pick, 60000);
    const el = axisRef.current;
    const ro = el ? new ResizeObserver(([e]) => setLaneW(e.contentRect.width)) : null;
    if (el && ro) ro.observe(el);
    return () => {
      clearInterval(iv);
      ro?.disconnect();
    };
  }, []);

  const ticks: number[] = [];
  for (let t = RANGE_START; t < RANGE_END; t += 7 * DAY) ticks.push(t);
  const mid = Math.floor(ticks.length / 2);

  return (
    <div className="schedule" role="table" aria-label="Agenda de jams, novembro a dezembro de 2026">
      <div className="schedule-axis" role="row">
        <span role="columnheader">Jam</span>
        <div className="ticks" role="columnheader" aria-label="Semanas" ref={axisRef}>
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`tick${i === mid ? " tick--mid" : ""}${i === ticks.length - 1 ? " tick--last" : ""}`}
              style={{ left: `${pct(t)}%` }}
            >
              {formatDay(new Date(t).toISOString())}
            </span>
          ))}
          <span className="now-pill" style={{ left: `${pct(now)}%` }}>
            agora
          </span>
        </div>
      </div>
      {JAMS.map((j) => {
        const s = new Date(j.start).getTime();
        const e = new Date(j.end).getTime();
        const state = now > e ? "past" : now >= s ? "live" : "next";
        const tr = trackById(j.track);
        const w = Math.max(pct(e) - pct(s), 1.5);
        const label = `${formatDay(j.start)} → ${formatDay(j.end)}`;
        const narrow = (w / 100) * laneW < 150;
        const outsideLeft = pct(e) > 80;
        return (
          <div className="schedule-row" role="row" key={j.slug}>
            <div className="who" role="cell">
              <Link href={`/jams/${j.slug}`}>{j.title}</Link>
              <small>
                {state === "live" ? "rolando agora" : state === "past" ? "encerrada" : "em breve"} · tema “{j.theme}”
              </small>
            </div>
            <div className="lane" role="cell">
              {/* Pointer shortcut to the jam page; keyboard and screen readers use the title link in this row. */}
              <Link
                href={`/jams/${j.slug}`}
                tabIndex={-1}
                aria-hidden
                className="schedule-bar"
                data-state={state}
                data-narrow={narrow}
                title={label}
                style={
                  {
                    left: `${pct(s)}%`,
                    width: `${w}%`,
                    "--c": `var(${tr.color})`,
                    "--on": `var(${tr.on})`,
                  } as React.CSSProperties
                }
              >
                {!narrow && <b>{label}</b>}
              </Link>
              {narrow && (
                <span
                  className="schedule-label"
                  style={
                    outsideLeft
                      ? { right: `${100 - pct(s)}%`, paddingRight: 8, paddingLeft: 0 }
                      : { left: `calc(${pct(s)}% + max(${w}%, 14px))` }
                  }
                >
                  {label}
                </span>
              )}
              <span className="lane-now" aria-hidden style={{ left: `${pct(now)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

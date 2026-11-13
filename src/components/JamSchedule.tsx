"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDay, jamState, pickNow, trackById } from "@/data/base";
import { JAMS } from "@/data/jams";

const DAY = 86400000;
// The grid spans the jams on the agenda: from the Sunday before the first start
// to a week after the last end (in UTC weeks; labels print in Brasília time).
const firstStart = Math.min(...JAMS.map((j) => +new Date(j.start)));
const lastEnd = Math.max(...JAMS.map((j) => +new Date(j.end)));
const RANGE_START = Math.floor(firstStart / (7 * DAY)) * 7 * DAY - 4 * DAY;
const RANGE_END = lastEnd + 7 * DAY;

const pct = (t: number) => ((Math.min(Math.max(t, RANGE_START), RANGE_END) - RANGE_START) / (RANGE_END - RANGE_START)) * 100;

/**
 * Festival schedule grid with a running "agora" line. Glow means live, nothing
 * else. `serverNow` is the pickNow() the page rendered with, so the server HTML
 * matches the page around it; the browser then follows pickNow() each minute.
 */
export function JamSchedule({ serverNow }: { serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  const [laneW, setLaneW] = useState(1000);
  const axisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pick = () => setNow(pickNow());
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
    <div className="schedule" role="table" aria-label="Agenda de jams">
      <div className="schedule-axis" role="row">
        <span role="columnheader">Jam</span>
        <div className="ticks" role="columnheader" aria-label="Semanas" ref={axisRef}>
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`tick${i === mid ? " tick--mid" : ""}${i === ticks.length - 1 ? " tick--last" : ""}`}
              // A pílula "agora" cobre a data que estiver a menos de ~60px dela.
              data-under-now={Math.abs(pct(t) - pct(now)) * laneW < 6000 || undefined}
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
      {[...JAMS].sort((a, b) => +new Date(a.start) - +new Date(b.start)).map((j) => {
        const s = new Date(j.start).getTime();
        const e = new Date(j.end).getTime();
        const state = jamState(j, now);
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

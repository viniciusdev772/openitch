import { SAMPLE_NOW as SAMPLE_ISO, type Jam } from "@/data/catalog";

/**
 * The demo programme runs on a sample clock. The sample week is fixed so the
 * pages stay meaningful outside it; inside the sample window the real clock wins,
 * the same rule the jam schedule uses.
 */
export const SAMPLE_NOW = new Date(SAMPLE_ISO).getTime();
const WINDOW_START = new Date("2026-11-01T00:00:00-03:00").getTime();
const WINDOW_END = new Date("2026-12-07T00:00:00-03:00").getTime();

export function pickNow(real = Date.now()) {
  return real > WINDOW_START && real < WINDOW_END ? real : SAMPLE_NOW;
}

export type JamState = "past" | "live" | "next";

export function jamState(jam: Pick<Jam, "start" | "end">, now: number): JamState {
  const s = new Date(jam.start).getTime();
  const e = new Date(jam.end).getTime();
  return now > e ? "past" : now >= s ? "live" : "next";
}

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

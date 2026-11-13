import { dayKey, type Jam } from "@/data/base";

/**
 * The programme clock (pickNow, jamState and the sample window) lives in
 * @/data/base; it is re-exported here so jam components keep one import.
 */
export { pickNow, jamState, type JamState } from "@/data/base";

const HOUR = 3600000;
const DAY = 24 * HOUR;

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

/**
 * How long a jam runs, as printed on its sheet: the calendar days its window
 * touches in Brasília time (13/11 18:00 → 16/11 23:59 is four days), or hours
 * when the window is shorter than a day. An end at exactly midnight does not
 * count the day it opens.
 */
export function jamLength(jam: Pick<Jam, "start" | "end">): string {
  const s = +new Date(jam.start);
  const e = +new Date(jam.end);
  if (e - s < DAY) {
    const h = Math.max(1, Math.round((e - s) / HOUR));
    return `${h} ${h === 1 ? "hora" : "horas"}`;
  }
  const first = Date.parse(`${dayKey(s)}T00:00:00Z`);
  const last = Date.parse(`${dayKey(e - 1)}T00:00:00Z`);
  const days = Math.round((last - first) / DAY) + 1;
  return `${days} dias`;
}

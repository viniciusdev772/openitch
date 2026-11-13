// Programme basics shared by server and client code: types, tracks, platforms,
// the programme clock and print formatting. Kept apart from the catalogue data
// so client components can import them without shipping the whole catalogue.

export type TrackId = "navegador" | "acao" | "narrativo" | "puzzle" | "experimental";
export type Platform = "web" | "windows" | "macos" | "linux" | "android";
export type CoverStyle =
  | "orbit"
  | "beam"
  | "letters"
  | "depths"
  | "rain"
  | "envelope"
  | "pigeon"
  | "fog"
  | "garden"
  | "weave"
  | "door"
  | "boat"
  | "scrap"
  | "bus"
  | "golem"
  | "tide"
  | "shelves"
  | "canoe"
  | "pendulum"
  | "drum";

export type Price =
  | { kind: "free" }
  | { kind: "fixed"; amount: number }
  | { kind: "pwyw"; minimum: number };

export interface Track {
  id: TrackId;
  name: string;
  short: string;
  blurb: string;
  /** CSS custom property name for the track's spot colour */
  color: string;
  /** Text colour that holds contrast on the field */
  on: string;
}

export interface Creator {
  slug: string;
  name: string;
  city: string;
  bio: string;
  /** People behind a studio, duo or collective (optional) */
  members?: string[];
  /** Outside links. */
  links?: CreatorLink[];
  /** ISO timestamp of the account's first publication (optional). */
  joined?: string;
}

export interface CreatorLink {
  label: string;
  href: string;
}

export interface DevlogPost {
  /** ISO timestamp */
  date: string;
  title: string;
  body: string;
}

export interface Credit {
  role: string;
  name: string;
}

export interface Download {
  platform: Platform;
  file: string;
  size: string;
  /** Where the file is served (a short redirect to storage), when it is live. */
  href?: string;
}

export interface Game {
  slug: string;
  number: number;
  title: string;
  tagline: string;
  description: string[];
  creator: string;
  track: TrackId;
  tags: string[];
  platforms: Platform[];
  price: Price;
  /** ISO timestamp of publication */
  published: string;
  updated: string;
  session: string;
  languages: string[];
  cover: CoverStyle;
  /** Cover palette: [ground, figure, accent] as CSS vars */
  palette: [string, string, string];
  /** An uploaded cover image (public URL), drawn instead of the cover style when present. */
  coverImage?: string;
  downloads: Download[];
  /** The creator's display name, resolved when the catalogue is loaded (optional). */
  creatorName?: string;
  /** The browser build's play page, when one is live (optional). */
  play?: string;
  jam?: string;
  /** How to play, one control per line (optional) */
  controls?: string[];
  /** Accessibility features the creator states (optional) */
  accessibility?: string[];
  /** Content notes shown before play (optional) */
  contentNotes?: string[];
  credits?: Credit[];
  /** Update posts, newest last (optional) */
  devlog?: DevlogPost[];
}

export interface Jam {
  slug: string;
  title: string;
  theme: string;
  host: string;
  start: string;
  end: string;
  entries: number;
  track: TrackId;
  summary: string;
  /** Creator slug of the host, when the host has a page (optional) */
  hostSlug?: string;
  rules?: string[];
  /** What the community vote looks at (optional) */
  criteria?: string[];
  /** Non-cash rewards the host offers (optional) */
  prizes?: string[];
  /**
   * When entries go live. "at-close": all at once when the clock runs out
   * (the default). "on-submit": each entry is published as it arrives.
   */
  release?: "at-close" | "on-submit";
}

export const TRACKS: Track[] = [
  {
    id: "navegador",
    name: "Navegador",
    short: "Joga na página",
    blurb: "Builds HTML5 que rodam direto aqui, sem instalar nada.",
    color: "--lime",
    on: "--ink",
  },
  {
    id: "acao",
    name: "Ação",
    short: "Reflexo e ritmo",
    blurb: "Corrida, plataforma, roguelike e tudo que pede dedo rápido.",
    color: "--tangerine",
    on: "--ink",
  },
  {
    id: "narrativo",
    name: "Narrativo",
    short: "Histórias para ler e jogar",
    blurb: "Ficção interativa, cartas, viagens curtas e personagens que ficam.",
    color: "--magenta",
    on: "--ink",
  },
  {
    id: "puzzle",
    name: "Quebra-cabeça",
    short: "Uma ideia por fase",
    blurb: "Lógica, palavras, padrões e o prazer do clique certo.",
    color: "--teal",
    on: "--ink",
  },
  {
    id: "experimental",
    name: "Experimental",
    short: "Fora de qualquer gaveta",
    blurb: "Brinquedos, instrumentos e coisas que ainda não têm nome.",
    color: "--ultra",
    on: "--paper",
  },
];

export const PLATFORMS: Record<Platform, { code: string; name: string }> = {
  web: { code: "N", name: "Navegador" },
  windows: { code: "W", name: "Windows" },
  macos: { code: "M", name: "macOS" },
  linux: { code: "L", name: "Linux" },
  android: { code: "A", name: "Android" },
};


export const trackById = (id: TrackId) => TRACKS.find((t) => t.id === id)!;

/**
 * The programme's "now" in ms: the real clock. Pages and client components read
 * it through pickNow() so a server render can hand the same instant to the
 * browser (see JamSchedule's serverNow).
 */
export function pickNow(real: number = Date.now()): number {
  return real;
}

/** Calendar date (YYYY-MM-DD) of an instant in Brasília time. */
export function dayKey(t: string | number | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

export type JamState = "past" | "live" | "next";
/** Where a jam stands at `now` (defaults to pickNow()). The closing minute still counts as live. */
export function jamState(jam: Pick<Jam, "start" | "end">, now: string | number = pickNow()): JamState {
  const t = typeof now === "number" ? now : +new Date(now);
  if (t > +new Date(jam.end)) return "past";
  if (t >= +new Date(jam.start)) return "live";
  return "next";
}

/** Inteiros sem centavos (R$ 12); frações com vírgula e dois dígitos (R$ 12,50). */
const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

export function formatPrice(price: Price): string {
  switch (price.kind) {
    case "free":
      return "Grátis";
    case "fixed":
      return `R$ ${price.amount.toFixed(2).replace(".", ",")}`;
    case "pwyw":
      return price.minimum > 0
        ? `Pague o que quiser · mín. R$ ${money(price.minimum)}`
        : "Pague o que quiser";
  }
}

export function shortPrice(price: Price): string {
  switch (price.kind) {
    case "free":
      return "Grátis";
    case "fixed":
      return `R$ ${money(price.amount)}`;
    case "pwyw":
      return price.minimum > 0 ? `R$ ${money(price.minimum)}+` : "Livre";
  }
}

export const entryNumber = (n: number) => `Nº ${String(n).padStart(4, "0")}`;

const TZ = "America/Sao_Paulo";

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ })
    .format(new Date(iso))
    .replace(".", "");
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
}

// Formatters for lists that print many dates (one Intl object each, built once).
const DAY_2 = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: TZ });
const MONTH_SHORT = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: TZ });

/** Day and short month apart, for a date printed as a column: ["13", "nov"] (no "de", no dot). */
export function dayParts(t: string | number | Date): [day: string, month: string] {
  const d = new Date(t);
  return [DAY_2.format(d), MONTH_SHORT.format(d).replace(".", "")];
}

/** "13 nov": day and short month in one line, without "de" and without the dot. */
export const shortDay = (t: string | number | Date) => dayParts(t).join(" ");

import type { Platform, TrackId } from "@/data/base";
import { LIMITS, stripInvisible } from "@/lib/projects/limits";

/*
 * Lê a página de um jogo no itch.io (HTML + data.json) e devolve os campos de
 * um rascunho. Módulo puro: sem fetch, sem banco. Quem busca é ./fetch.ts.
 *
 * ponytail: o HTML do itch é lido com regex, não com um parser. O formato da
 * página é estável, mas se o itch mudar as classes (formatted_description,
 * game_info_panel_widget) o campo some e o rascunho sai sem ele, sem quebrar.
 * Se isso começar a falhar, troque por um parser de HTML de verdade.
 */

/* ------------------------------------------------------------------ */
/* Endereços                                                           */
/* ------------------------------------------------------------------ */

/** https, sem credenciais nem porta, host "itch.io" ou "*.itch.io". Qualquer outra coisa: null. */
export function parseItchUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  if (h !== "itch.io" && !h.endsWith(".itch.io")) return null;
  return u;
}

/** Imagens só de img.itch.zone, por https. */
export function parseImageUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hostname.toLowerCase() !== "img.itch.zone") return null;
  return u;
}

/** A página do jogo (sem query nem barra final) a partir do endereço colado. */
export function gameBase(u: URL): string {
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

/* ------------------------------------------------------------------ */
/* HTML para texto                                                     */
/* ------------------------------------------------------------------ */

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const oneLine = (s: string) => stripInvisible(decode(s.replace(/<[^>]*>/g, " "))).replace(/\s+/g, " ").trim();

/** O conteúdo do primeiro <div class="...cls..."> (com a contagem de <div> aninhados). */
function divInner(html: string, cls: string): string | null {
  const open = new RegExp(`<div[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "i").exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const tag = /<(\/?)div\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 1;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  return html.slice(start);
}

/**
 * HTML do itch para o texto que a descrição do projeto usa: texto puro com
 * parágrafos separados por linha em branco. Listas viram "• item", links viram
 * "texto (endereço)", o resto das tags some. Nada de HTML cru sobra: o que
 * parecia tag é descartado antes de decodificar as entidades.
 */
export function htmlToText(html: string): string {
  const s = html
    .replace(/<(script|style|iframe|svg|noscript)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a\s*>/gi, (_m, d: string, sq: string, inner: string) => {
      const text = oneLine(inner);
      const href = decode(d ?? sq ?? "").trim();
      if (!/^https?:\/\//i.test(href)) return text;
      return !text || text === href ? href : `${text} (${href})`;
    })
    .replace(/<\/t[dh]\s*>\s*(?=<t[dh]\b)/gi, " — ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/(li|tr)\s*>/gi, "\n")
    .replace(/<\/(p|h[1-6]|div|ul|ol|blockquote|pre|table)\s*>|<hr\b[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  return stripInvisible(decode(s))
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const cut = (s: string, max: number): string => {
  const chars = [...s];
  return chars.length <= max ? s : chars.slice(0, max - 1).join("").trimEnd() + "…";
};

/** Corta no limite do campo, de preferência no fim de um parágrafo. */
function cutParagraphs(s: string, max: number): string {
  if ([...s].length <= max) return s;
  const head = [...s].slice(0, max).join("");
  const i = head.lastIndexOf("\n\n");
  return (i > max / 2 ? head.slice(0, i) : cut(head, max)).trim();
}

/* ------------------------------------------------------------------ */
/* Meta e tabela de informações                                        */
/* ------------------------------------------------------------------ */

function meta(html: string, prop: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (key?.toLowerCase() !== prop) continue;
    const v = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const text = v ? oneLine(v[1] ?? v[2] ?? "") : "";
    if (text) return text;
  }
  return null;
}

/** Linhas da tabela "More information": rótulo (minúsculo) para valor em texto. */
function infoTable(html: string): Map<string, string> {
  const out = new Map<string, string>();
  // O nome também aparece no CSS da página: procure o atributo class, não o texto.
  const at = html.search(/class\s*=\s*["'][^"']*\bgame_info_panel_widget\b/i);
  if (at < 0) return out;
  const end = html.indexOf("</table>", at);
  const region = html.slice(at, end < 0 ? undefined : end);
  for (const m of region.matchAll(/<tr\b[^>]*>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    const k = oneLine(m[1]).toLowerCase();
    if (k && !out.has(k)) out.set(k, oneLine(m[2]));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* O rascunho                                                          */
/* ------------------------------------------------------------------ */

export type ItchPrice = { kind: "free" } | { kind: "fixed"; cents: number } | { kind: "pwyw"; minimumCents: number };

export interface ItchImport {
  itchId: number;
  itchUrl: string;
  title: string;
  tagline: string;
  description: string;
  track: TrackId;
  tags: string[];
  platforms: Platform[];
  price: ItchPrice;
  /** O preço no itch é em dólar (ou outra moeda): o criador precisa rever o valor. */
  reviewPrice: boolean;
  languages: string[];
  controls: string[];
  /** Imagem de capa candidata (já validada: https em img.itch.zone), ou null. */
  coverUrl: string | null;
}

/** "$5.00" ou "R$ 12,50" em centavos; null quando não há número. */
function priceCents(raw: unknown): number | null {
  const m = typeof raw === "string" ? /(\d+(?:[.,]\d{1,2})?)/.exec(raw) : null;
  return m ? Math.round(parseFloat(m[1].replace(",", ".")) * 100) : null;
}

function pickTrack(platforms: Platform[], genre: string): TrackId {
  if (/puzzle/i.test(genre)) return "puzzle";
  if (/visual novel|interactive fiction|adventure|role playing/i.test(genre)) return "narrativo";
  if (/action|platformer|shooter|fighting|racing|survival|rhythm|sports/i.test(genre)) return "acao";
  return platforms.includes("web") ? "navegador" : "experimental";
}

const csv = (s: string | undefined) => (s ?? "").split(",").map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);

const fold = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Mapeia a página (html) e o data.json do itch para os campos do rascunho.
 * `known` são as etiquetas que o site já conhece: quem bate (sem diferenciar
 * maiúsculas ou acentos) usa a grafia do site. null quando o json não tem id ou título.
 */
export function parseItch(html: string, json: unknown, pageUrl: string, known: readonly string[] = []): ItchImport | null {
  const d = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const itchId = typeof d.id === "number" && Number.isSafeInteger(d.id) && d.id > 0 ? d.id : null;
  const rawTitle = typeof d.title === "string" ? d.title : "";
  if (!itchId || !oneLine(rawTitle)) return null;
  const selfRaw = (d.links as { self?: unknown } | undefined)?.self;
  const self = typeof selfRaw === "string" ? parseItchUrl(selfRaw) : null;
  const page = parseItchUrl(pageUrl);
  if (!self && !page) return null;

  const info = infoTable(html);
  const description = cutParagraphs(htmlToText(divInner(html, "formatted_description") ?? ""), LIMITS.description);
  const firstPara = description.split("\n\n")[0] ?? "";
  const tagline = cut(meta(html, "og:description") ?? oneLine(firstPara), LIMITS.tagline);

  const platformText = (info.get("platforms") ?? "").toLowerCase();
  const platforms: Platform[] = [];
  if (/class="[^"]*\biframe_placeholder\b/i.test(html) || /\bhtml5\b|\bweb\b/.test(platformText)) platforms.push("web");
  if (/windows/.test(platformText)) platforms.push("windows");
  if (/\bmac|\bosx\b/.test(platformText)) platforms.push("macos");
  if (/linux/.test(platformText)) platforms.push("linux");
  if (/android/.test(platformText)) platforms.push("android");

  // Preço: grátis, "pague quanto quiser" (mínimo = o preço, ou 0) ou fixo.
  const base = priceCents(d.price) ?? 0;
  const pwyw = /name your own price/i.test(html) || (priceCents(d.suggested_price) ?? 0) > 0;
  const cap = (c: number) => Math.min(c, LIMITS.priceCents);
  const price: ItchPrice = pwyw ? { kind: "pwyw", minimumCents: cap(base) } : base > 0 ? { kind: "fixed", cents: cap(base) } : { kind: "free" };

  // Etiquetas: as do json (slugs) e as da tabela, com a grafia do site quando já existe.
  const knownBy = new Map(known.map((k) => [fold(k), k]));
  const slugTags = Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === "string").map((t) => t.replace(/-/g, " ")) : [];
  const tags: string[] = [];
  for (const t of [...slugTags, ...csv(info.get("tags"))]) {
    const name = knownBy.get(fold(t)) ?? t;
    if (!fold(name) || [...name].length > LIMITS.tag || tags.some((x) => fold(x) === fold(name))) continue;
    tags.push(name);
    if (tags.length >= LIMITS.tags) break;
  }

  const languages = csv(info.get("languages")).filter((l) => [...l].length <= LIMITS.language).slice(0, LIMITS.languages);
  const inputs = info.get("inputs");
  const controls = inputs && [...inputs].length + 10 <= LIMITS.controls.line ? [`Entradas: ${inputs}`] : [];

  const cover = [meta(html, "og:image"), typeof d.cover_image === "string" ? d.cover_image : null].find((u) => u && parseImageUrl(u));

  return {
    itchId,
    itchUrl: gameBase((self ?? page) as URL),
    title: cut(oneLine(rawTitle), LIMITS.title),
    tagline,
    description,
    track: pickTrack(platforms, info.get("genre") ?? ""),
    tags,
    platforms,
    price,
    reviewPrice: price.kind !== "free" && base > 0,
    languages,
    controls,
    coverUrl: cover ?? null,
  };
}

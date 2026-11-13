import type { CoverStyle, Platform, TrackId } from "@/data/base";
import { slugify } from "@/lib/slug";

/**
 * Limites dos rascunhos, compartilhados entre o formulário (maxLength,
 * contadores) e o servidor, que é quem decide. Nada aqui é segredo.
 */
export const LIMITS = {
  /** Rascunhos por conta. */
  drafts: 20,
  title: 40,
  tagline: 90,
  description: 4000,
  tags: 8,
  tag: 24,
  /** Texto bruto do campo de etiquetas (antes de separar por vírgula). */
  tagsRaw: 8 * 25,
  slug: 48,
  /** Teto de preço: R$ 1.000,00, em centavos. */
  priceCents: 100_000,
  /* Detalhes da página (todos opcionais). */
  session: 40,
  languages: 6,
  language: 24,
  languagesRaw: 6 * 26,
  controls: { lines: 12, line: 80 },
  accessibility: { lines: 10, line: 100 },
  contentNotes: { lines: 8, line: 100 },
  credits: { lines: 20, line: 100 },
} as const;

/** Uma lista de linhas como o campo de texto a escreve (uma por linha). */
export type LineLimit = { lines: number; line: number };

/** Gravações (salvar e excluir somadas) por conta a cada janela. */
export const WRITES_PER_WINDOW = 30;
export const WRITE_WINDOW_MS = 5 * 60 * 1000;

/** Capas provisórias: um subconjunto dos estilos de capa do catálogo. */
export const DRAFT_COVERS: { style: CoverStyle; palette: [string, string, string]; name: string }[] = [
  { style: "orbit", palette: ["--ultra", "--lime", "--paper"], name: "Órbitas" },
  { style: "beam", palette: ["--ink", "--tangerine", "--paper"], name: "Farol" },
  { style: "weave", palette: ["--paper", "--magenta", "--ultra"], name: "Trama" },
  { style: "tide", palette: ["--teal", "--lime", "--ink"], name: "Maré" },
];

export type PriceKind = "free" | "fixed" | "pwyw";

/** O rascunho como o formulário o conhece (sem ids de usuário). */
export interface DraftFields {
  title: string;
  tagline: string;
  description: string;
  track: TrackId;
  /** Etiquetas como o criador escreveu, separadas por vírgula. */
  tags: string;
  platforms: Platform[];
  priceKind: PriceKind;
  /** Valor como texto, em reais ("5", "12,50"). */
  amount: string;
  cover: CoverStyle;
  jam: string;
  /** Duração ("10 minutos"). */
  session: string;
  /** Idiomas separados por vírgula. */
  languages: string;
  /** Uma linha por controle: "Setas: move o barco". */
  controls: string;
  /** Uma linha por recurso de acessibilidade. */
  accessibility: string;
  /** Uma linha por aviso de conteúdo. */
  contentNotes: string;
  /** Uma linha por crédito: "Música: Fulana". */
  credits: string;
}

export interface SavedDraft extends DraftFields {
  id: string;
  slug: string;
  /** ISO 8601 */
  updatedAt: string;
  /** No programa ou só rascunho. */
  state: "rascunho" | "publicado";
  /** Endereço público reservado (/jogo/<slug>), depois da primeira publicação. */
  publicSlug: string | null;
  /** Número da entrada no programa, depois da primeira publicação. */
  number: number | null;
  /** Imagem de capa enviada, quando há. */
  coverImage: string | null;
}

/** Uma linha da lista de rascunhos. */
export interface DraftRow {
  id: string;
  title: string;
  tagline: string;
  track: TrackId;
  jam: string | null;
  /** ISO 8601 */
  updatedAt: string;
  state: "rascunho" | "publicado";
  /** Endereço público, quando publicado. */
  publicSlug: string | null;
}

/** Campos do formulário que podem voltar com erro. */
export type DraftFieldKey =
  | "title"
  | "tagline"
  | "description"
  | "tags"
  | "amount"
  | "platforms"
  | "session"
  | "languages"
  | "controls"
  | "accessibility"
  | "contentNotes"
  | "credits";

export type SaveResult =
  | { ok: true; id: string; slug: string; savedAt: string }
  | {
      ok: false;
      code: "campos" | "sessao" | "limite" | "taxa" | "nao_encontrado" | "servidor";
      error: string;
      fields?: Partial<Record<DraftFieldKey, string>>;
    };

export type DeleteResult = { ok: true } | { ok: false; error: string; code?: "sessao" | "taxa" | "nao_encontrado" | "servidor" };

/** Reais para centavos, a partir do texto do campo. null quando não é um valor. */
export function parseCents(raw: string): number | null {
  const v = raw.trim().replace(/\s/g, "");
  if (!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(v)) return null;
  const [int, frac = ""] = v.split(/[.,]/);
  return Number(int) * 100 + Number(frac.padEnd(2, "0"));
}

/** Centavos para o texto do campo: 590 vira "5,90"; 500 vira "5". */
export function centsToText(cents: number): string {
  const r = Math.floor(cents / 100);
  const c = cents % 100;
  return c === 0 ? String(r) : `${r},${String(c).padStart(2, "0")}`;
}

/** Reais com milhar e centavos, sem depender do Intl (mesmo texto no servidor e no navegador): 100000 vira "1.000,00". */
function centsToMoney(cents: number): string {
  const r = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${r},${String(cents % 100).padStart(2, "0")}`;
}

/** O teto de preço como o formulário e as mensagens escrevem: "R$ 1.000,00". */
export const MAX_PRICE_TEXT = `R$ ${centsToMoney(LIMITS.priceCents)}`;

export type PriceCheck = { ok: true; cents: number } | { ok: false; error: string };

/**
 * Confere o valor de um modelo de preço, com as mesmas mensagens no formulário
 * e no servidor (que é quem decide). Grátis não tem valor; no "pague o que
 * quiser", campo vazio vale zero.
 */
export function checkPrice(kind: PriceKind, amount: string): PriceCheck {
  if (kind === "free") return { ok: true, cents: 0 };
  const trimmed = amount.trim();
  const cents = trimmed === "" && kind === "pwyw" ? 0 : parseCents(trimmed);
  if (cents === null) return { ok: false, error: "Escreva o valor só com números e vírgula, como 12,50." };
  if (cents > LIMITS.priceCents) return { ok: false, error: `O valor máximo é ${MAX_PRICE_TEXT}.` };
  if (kind === "fixed" && cents === 0) {
    return { ok: false, error: "Preço fixo precisa ser maior que zero. Para zero, escolha Grátis." };
  }
  return { ok: true, cents };
}

/** Endereço sugerido: minúsculas sem acento, palavras unidas por hífen. */
export const suggestSlug = (title: string): string => slugify(title, LIMITS.slug);

/**
 * Tira o que não se vê: caracteres de controle (menos os de espaço, que cada
 * campo trata) e de formato (\p{Cf}: marcas de direção, hífen discreto, espaço
 * de largura zero). O ZWJ (U+200D) fica entre dois caracteres, porque une
 * emojis compostos; solto, nas pontas ou repetido, sai. O U+FE0F (seletor de
 * emoji) não é Cf e passa intacto.
 */
export function stripInvisible(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "‍" || /\s/.test(c) ? c : ""))
    .replace(/‍{2,}/g, "‍")
    .replace(/(?<=^|\s)‍|‍(?=\s|$)/g, "");
}

/** Separa, limpa e tira repetidas (sem diferenciar maiúsculas). */
export function splitTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = stripInvisible(part).replace(/\s+/g, " ").trim();
    if (!t) continue;
    const key = t.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Publicação                                                          */
/* ------------------------------------------------------------------ */

/** Mínimos para entrar no programa (o rascunho salva com menos). */
export const PUBLISH_MIN = { tagline: 5, description: 20 } as const;

export type PublishField = "title" | "tagline" | "description" | "platforms" | "amount";

/** O que falta, campo a campo, para um jogo entrar (ou continuar) no programa. Mesmo texto no formulário e no servidor. */
export function publishFieldProblems(d: {
  title: string;
  tagline: string;
  description: string;
  platforms: readonly string[];
  priceKind: PriceKind;
}): Partial<Record<PublishField, string>> {
  const out: Partial<Record<PublishField, string>> = {};
  const n = (s: string) => [...s.trim()].length;
  if (n(d.title) < 2) out.title = "Dê um nome ao jogo.";
  if (n(d.tagline) < PUBLISH_MIN.tagline) out.tagline = `Escreva a frase de apresentação, com pelo menos ${PUBLISH_MIN.tagline} caracteres.`;
  if (n(d.description) <= PUBLISH_MIN.description) {
    out.description = `Conte o que é o jogo na descrição, com mais de ${PUBLISH_MIN.description} caracteres.`;
  }
  if (d.platforms.length === 0) out.platforms = "Marque pelo menos uma plataforma.";
  // Pagamentos ainda não existem: um jogo pago seria entregue de graça.
  if (d.priceKind !== "free") out.amount = "Por enquanto só jogos grátis entram no programa: os pagamentos ainda não estão ligados.";
  return out;
}

export type PublishState = "rascunho" | "publicado";

/** Uma pendência para publicar, com o campo do formulário que resolve (quando há um). */
export interface PublishProblem {
  field?: PublishField;
  text: string;
  /** Pendência de arquivo (vem do armazenamento, não do formulário). */
  file?: true;
}

export type PublishResult =
  | { ok: true; state: PublishState; slug: string | null; number: number | null }
  | {
      ok: false;
      code: "sessao" | "taxa" | "nao_encontrado" | "pendencias" | "servidor";
      error: string;
      problems?: PublishProblem[];
    };

/* ------------------------------------------------------------------ */
/* Detalhes da página: listas de linhas                                */
/* ------------------------------------------------------------------ */

/** Linhas de um campo de várias linhas: limpas, sem vazias, sem repetidas. */
export function splitLines(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const t = stripInvisible(part).replace(/\s+/g, " ").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** O que há de errado com uma lista de linhas, ou null. Mesmo texto no formulário e no servidor. */
export function linesProblem(items: string[], limit: LineLimit): string | null {
  if (items.length > limit.lines) return `Use até ${limit.lines} linhas.`;
  if (items.some((t) => [...t].length > limit.line)) return `Cada linha pode ter até ${limit.line} caracteres.`;
  return null;
}

/** Créditos "Papel: Nome", um por linha. null quando alguma linha não tem os dois lados. */
export function parseCredits(items: string[]): { role: string; name: string }[] | null {
  const out: { role: string; name: string }[] = [];
  for (const line of items) {
    const i = line.indexOf(":");
    const role = i > 0 ? line.slice(0, i).trim() : "";
    const name = i > 0 ? line.slice(i + 1).trim() : "";
    if (!role || !name) return null;
    out.push({ role, name });
  }
  return out;
}

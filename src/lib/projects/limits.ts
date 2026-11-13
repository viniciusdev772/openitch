import type { CoverStyle, Platform, TrackId } from "@/data/catalog";

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
} as const;

/** Gravações (salvar e excluir somadas) por conta a cada janela. */
export const WRITES_PER_WINDOW = 30;
export const WRITE_WINDOW_MS = 5 * 60 * 1000;

/** Capas provisórias: um subconjunto dos estilos de capa do catálogo. */
export const DRAFT_COVERS: { style: CoverStyle; palette: [string, string, string]; name: string }[] = [
  { style: "orbit", palette: ["--ultra", "--lime", "--paper"], name: "Órbita" },
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
}

export interface SavedDraft extends DraftFields {
  id: string;
  slug: string;
  /** ISO 8601 */
  updatedAt: string;
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
}

export type SaveResult =
  | { ok: true; id: string; slug: string; savedAt: string }
  | {
      ok: false;
      code: "campos" | "sessao" | "limite" | "taxa" | "nao_encontrado" | "servidor";
      error: string;
      fields?: Partial<Record<"title" | "tagline" | "description" | "tags" | "amount" | "platforms", string>>;
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

/** Endereço sugerido: minúsculas sem acento, palavras unidas por hífen. */
export function suggestSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.slug)
    .replace(/-+$/g, "");
}

/** Separa, limpa e tira repetidas (sem diferenciar maiúsculas). */
export function splitTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.normalize("NFKC").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const key = t.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

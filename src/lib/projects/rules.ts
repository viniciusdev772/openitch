import "server-only";
import type { ObjectId } from "mongodb";
import { PLATFORMS, TRACKS, type CoverStyle, type Platform, type TrackId } from "@/data/base";
import { JAMS } from "@/data/jams";
import { db, type ProjectDoc, type ProjectPrice } from "@/lib/auth/db";
import { toObjectId } from "@/lib/auth/session";
import { str } from "@/lib/auth/validate";
import {
  DRAFT_COVERS,
  LIMITS,
  centsToText,
  checkPrice,
  splitTags,
  stripInvisible,
  suggestSlug,
  type DraftRow,
  type PriceKind,
  type SaveResult,
  type SavedDraft,
} from "./limits";

/**
 * Regras dos rascunhos. Tudo que vem do formulário é tratado como string
 * desconhecida e conferido aqui: tamanho, formato e, para trilha, plataforma,
 * capa e jam, presença no catálogo. Só valores aprovados chegam ao banco.
 */

const TRACK_IDS = new Set<string>(TRACKS.map((t) => t.id));
const PLATFORM_IDS = new Set<string>(Object.keys(PLATFORMS));
const COVER_IDS = new Set<string>(DRAFT_COVERS.map((c) => c.style));
const JAM_SLUGS = new Set<string>(JAMS.map((j) => j.slug));
const PRICE_KINDS = new Set<string>(["free", "fixed", "pwyw"]);

const len = (s: string) => [...s].length;

// Os três campos de texto (oneLine, paragraphs e splitTags) limpam do mesmo
// jeito, com stripInvisible; só o tratamento dos espaços muda.

/** Uma linha: sem invisíveis, qualquer espaço (inclusive quebra de linha) vira um só. */
function oneLine(raw: string): string {
  return stripInvisible(raw).replace(/\s+/g, " ").trim();
}

/** Texto com parágrafos: mantém quebras de linha, no máximo uma linha em branco seguida. */
function paragraphs(raw: string): string {
  return stripInvisible(raw)
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type DraftValues = Omit<ProjectDoc, "_id" | "userId" | "status" | "createdAt" | "updatedAt">;

type Parsed = { ok: true; value: DraftValues } | { ok: false; result: Extract<SaveResult, { ok: false }> };

const TAMPERED: Extract<SaveResult, { ok: false }> = {
  ok: false,
  code: "campos",
  error: "Algum valor do formulário não é válido. Recarregue a página e tente de novo.",
};

/** Lê e confere o rascunho enviado. Erros por campo voltam com o texto que o formulário mostra. */
export function parseDraft(form: FormData): Parsed {
  // Cortes generosos na leitura: o tamanho real é conferido depois, com mensagem.
  const title = oneLine(str(form, "titulo", LIMITS.title * 4));
  const tagline = oneLine(str(form, "frase", LIMITS.tagline * 4));
  const description = paragraphs(str(form, "descricao", LIMITS.description * 2));
  const tagsRaw = str(form, "etiquetas", LIMITS.tagsRaw * 2);
  const track = str(form, "trilha", 20);
  const cover = str(form, "capa", 20);
  const priceKind = str(form, "preco", 10);
  const amount = str(form, "valor", 20);
  const jam = str(form, "jam", 80);
  const platformList = form.getAll("plataforma");

  if (!TRACK_IDS.has(track) || !COVER_IDS.has(cover) || !PRICE_KINDS.has(priceKind)) return { ok: false, result: TAMPERED };
  if (jam && !JAM_SLUGS.has(jam)) return { ok: false, result: TAMPERED };
  if (platformList.length > PLATFORM_IDS.size) return { ok: false, result: TAMPERED };
  const platforms: Platform[] = [];
  for (const p of platformList) {
    if (typeof p !== "string" || !PLATFORM_IDS.has(p)) return { ok: false, result: TAMPERED };
    if (!platforms.includes(p as Platform)) platforms.push(p as Platform);
  }

  const fields: NonNullable<Extract<SaveResult, { ok: false }>["fields"]> = {};
  if (len(title) < 2) fields.title = "Dê um nome ao jogo, com pelo menos 2 letras, para salvar o rascunho.";
  else if (len(title) > LIMITS.title) fields.title = `Use até ${LIMITS.title} caracteres no título.`;
  if (len(tagline) > LIMITS.tagline) fields.tagline = `Use até ${LIMITS.tagline} caracteres na frase.`;
  if (len(description) > LIMITS.description) {
    fields.description = `A descrição passou de ${LIMITS.description.toLocaleString("pt-BR")} caracteres. Corte um pouco.`;
  }

  const tags = splitTags(tagsRaw);
  if (len(tagsRaw) > LIMITS.tagsRaw || tags.length > LIMITS.tags) {
    fields.tags = `Use até ${LIMITS.tags} etiquetas.`;
  } else if (tags.some((t) => len(t) > LIMITS.tag)) {
    fields.tags = `Cada etiqueta pode ter até ${LIMITS.tag} caracteres.`;
  }

  let price: ProjectPrice = { kind: "free" };
  const priceCheck = checkPrice(priceKind as PriceKind, amount);
  if (!priceCheck.ok) fields.amount = priceCheck.error;
  else if (priceKind === "fixed") price = { kind: "fixed", cents: priceCheck.cents };
  else if (priceKind === "pwyw") price = { kind: "pwyw", minimumCents: priceCheck.cents };

  if (Object.keys(fields).length) {
    const n = Object.keys(fields).length;
    return {
      ok: false,
      result: {
        ok: false,
        code: "campos",
        error: n === 1 ? "Confira o campo marcado antes de salvar." : `Confira os ${n} campos marcados antes de salvar.`,
        fields,
      },
    };
  }

  return {
    ok: true,
    value: {
      title,
      slug: suggestSlug(title),
      tagline,
      description,
      track: track as TrackId,
      tags,
      platforms,
      price,
      cover,
      jam: jam || null,
    },
  };
}

function toFields(doc: ProjectDoc): SavedDraft {
  const p = doc.price;
  const priceKind: PriceKind = p.kind;
  const amount = p.kind === "fixed" ? centsToText(p.cents) : p.kind === "pwyw" ? centsToText(p.minimumCents) : "5";
  // Valores gravados antes de uma mudança no catálogo caem no padrão, sem quebrar a página.
  return {
    id: doc._id.toHexString(),
    slug: doc.slug,
    updatedAt: doc.updatedAt.toISOString(),
    title: doc.title,
    tagline: doc.tagline,
    description: doc.description,
    track: TRACK_IDS.has(doc.track) ? doc.track : "navegador",
    tags: doc.tags.join(", "),
    platforms: doc.platforms.filter((x) => PLATFORM_IDS.has(x)),
    priceKind,
    amount,
    cover: (COVER_IDS.has(doc.cover) ? doc.cover : "orbit") as CoverStyle,
    jam: doc.jam && JAM_SLUGS.has(doc.jam) ? doc.jam : "",
  };
}

/** Um rascunho desta conta, ou null (id inválido, inexistente ou de outra conta: tudo igual). */
export async function readDraft(userId: ObjectId, rawId: string): Promise<SavedDraft | null> {
  const id = typeof rawId === "string" ? toObjectId(rawId) : null;
  if (!id) return null;
  const { projects } = await db();
  const doc = await projects.findOne({ _id: id, userId });
  return doc ? toFields(doc) : null;
}

/** Rascunhos desta conta, o mais recente primeiro. */
export async function listDrafts(userId: ObjectId): Promise<DraftRow[]> {
  const { projects } = await db();
  const docs = await projects
    .find({ userId }, { projection: { title: 1, tagline: 1, track: 1, jam: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .limit(LIMITS.drafts * 2)
    .toArray();
  return docs.map((d) => ({
    id: d._id.toHexString(),
    title: d.title,
    tagline: d.tagline,
    track: TRACK_IDS.has(d.track) ? d.track : "navegador",
    jam: d.jam && JAM_SLUGS.has(d.jam) ? d.jam : null,
    updatedAt: d.updatedAt.toISOString(),
  }));
}

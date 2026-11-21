"use server";

import { ObjectId } from "mongodb";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/lib/auth/db";
import { getSession, toObjectId } from "@/lib/auth/session";
import { itchCode } from "@/lib/projects/publish";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { str } from "@/lib/auth/validate";
import { getCatalog } from "@/lib/catalog/server";
import { LIMITS, suggestSlug } from "@/lib/projects/limits";
import { COVER_TYPES, coverBucket, coverUrl, magicMatches, newCoverKey, type CoverType } from "@/lib/projects/cover-store";
import { s3Fetch, storageConfigured } from "@/lib/storage/s3";
import { uploadWait } from "@/lib/uploads/novato";
import { ensureStorage } from "@/lib/storage/setup";
import { ItchError, fetchItchHtml, fetchItchImage, fetchItchJson } from "./fetch";
import { parseItch, parseItchUrl } from "./parse";

/*
 * "Trazer da itch.io": cola o endereço da página do jogo e ganha um rascunho com
 * texto, capa, capturas e detalhes; os arquivos vêm pelo painel do passo 3 (ver
 * files.ts). Quem chama é a sessão do cookie, nunca um id do formulário.
 */

export type ImportResult =
  | {
      ok: true;
      id: string;
      /** O jogo já tinha sido trazido por esta conta: abriu o rascunho que existia. */
      existing: boolean;
      /** A capa não pôde vir. */
      noCover: boolean;
      /** O preço do itch não é pago em reais: rever. */
      reviewPrice: boolean;
    }
  | { ok: false; error: string };

const PER_HOUR = 10;

export async function importFromItch(form: FormData): Promise<ImportResult> {
  if (!(form instanceof FormData)) return { ok: false, error: "Pedido inválido." };
  return guard(async (userId) => {
    const start = parseItchUrl(str(form, "itch", 300));
    if (!start) return { ok: false, error: "Cole o endereço da página do jogo no itch.io, começando com https://, como https://nome.itch.io/jogo." };
    return importCore(userId, start);
  });
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

/**
 * Confere se a página do itch.io de onde o rascunho veio mostra o código desta
 * conta (itchCode). Achou: o rascunho fica marcado como do autor, ou com a
 * permissão dele, e pode ser publicado.
 */
export async function verifyItchPage(form: FormData): Promise<VerifyResult> {
  if (!(form instanceof FormData)) return { ok: false, error: "Pedido inválido." };
  return guard(async (userId) => {
    const id = toObjectId(str(form, "id", 40));
    const { projects } = await db();
    const p = id && (await projects.findOne({ _id: id, userId, status: { $ne: "excluindo" } }, { projection: { source: 1 } }));
    const url = p ? p.source?.itchUrl : undefined;
    if (!p || !url) return { ok: false, error: "Esse rascunho não existe, não é da sua conta ou não veio do itch.io." };
    if (p.source?.verifiedAt) return { ok: true };
    const limit = await hit(`itch-conferir:${userId.toHexString()}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) return { ok: false, error: `Você conferiu muitas vezes seguidas. Espere ${waitText(limit.retryAfterMs)}.` };
    const code = itchCode(userId);
    if (!(await fetchItchHtml(url)).includes(code)) {
      return {
        ok: false,
        error: `Ainda não achamos o código ${code} na página ${url}. Cole o código na descrição do jogo no itch.io, salve lá e confira de novo. Se acabou de salvar, espere um minuto.`,
      };
    }
    const now = new Date();
    await projects.updateOne({ _id: p._id, userId }, { $set: { "source.verifiedAt": now, updatedAt: now } });
    return { ok: true };
  });
}

async function guard<T extends { ok: boolean }>(fn: (userId: ObjectId) => Promise<T | { ok: false; error: string }>): Promise<T | { ok: false; error: string }> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Sua sessão terminou. Entre de novo para continuar." };
    return await fn(session.user._id);
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ItchError) return { ok: false, error: err.message };
    console.error("[itch]", err);
    return { ok: false, error: "Não conseguimos falar com o itch.io agora. Tente de novo em instantes." };
  }
}

/** Uma imagem do itch no bucket de capas, com o tipo conferido pelos primeiros bytes (até 4 MB). Falhou: null. */
async function storeImage(raw: string): Promise<{ bucket: string; key: string; url: string } | null> {
  try {
    const bytes = await fetchItchImage(raw);
    const type = bytes && (Object.keys(COVER_TYPES) as CoverType[]).find((t) => magicMatches(t, bytes));
    if (!bytes || !type) return null;
    await ensureStorage();
    const key = newCoverKey(type);
    const res = await s3Fetch("PUT", coverBucket(), key, {
      headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" },
      body: bytes,
    });
    return res.ok ? { bucket: coverBucket(), key, url: coverUrl(key) } : null;
  } catch (err) {
    unstable_rethrow(err);
    console.error("[itch] imagem", err);
    return null;
  }
}

async function importCore(userId: ObjectId, start: URL): Promise<ImportResult> {
  const limit = await hit(`itch:${userId.toHexString()}`, PER_HOUR, 60 * 60 * 1000);
  if (!limit.allowed) return { ok: false, error: `Você já trouxe ${PER_HOUR} jogos na última hora. Espere ${waitText(limit.retryAfterMs)}.` };
  // Trazer do itch grava capa e imagens no armazenamento: conta nova espera como em qualquer envio.
  const wait = await uploadWait(userId);
  if (wait) return { ok: false, error: wait };

  const { projects } = await db();
  const { base, json } = await fetchItchJson(start);
  const itchId = (json as { id?: unknown } | null)?.id;
  if (typeof itchId === "number") {
    const dup = await projects.findOne({ userId, "source.itchId": itchId, status: { $ne: "excluindo" } }, { projection: { _id: 1 } });
    if (dup) return { ok: true, id: dup._id.toHexString(), existing: true, noCover: false, reviewPrice: false };
  }

  const html = await fetchItchHtml(base);
  const known = (await getCatalog()).tagCounts().map((t) => t.tag);
  const p = parseItch(html, json, base, known);
  if (!p) return { ok: false, error: "Não conseguimos ler esse jogo. Confira se o endereço é da página dele no itch.io." };

  if ((await projects.countDocuments({ userId })) >= LIMITS.drafts) {
    return { ok: false, error: `Você já tem ${LIMITS.drafts} rascunhos, o máximo por conta. Exclua algum para começar outro.` };
  }

  const store = storageConfigured();
  const coverImage = store && p.coverUrl ? await storeImage(p.coverUrl) : null;
  const screenshots = store ? (await Promise.all(p.screenshots.map(storeImage))).filter((x): x is NonNullable<typeof x> => x !== null) : [];

  const now = new Date();
  const _id = new ObjectId();
  await projects.insertOne({
    _id,
    userId,
    title: p.title,
    slug: suggestSlug(p.title),
    tagline: p.tagline,
    description: p.description,
    track: p.track,
    tags: p.tags,
    platforms: p.platforms,
    price: p.price,
    cover: "orbit",
    jam: null,
    coverImage,
    session: p.session || undefined,
    languages: p.languages,
    controls: p.controls,
    accessibility: p.accessibility,
    contentNotes: p.contentNotes,
    credits: p.credits,
    screenshots,
    source: { itchUrl: p.itchUrl, itchId: p.itchId },
    status: "rascunho",
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, id: _id.toHexString(), existing: false, noCover: !coverImage, reviewPrice: p.reviewPrice };
}

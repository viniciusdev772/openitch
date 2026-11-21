"use server";

import { ObjectId } from "mongodb";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/lib/auth/db";
import { getSession } from "@/lib/auth/session";
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

async function guard(fn: (userId: ObjectId) => Promise<ImportResult>): Promise<ImportResult> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Sua sessão terminou. Entre de novo para trazer um jogo." };
    return await fn(session.user._id);
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ItchError) return { ok: false, error: err.message };
    console.error("[itch]", err);
    return { ok: false, error: "Não conseguimos trazer o jogo agora. Tente de novo em instantes." };
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

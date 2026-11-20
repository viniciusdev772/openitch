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
import { ensureStorage } from "@/lib/storage/setup";
import { ItchError, fetchItchHtml, fetchItchImage, fetchItchJson } from "./fetch";
import { itchGames } from "./api";
import { connectItchKey, disconnectItchKey, itchKeyOf } from "./files";
import { parseItch, parseItchUrl } from "./parse";

/*
 * "Trazer da itch.io": pelo endereço da página (qualquer jogo público: texto,
 * capa, capturas e detalhes) ou pela lista de jogos da conta ligada com a chave
 * da API (aí o rascunho já sai como seu, e os arquivos vêm pelo painel do passo
 * 3, ver files.ts). Quem chama é a sessão do cookie, nunca um id do formulário.
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
      /** O jogo está na conta do itch ligada: os arquivos podem vir. */
      verified: boolean;
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

/** Traz um jogo da lista da conta ligada (o id vem do navegador e é conferido na lista de novo aqui). */
export async function importItchGame(gameId: number): Promise<ImportResult> {
  return guard(async (userId) => {
    const k = await itchKeyOf(userId);
    if (!k) return { ok: false, error: "Ligue sua conta do itch.io primeiro." };
    const game = (await itchGames(k.key)).find((g) => g.id === gameId);
    const start = game ? parseItchUrl(game.url) : null;
    if (!start) return { ok: false, error: "Esse jogo não está na sua conta do itch.io." };
    return importCore(userId, start, true);
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

async function importCore(userId: ObjectId, start: URL, verifiedIn = false): Promise<ImportResult> {
  const limit = await hit(`itch:${userId.toHexString()}`, PER_HOUR, 60 * 60 * 1000);
  if (!limit.allowed) return { ok: false, error: `Você já trouxe ${PER_HOUR} jogos na última hora. Espere ${waitText(limit.retryAfterMs)}.` };

  const { projects } = await db();
  const { base, json } = await fetchItchJson(start);
  const itchId = (json as { id?: unknown } | null)?.id;
  if (typeof itchId === "number") {
    const dup = await projects.findOne({ userId, "source.itchId": itchId, status: { $ne: "excluindo" } }, { projection: { _id: 1, source: 1 } });
    if (dup) {
      if (verifiedIn && !dup.source?.verified) await projects.updateOne({ _id: dup._id, userId }, { $set: { "source.verified": true } });
      return { ok: true, id: dup._id.toHexString(), existing: true, noCover: false, reviewPrice: false, verified: verifiedIn || Boolean(dup.source?.verified) };
    }
  }

  const html = await fetchItchHtml(base);
  const known = (await getCatalog()).tagCounts().map((t) => t.tag);
  const p = parseItch(html, json, base, known);
  if (!p) return { ok: false, error: "Não conseguimos ler esse jogo. Confira se o endereço é da página dele no itch.io." };

  if ((await projects.countDocuments({ userId })) >= LIMITS.drafts) {
    return { ok: false, error: `Você já tem ${LIMITS.drafts} rascunhos, o máximo por conta. Exclua algum para começar outro.` };
  }

  // Com a chave ligada, o jogo na lista da conta prova que é seu.
  let verified = verifiedIn;
  if (!verified) {
    const k = await itchKeyOf(userId).catch(() => null);
    if (k) verified = await itchGames(k.key).then((g) => g.some((x) => x.id === p.itchId)).catch(() => false);
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
    source: { itchUrl: p.itchUrl, itchId: p.itchId, verified },
    status: "rascunho",
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, id: _id.toHexString(), existing: false, noCover: !coverImage, reviewPrice: p.reviewPrice, verified };
}

/* ------------------------------------------------------------------ */
/* Conta do itch.io (chave da API)                                     */
/* ------------------------------------------------------------------ */

export type ItchAccount =
  | { ok: true; connected: false }
  | {
      ok: true;
      connected: true;
      username: string;
      games: { id: number; title: string; url: string; coverUrl: string | null; shortText: string; imported: string | null }[];
    }
  | { ok: false; error: string };

/** A conta ligada e os jogos dela (com o rascunho daqui de cada um, se já trazido). */
export async function itchAccount(): Promise<ItchAccount> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Sua sessão terminou. Entre de novo." };
    const userId = session.user._id;
    const k = await itchKeyOf(userId);
    if (!k) return { ok: true, connected: false };
    const games = await itchGames(k.key);
    const { projects } = await db();
    const mine = await projects
      .find({ userId, "source.itchId": { $in: games.map((g) => g.id) }, status: { $ne: "excluindo" } }, { projection: { source: 1 } })
      .toArray();
    return {
      ok: true,
      connected: true,
      username: k.username,
      games: games.map(({ published: _p, ...g }) => ({ ...g, imported: mine.find((m) => m.source?.itchId === g.id)?._id.toHexString() ?? null })),
    };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ItchError) return { ok: false, error: err.message };
    console.error("[itch] conta", err);
    return { ok: false, error: "Não conseguimos falar com o itch.io agora. Tente de novo em instantes." };
  }
}

export async function connectItch(form: FormData): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  if (!(form instanceof FormData)) return { ok: false, error: "Pedido inválido." };
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Sua sessão terminou. Entre de novo." };
    const limit = await hit(`itch:chave:${session.user._id.toHexString()}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) return { ok: false, error: `Muitas tentativas. Espere ${waitText(limit.retryAfterMs)}.` };
    const { username } = await connectItchKey(session.user._id, str(form, "chave", 200));
    return { ok: true, username };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ItchError) return { ok: false, error: err.message };
    console.error("[itch] chave", err);
    return { ok: false, error: "Não conseguimos conferir a chave agora. Tente de novo em instantes." };
  }
}

export async function disconnectItch(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Sua sessão terminou. Entre de novo." };
    await disconnectItchKey(session.user._id);
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[itch] desligar", err);
    return { ok: false, error: "Não conseguimos desligar agora. Tente de novo." };
  }
}

"use server";

import { unstable_rethrow } from "next/navigation";
import { db } from "@/lib/auth/db";
import { getSession, toObjectId } from "@/lib/auth/session";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { str } from "@/lib/auth/validate";
import { headObject, presign, s3Fetch, storageConfigured } from "@/lib/storage/s3";
import { ensureStorage } from "@/lib/storage/setup";
import { revalidateIfLive } from "@/lib/catalog/revalidate";
import {
  COVER_KEY_RE,
  COVER_MAX_BYTES,
  COVER_TYPES,
  coverBucket,
  coverUrl,
  deleteCoverObjects,
  magicMatches,
  newCoverKey,
  type CoverType,
} from "./cover-store";

/*
 * Capa do jogo: o navegador envia a imagem direto para o armazenamento (URL
 * assinada com tipo e tamanho exatos) e depois pede para confirmar; só então
 * ela entra no projeto. Tudo conferido aqui, para o dono do rascunho.
 */

export type CoverResult =
  | { ok: true; url: string | null; upload?: { url: string; headers: Record<string, string> }; key?: string }
  | { ok: false; error: string };

const NOT_FOUND = "Esse rascunho não existe ou não é da sua conta.";
const DOWN = "Não conseguimos falar com o armazenamento agora. Tente de novo em instantes.";
const CACHE = "public, max-age=31536000, immutable";

async function owner(form: FormData) {
  const session = await getSession();
  if (!session) return { error: "Sua sessão terminou. Entre de novo para trocar a capa." } as const;
  const id = toObjectId(str(form, "id", 40));
  if (!id) return { error: NOT_FOUND } as const;
  const limit = await hit(`capa:${session.user._id.toHexString()}`, 20, 10 * 60 * 1000);
  if (!limit.allowed) return { error: `Muitas trocas de capa seguidas. Espere ${waitText(limit.retryAfterMs)}.` } as const;
  const { projects } = await db();
  const p = await projects.findOne({ _id: id, userId: session.user._id, status: { $ne: "excluindo" } });
  if (!p) return { error: NOT_FOUND } as const;
  return { p } as const;
}

/** Assina o envio de uma imagem (PNG, JPEG ou WebP, até 4 MB). */
export async function signCover(form: FormData): Promise<CoverResult> {
  if (!(form instanceof FormData)) return { ok: false, error: "Pedido inválido." };
  try {
    if (!storageConfigured()) return { ok: false, error: "O envio de arquivos ainda não está ligado neste site." };
    const who = await owner(form);
    if ("error" in who) return { ok: false, error: who.error! };
    const type = str(form, "tipo", 20) as CoverType;
    const size = Number(str(form, "tamanho", 12));
    if (!(type in COVER_TYPES)) return { ok: false, error: "Use uma imagem PNG, JPEG ou WebP." };
    if (!Number.isInteger(size) || size <= 0) return { ok: false, error: "Esse arquivo está vazio." };
    if (size > COVER_MAX_BYTES) return { ok: false, error: "A imagem passou de 4 MB. Exporte menor (1200 × 960 px basta)." };
    await ensureStorage();
    const { projects } = await db();
    // Um envio anterior que não foi confirmado sai antes.
    if (who.p.pendingCover) await deleteCoverObjects({ coverImage: null, pendingCover: who.p.pendingCover });
    const key = newCoverKey(type);
    await projects.updateOne({ _id: who.p._id }, { $set: { pendingCover: { key, type, at: new Date() } } });
    const headers = { "content-type": type, "cache-control": CACHE };
    const url = presign("PUT", coverBucket(), key, { expires: 15 * 60, headers: { ...headers, "content-length": String(size) } });
    return { ok: true, url: null, upload: { url, headers }, key };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[capa]", err);
    return { ok: false, error: DOWN };
  }
}

/** Confere a imagem enviada (tamanho, tipo e primeiros bytes) e põe na página. */
export async function confirmCover(form: FormData): Promise<CoverResult> {
  if (!(form instanceof FormData)) return { ok: false, error: "Pedido inválido." };
  try {
    const who = await owner(form);
    if ("error" in who) return { ok: false, error: who.error! };
    const key = str(form, "chave", 120);
    const pending = who.p.pendingCover;
    if (!pending || pending.key !== key || !COVER_KEY_RE.test(key)) return { ok: false, error: "Esse envio de capa expirou. Escolha a imagem de novo." };
    const { projects } = await db();
    const reject = async (error: string) => {
      await deleteCoverObjects({ coverImage: null, pendingCover: pending });
      await projects.updateOne({ _id: who.p._id }, { $set: { pendingCover: null } });
      return { ok: false as const, error };
    };
    const head = await headObject(coverBucket(), key);
    if (!head) return reject("A imagem não chegou ao armazenamento. Tente de novo.");
    if (head.size <= 0 || head.size > COVER_MAX_BYTES || head.contentType !== pending.type) return reject("A imagem chegou diferente do esperado. Tente de novo.");
    const res = await s3Fetch("GET", coverBucket(), key, { headers: { range: "bytes=0-15" } });
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!res.ok || !magicMatches(pending.type as CoverType, bytes)) return reject("Esse arquivo não é uma imagem PNG, JPEG ou WebP de verdade.");

    const old = who.p.coverImage;
    const cover = { bucket: coverBucket(), key, url: coverUrl(key) };
    await projects.updateOne({ _id: who.p._id }, { $set: { coverImage: cover, pendingCover: null, updatedAt: new Date() } });
    if (old) await deleteCoverObjects({ coverImage: old });
    await revalidateIfLive(who.p._id);
    return { ok: true, url: cover.url };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[capa]", err);
    return { ok: false, error: DOWN };
  }
}

/** Tira a imagem: a página volta para a capa provisória escolhida. */
export async function removeCover(form: FormData): Promise<CoverResult> {
  if (!(form instanceof FormData)) return { ok: false, error: "Pedido inválido." };
  try {
    const who = await owner(form);
    if ("error" in who) return { ok: false, error: who.error! };
    const { projects } = await db();
    await projects.updateOne({ _id: who.p._id }, { $set: { coverImage: null, pendingCover: null, updatedAt: new Date() } });
    await deleteCoverObjects(who.p);
    await revalidateIfLive(who.p._id);
    return { ok: true, url: null };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[capa]", err);
    return { ok: false, error: DOWN };
  }
}

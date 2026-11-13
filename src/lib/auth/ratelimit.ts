import "server-only";
import { db } from "./db";
import { hmac } from "./crypto";

/**
 * Contadores de janela fixa guardados no MongoDB, atualizados de forma
 * atômica. A chave é gravada como HMAC, então o banco não guarda e-mails nem
 * IPs em claro nesta coleção.
 */

export interface Limit {
  allowed: boolean;
  count: number;
  retryAfterMs: number;
}

function id(key: string) {
  return hmac("ratelimit", key);
}

/** Conta mais uma tentativa e diz se ainda está dentro do limite. */
export async function hit(key: string, limit: number, windowMs: number): Promise<Limit> {
  const { rateLimits } = await db();
  const _id = id(key);
  const expired = { $or: [{ $not: ["$resetAt"] }, { $lte: ["$resetAt", "$$NOW"] }] };
  const update = [
    {
      $set: {
        count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
        resetAt: { $cond: [expired, { $add: ["$$NOW", windowMs] }, "$resetAt"] },
      },
    },
  ];
  let doc;
  try {
    doc = await rateLimits.findOneAndUpdate({ _id }, update, { upsert: true, returnDocument: "after" });
  } catch (err) {
    // Duas inserções simultâneas da mesma chave: a segunda tenta de novo.
    if ((err as { code?: number }).code !== 11000) throw err;
    doc = await rateLimits.findOneAndUpdate({ _id }, update, { upsert: true, returnDocument: "after" });
  }
  const count = doc?.count ?? 1;
  const retryAfterMs = doc ? Math.max(0, doc.resetAt.getTime() - Date.now()) : windowMs;
  return { allowed: count <= limit, count, retryAfterMs };
}

/** Consulta sem contar. */
export async function peek(key: string, limit: number): Promise<Limit> {
  const { rateLimits } = await db();
  const doc = await rateLimits.findOne({ _id: id(key) });
  if (!doc || doc.resetAt.getTime() <= Date.now()) return { allowed: true, count: 0, retryAfterMs: 0 };
  return { allowed: doc.count < limit, count: doc.count, retryAfterMs: doc.resetAt.getTime() - Date.now() };
}

export async function clear(key: string): Promise<void> {
  const { rateLimits } = await db();
  await rateLimits.deleteOne({ _id: id(key) });
}

export function waitText(ms: number): string {
  const min = Math.ceil(ms / 60000);
  return min <= 1 ? "1 minuto" : `${min} minutos`;
}

import "server-only";
import type { ObjectId } from "mongodb";
import { db } from "@/lib/auth/db";
import { hmac } from "@/lib/auth/crypto";
import { openAtFor, waitMessage } from "./novato-rules";

/*
 * Conta nova não envia arquivos (downloads, builds, capas, imagens) logo de
 * cara: espera de 3 horas a 3 dias, sorteada por conta. O sorteio é o HMAC do
 * id com o segredo do servidor: fixo para a conta (não muda a cada pedido, nada
 * gravado no banco) e imprevisível para quem cria contas em série, que não tem
 * como programar o ataque para a hora em que a trava sai.
 */

export function uploadsOpenAt(u: { _id: ObjectId; createdAt: Date }): Date {
  return openAtFor(u.createdAt, hmac("novato", u._id.toHexString()));
}

/** O aviso para quem ainda espera, ou null se a conta já pode enviar. */
export function uploadWaitFor(u: { _id: ObjectId; createdAt: Date }, now = Date.now()): string | null {
  const at = uploadsOpenAt(u);
  return at.getTime() > now ? waitMessage(at, now) : null;
}

/** Igual a uploadWaitFor, a partir do id da sessão. */
export async function uploadWait(userId: ObjectId): Promise<string | null> {
  const u = await (await db()).users.findOne({ _id: userId }, { projection: { createdAt: 1 } });
  return u ? uploadWaitFor({ _id: userId, createdAt: u.createdAt }) : null;
}

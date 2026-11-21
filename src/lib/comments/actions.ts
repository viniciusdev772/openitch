"use server";

import { unstable_rethrow } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { editComment, postComment, removeComment, setLike, type Result } from "./server";

/*
 * Ações dos comentários e curtidas, chamadas pela ilha da página do jogo.
 * Sessão obrigatória; limites por conta contra spam e cliques em rajada.
 */

const MIN = 60 * 1000;
const DOWN: Result = { ok: false, error: "Não conseguimos falar com o servidor agora. Tente de novo em instantes." };
const OUT: Result = { ok: false, error: "Entre na sua conta para comentar e curtir." };

async function run(bucket: string, max: number, fn: (user: NonNullable<Awaited<ReturnType<typeof getSession>>>["user"]) => Promise<Result>): Promise<Result> {
  try {
    const session = await getSession();
    if (!session) return OUT;
    const l = await hit(`${bucket}:${session.user._id.toHexString()}`, max, 10 * MIN);
    if (!l.allowed) return { ok: false, error: `Muitas ações seguidas. Espere ${waitText(l.retryAfterMs)}.` };
    return await fn(session.user);
  } catch (err) {
    unstable_rethrow(err);
    console.error(`[${bucket}]`, err);
    return DOWN;
  }
}

export async function sendComment(input: { jogo: string; texto: string; resposta?: string | null }): Promise<Result> {
  return run("comentar", 10, (u) => postComment(u, input?.jogo, input?.texto, input?.resposta ?? null));
}

export async function changeComment(input: { id: string; texto: string }): Promise<Result> {
  return run("comentar:editar", 20, (u) => editComment(u, input?.id, input?.texto));
}

export async function deleteComment(input: { id: string }): Promise<Result> {
  return run("comentar:apagar", 30, (u) => removeComment(u._id, input?.id));
}

export async function like(input: { tipo: "jogo" | "comentario"; id: string; curtir: boolean }): Promise<Result> {
  return run("curtir", 120, (u) => setLike(u._id, input?.tipo, input?.id, input?.curtir === true));
}

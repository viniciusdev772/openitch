"use server";

import { ObjectId } from "mongodb";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/auth/db";
import { getSession, toObjectId } from "@/lib/auth/session";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { str } from "@/lib/auth/validate";
import { LIMITS, WRITES_PER_WINDOW, WRITE_WINDOW_MS, type DeleteResult, type SaveResult } from "./limits";
import { parseDraft } from "./rules";

/*
 * Rascunhos de jogos. Cada ação é um endpoint público: confere sozinha quem
 * chama (a sessão do cookie, nunca um id de usuário vindo do formulário) e só
 * lê ou grava documentos com { _id, userId } dessa sessão. Um id forjado, de
 * outra conta ou inexistente dá a mesma resposta: "não encontrado".
 * O Next recusa POSTs de outra origem e o cookie de sessão é SameSite=Lax.
 */

const SERVER_DOWN = "Não conseguimos salvar agora. O que você escreveu continua aqui: tente de novo em instantes.";
const NO_SESSION = "Sua sessão terminou. Entre de novo para salvar; o que você escreveu fica guardado neste navegador.";
const NOT_FOUND = "Esse rascunho não existe ou não é da sua conta.";
const FULL = `Você já tem ${LIMITS.drafts} rascunhos, o máximo por conta. Exclua algum para começar outro.`;

const writeKey = (userId: ObjectId) => `projetos:${userId.toHexString()}`;

/** Cria (sem id) ou atualiza (com id) um rascunho de quem está dentro. */
export async function saveDraft(form: FormData): Promise<SaveResult> {
  if (!(form instanceof FormData)) return { ok: false, code: "campos", error: "Pedido inválido." };
  try {
    const session = await getSession();
    if (!session) return { ok: false, code: "sessao", error: NO_SESSION };
    const userId = session.user._id;

    const rawId = str(form, "id", 40);
    let id: ObjectId | null = null;
    if (rawId) {
      id = toObjectId(rawId);
      if (!id) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    }

    const parsed = parseDraft(form);
    if (!parsed.ok) return parsed.result;

    const limit = await hit(writeKey(userId), WRITES_PER_WINDOW, WRITE_WINDOW_MS);
    if (!limit.allowed) {
      return {
        ok: false,
        code: "taxa",
        error: `Muitas gravações seguidas. Espere ${waitText(limit.retryAfterMs)} e salve de novo; nada do que está na tela se perde.`,
      };
    }

    const { projects } = await db();
    const now = new Date();
    if (id) {
      const res = await projects.updateOne({ _id: id, userId }, { $set: { ...parsed.value, updatedAt: now } });
      if (res.matchedCount !== 1) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    } else {
      if ((await projects.countDocuments({ userId })) >= LIMITS.drafts) return { ok: false, code: "limite", error: FULL };
      const _id = new ObjectId();
      await projects.insertOne({
        _id,
        userId,
        ...parsed.value,
        status: "rascunho",
        createdAt: now,
        updatedAt: now,
      });
      // Conferido depois de gravar, para que pedidos simultâneos não passem do teto.
      if ((await projects.countDocuments({ userId })) > LIMITS.drafts) {
        await projects.deleteOne({ _id, userId });
        return { ok: false, code: "limite", error: FULL };
      }
      id = _id;
    }
    return { ok: true, id: id.toHexString(), slug: parsed.value.slug, savedAt: now.toISOString() };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[projetos]", err);
    return { ok: false, code: "servidor", error: SERVER_DOWN };
  }
}

/** Exclui um rascunho de quem está dentro. Exige a confirmação explícita do formulário. */
export async function deleteDraft(form: FormData): Promise<DeleteResult> {
  if (!(form instanceof FormData)) return { ok: false, error: "Pedido inválido." };
  try {
    const session = await getSession();
    if (!session) return { ok: false, code: "sessao", error: "Sua sessão terminou. Entre de novo para excluir." };
    const userId = session.user._id;
    if (str(form, "confirmar", 10) !== "excluir") {
      return { ok: false, error: "Confirme a exclusão com o botão Excluir de vez." };
    }
    const id = toObjectId(str(form, "id", 40));
    if (!id) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };

    const limit = await hit(writeKey(userId), WRITES_PER_WINDOW, WRITE_WINDOW_MS);
    if (!limit.allowed) {
      return { ok: false, code: "taxa", error: `Muitas alterações seguidas. Espere ${waitText(limit.retryAfterMs)}.` };
    }

    const { projects } = await db();
    const res = await projects.deleteOne({ _id: id, userId });
    if (res.deletedCount !== 1) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    revalidatePath("/conta/projetos");
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[projetos]", err);
    return { ok: false, code: "servidor", error: "Não conseguimos excluir agora. O rascunho continua salvo; tente de novo em instantes." };
  }
}

"use server";

import { ObjectId } from "mongodb";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/auth/db";
import { getSession, toObjectId } from "@/lib/auth/session";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { str } from "@/lib/auth/validate";
import {
  LIMITS,
  WRITES_PER_WINDOW,
  WRITE_WINDOW_MS,
  publishFieldProblems,
  type DeleteResult,
  type PublishResult,
  type SaveResult,
} from "./limits";
import { parseDraft } from "./rules";
import { ensureCreatorSlug, ensureNumber, ensurePublicSlug, publishProblems } from "./publish";
import { revalidatePublic } from "@/lib/catalog/revalidate";
import { deleteUploadsOfProject } from "@/lib/uploads/server";
import { deleteBuildsOfProject } from "@/lib/builds/cleanup";

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
      const current = await projects.findOne({ _id: id, userId, status: { $ne: "excluindo" } }, { projection: { status: 1 } });
      if (!current) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
      const live = current.status === "publicado";
      if (live) {
        // Publicado, cada gravação vai ao ar: a página tem de continuar completa.
        const v = parsed.value;
        const fields = publishFieldProblems({
          title: v.title,
          tagline: v.tagline,
          description: v.description,
          platforms: v.platforms,
          priceKind: v.price.kind,
        });
        const n = Object.keys(fields).length;
        if (n) {
          return {
            ok: false,
            code: "campos",
            error: `Este jogo está no programa, então a página precisa continuar completa. Confira ${n === 1 ? "o campo marcado" : `os ${n} campos marcados`}, ou tire o jogo do ar antes.`,
            fields,
          };
        }
      }
      const res = await projects.updateOne({ _id: id, userId, status: current.status }, { $set: { ...parsed.value, updatedAt: now } });
      if (res.matchedCount !== 1) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
      if (live) revalidatePublic();
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
    // Marca primeiro: a partir daqui nenhum envio novo entra neste rascunho (envios e builds
    // recusam projetos "excluindo"), então nada fica órfão entre apagar os arquivos e o registro.
    const marked = await projects.updateOne({ _id: id, userId }, { $set: { status: "excluindo", updatedAt: new Date() } });
    if (marked.matchedCount !== 1) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    // Arquivos e builds antes do registro: se o armazenamento falhar, o rascunho fica
    // (marcado) e a pessoa tenta de novo para terminar.
    await deleteUploadsOfProject(userId, id);
    await deleteBuildsOfProject(userId, id);
    const res = await projects.deleteOne({ _id: id, userId });
    if (res.deletedCount !== 1) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    revalidatePath("/conta/projetos");
    revalidatePublic();
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[projetos]", err);
    return {
      ok: false,
      code: "servidor",
      error: "A exclusão não terminou: parte dos arquivos pode já ter sido apagada. Tente excluir de novo em instantes para concluir.",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Publicação                                                          */
/* ------------------------------------------------------------------ */

const PUBLISH_DOWN = "Não conseguimos falar com o servidor agora. Nada mudou: tente de novo em instantes.";

type Owned = { ok: true; userId: ObjectId; id: ObjectId } | { ok: false; result: Extract<PublishResult, { ok: false }> };

/** Sessão, id e taxa: o começo comum de publicar, conferir e tirar do ar. */
async function owned(form: FormData, limited: boolean): Promise<Owned> {
  const session = await getSession();
  if (!session) return { ok: false, result: { ok: false, code: "sessao", error: "Sua sessão terminou. Entre de novo para publicar." } };
  const userId = session.user._id;
  const id = toObjectId(str(form, "id", 40));
  if (!id) return { ok: false, result: { ok: false, code: "nao_encontrado", error: NOT_FOUND } };
  if (limited) {
    const limit = await hit(writeKey(userId), WRITES_PER_WINDOW, WRITE_WINDOW_MS);
    if (!limit.allowed) {
      return { ok: false, result: { ok: false, code: "taxa", error: `Muitas alterações seguidas. Espere ${waitText(limit.retryAfterMs)}.` } };
    }
  }
  return { ok: true, userId, id };
}

const pendencias = (n: number) =>
  n === 1 ? "Falta uma coisa para o jogo entrar no programa." : `Faltam ${n} coisas para o jogo entrar no programa.`;

/** Confere, sem mudar nada, o que falta para publicar este rascunho. */
export async function checkPublish(form: FormData): Promise<PublishResult> {
  if (!(form instanceof FormData)) return { ok: false, code: "nao_encontrado", error: "Pedido inválido." };
  try {
    const who = await owned(form, false);
    if (!who.ok) return who.result;
    const { projects } = await db();
    const p = await projects.findOne({ _id: who.id, userId: who.userId, status: { $ne: "excluindo" } });
    if (!p) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    const problems = await publishProblems(p);
    const state = p.status === "publicado" ? "publicado" : "rascunho";
    if (problems.length) return { ok: false, code: "pendencias", error: pendencias(problems.length), problems };
    return { ok: true, state, slug: p.publicSlug ?? null, number: p.number ?? null };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[publicar]", err);
    return { ok: false, code: "servidor", error: PUBLISH_DOWN };
  }
}

/** Põe o rascunho no programa: aberto a todos, com endereço e número próprios. */
export async function publishProject(form: FormData): Promise<PublishResult> {
  if (!(form instanceof FormData)) return { ok: false, code: "nao_encontrado", error: "Pedido inválido." };
  try {
    const who = await owned(form, true);
    if (!who.ok) return who.result;
    const { projects } = await db();
    const p = await projects.findOne({ _id: who.id, userId: who.userId, status: { $ne: "excluindo" } });
    if (!p) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    const problems = await publishProblems(p);
    if (problems.length) return { ok: false, code: "pendencias", error: pendencias(problems.length), problems };

    await ensureCreatorSlug(who.userId);
    const slug = await ensurePublicSlug(p);
    const number = await ensureNumber(p);
    const now = new Date();
    const res = await projects.updateOne(
      { _id: p._id, userId: who.userId, status: { $in: ["rascunho", "publicado"] } },
      [{ $set: { status: "publicado", updatedAt: now, publishedAt: { $ifNull: ["$publishedAt", now] } } }],
    );
    if (res.matchedCount !== 1) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    revalidatePath("/conta/projetos");
    revalidatePublic();
    return { ok: true, state: "publicado", slug, number };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[publicar]", err);
    return { ok: false, code: "servidor", error: PUBLISH_DOWN };
  }
}

/** Tira o jogo do programa. Volta a rascunho; endereço e número ficam guardados para a volta. */
export async function unpublishProject(form: FormData): Promise<PublishResult> {
  if (!(form instanceof FormData)) return { ok: false, code: "nao_encontrado", error: "Pedido inválido." };
  try {
    const who = await owned(form, true);
    if (!who.ok) return who.result;
    const { projects } = await db();
    const p = await projects.findOneAndUpdate(
      { _id: who.id, userId: who.userId, status: { $in: ["rascunho", "publicado"] } },
      { $set: { status: "rascunho", updatedAt: new Date() } },
      { projection: { publicSlug: 1, number: 1 }, returnDocument: "after" },
    );
    if (!p) return { ok: false, code: "nao_encontrado", error: NOT_FOUND };
    revalidatePath("/conta/projetos");
    revalidatePublic();
    return { ok: true, state: "rascunho", slug: p.publicSlug ?? null, number: p.number ?? null };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[publicar]", err);
    return { ok: false, code: "servidor", error: PUBLISH_DOWN };
  }
}

import "server-only";
import { ObjectId } from "mongodb";
import { db, type CommentDoc, type UserDoc } from "@/lib/auth/db";
import { toObjectId } from "@/lib/auth/session";
import { activeBan } from "@/lib/moderation/server";
import { ruleById } from "@/lib/moderation/rules";
import { uploadWaitFor } from "@/lib/uploads/novato";
import { cleanComment, COMMENTS_PAGE, hasLink, REPLIES_MAX } from "./rules";

/*
 * Comentários e curtidas da página de um jogo publicado.
 *
 * Ler é aberto (com ou sem conta); escrever, responder, curtir e apagar
 * pedem sessão, e toda escrita confere dono pelo id da sessão. Quem decide se
 * um comentário fica é o tribunal de moderação (denúncia → julgamento →
 * recurso), igual aos jogos; quem criou o jogo pode ocultar comentários da
 * própria página.
 */

export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export interface CommentView {
  id: string;
  /** null: o comentário não está mais visível (fica só para manter o fio). */
  author: { name: string; href: string | null; creator: boolean } | null;
  body: string;
  at: string;
  edited: boolean;
  likes: number;
  liked: boolean;
  state: CommentDoc["status"] | "indisponivel";
  mine: boolean;
  /** Só para quem escreveu um comentário removido pela moderação. */
  moderation?: { rule: string; reasoning: string | null; decisionId: string; appealId: string | null; appeal: "mantido" | "analisando" | null };
  replies: CommentView[];
}

export interface ThreadView {
  game: { likes: number; liked: boolean; comments: number };
  comments: CommentView[];
  /** Cursor da próxima página de comentários (mais antigos). */
  next: string | null;
  viewer: { signedIn: boolean; owner: boolean; noLinks: string | null };
}

const gameTarget = (id: ObjectId) => `jogo:${id.toHexString()}`;
const commentTarget = (id: ObjectId) => `comentario:${id.toHexString()}`;

async function publishedBySlug(slug: unknown) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { projects } = await db();
  return projects.findOne({ publicSlug: slug, status: "publicado" }, { projection: { _id: 1, userId: 1, title: 1 } });
}

/* ------------------------------------------------------------------ */
/* Ler                                                                 */
/* ------------------------------------------------------------------ */

export async function threadFor(slug: unknown, viewer: Pick<UserDoc, "_id" | "createdAt"> | null, before: unknown): Promise<ThreadView | null> {
  const p = await publishedBySlug(slug);
  if (!p) return null;
  const { comments, users, likes, moderation } = await db();
  const cursor = typeof before === "string" ? toObjectId(before) : null;

  const top = await comments
    .find({ projectId: p._id, parentId: null, ...(cursor ? { _id: { $lt: cursor } } : {}) })
    .sort({ _id: -1 })
    .limit(COMMENTS_PAGE + 1)
    .toArray();
  const more = top.length > COMMENTS_PAGE;
  if (more) top.pop();
  const replies = top.length
    ? await comments
        .find({ parentId: { $in: top.map((c) => c._id) } })
        .sort({ _id: 1 })
        .limit(COMMENTS_PAGE * REPLIES_MAX)
        .toArray()
    : [];
  const all = [...top, ...replies];

  const [authors, mineLikes, gameLikes, gameLiked, count] = await Promise.all([
    users
      .find({ _id: { $in: [...new Set(all.map((c) => c.authorId.toHexString()))].map((x) => new ObjectId(x)) } }, { projection: { name: 1, creatorSlug: 1, ban: 1 } })
      .toArray(),
    viewer && all.length
      ? likes.find({ userId: viewer._id, target: { $in: all.map((c) => commentTarget(c._id)) } }, { projection: { target: 1 } }).toArray()
      : [],
    likes.countDocuments({ target: gameTarget(p._id) }),
    viewer ? likes.countDocuments({ userId: viewer._id, target: gameTarget(p._id) }, { limit: 1 }) : 0,
    comments.countDocuments({ projectId: p._id, status: "visivel" }),
  ]);
  const byId = new Map(authors.map((u) => [u._id.toHexString(), u]));
  const liked = new Set(mineLikes.map((l) => l.target));

  // Fundamentação das remoções, só para quem escreveu.
  const ownRemoved = viewer ? all.filter((c) => c.status === "removido" && c.authorId.equals(viewer._id) && c.moderation) : [];
  const decisions = ownRemoved.length
    ? await moderation
        .find({ _id: { $in: ownRemoved.map((c) => c.moderation!.decisionId) } }, { projection: { reasoning: 1 } })
        .toArray()
    : [];
  const reasoningOf = new Map(decisions.map((d) => [d._id.toHexString(), d.reasoning ?? null]));

  const view = (c: CommentDoc, kids: CommentView[]): CommentView | null => {
    const a = byId.get(c.authorId.toHexString());
    const mine = Boolean(viewer && c.authorId.equals(viewer._id));
    const banned = Boolean(a && activeBan(a));
    const shown = c.status === "visivel" && a && !banned;
    const ownRemoval = c.status === "removido" && mine && c.moderation;
    // Fora do ar e sem respostas visíveis: some. Com respostas: fica o lugar, sem autor nem texto.
    if (!shown && !ownRemoval && !kids.length) return null;
    const base = {
      id: c._id.toHexString(),
      at: c.createdAt.toISOString(),
      edited: Boolean(c.editedAt),
      likes: c.likes,
      liked: liked.has(commentTarget(c._id)),
      mine,
      replies: kids,
    };
    if (shown || ownRemoval) {
      const m = c.moderation;
      return {
        ...base,
        author: { name: a?.name ?? "Conta excluída", href: a?.creatorSlug ? `/criador/${a.creatorSlug}` : null, creator: c.authorId.equals(p.userId) },
        body: c.body,
        state: c.status,
        ...(ownRemoval && m
          ? {
              moderation: {
                rule: ruleById(m.rule)?.title ?? m.rule,
                reasoning: reasoningOf.get(m.decisionId.toHexString()) ?? null,
                decisionId: m.decisionId.toHexString(),
                appealId: m.appeal?.decisionId.toHexString() ?? null,
                appeal: m.appeal ? "mantido" : m.appealing ? "analisando" : null,
              },
            }
          : {}),
      };
    }
    return { ...base, author: null, body: "", likes: 0, liked: false, state: banned ? "indisponivel" : c.status };
  };

  const kidsOf = new Map<string, CommentDoc[]>();
  for (const r of replies) {
    const k = r.parentId!.toHexString();
    kidsOf.set(k, [...(kidsOf.get(k) ?? []), r]);
  }
  const list = top.flatMap((c) => {
    const kids = (kidsOf.get(c._id.toHexString()) ?? []).slice(0, REPLIES_MAX).flatMap((r) => view(r, []) ?? []);
    return view(c, kids) ?? [];
  });

  const wait = viewer ? uploadWaitFor(viewer) : null;
  return {
    game: { likes: gameLikes, liked: gameLiked > 0, comments: count },
    comments: list,
    next: more ? top[top.length - 1]._id.toHexString() : null,
    viewer: {
      signedIn: Boolean(viewer),
      owner: Boolean(viewer && p.userId.equals(viewer._id)),
      noLinks: wait ? "Contas novas ainda não podem pôr links nos comentários (é a nossa defesa contra spam). Escreva sem o endereço." : null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Escrever                                                            */
/* ------------------------------------------------------------------ */

export async function postComment(user: Pick<UserDoc, "_id" | "createdAt">, slug: unknown, rawBody: unknown, rawParent: unknown): Promise<Result> {
  const clean = cleanComment(rawBody);
  if (!clean.ok) return fail(clean.error);
  const body = clean.body;
  if (hasLink(body) && uploadWaitFor(user)) {
    return fail("Contas novas ainda não podem pôr links nos comentários (é a nossa defesa contra spam). Escreva sem o endereço.");
  }
  const p = await publishedBySlug(slug);
  if (!p) return fail("Este jogo não está mais no programa.");
  const { comments } = await db();

  let parentId: ObjectId | null = null;
  if (rawParent) {
    const pid = typeof rawParent === "string" ? toObjectId(rawParent) : null;
    const parent = pid ? await comments.findOne({ _id: pid, projectId: p._id }, { projection: { parentId: 1, status: 1 } }) : null;
    if (!parent || parent.status !== "visivel") return fail("Esse comentário não está mais disponível para resposta.");
    // Um nível só: responder uma resposta entra no mesmo fio.
    parentId = parent.parentId ?? parent._id;
  }

  const dup = await comments.findOne(
    { authorId: user._id, projectId: p._id, body, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } },
    { projection: { _id: 1 } },
  );
  if (dup) return fail("Você acabou de enviar esse mesmo comentário.");

  await comments.insertOne({ _id: new ObjectId(), projectId: p._id, authorId: user._id, parentId, body, createdAt: new Date(), likes: 0, status: "visivel" });
  return { ok: true };
}

export async function editComment(user: Pick<UserDoc, "_id" | "createdAt">, rawId: unknown, rawBody: unknown): Promise<Result> {
  const clean = cleanComment(rawBody);
  if (!clean.ok) return fail(clean.error);
  if (hasLink(clean.body) && uploadWaitFor(user)) {
    return fail("Contas novas ainda não podem pôr links nos comentários (é a nossa defesa contra spam). Escreva sem o endereço.");
  }
  const id = typeof rawId === "string" ? toObjectId(rawId) : null;
  if (!id) return fail("Comentário não encontrado.");
  const res = await (await db()).comments.updateOne(
    { _id: id, authorId: user._id, status: "visivel" },
    { $set: { body: clean.body, editedAt: new Date() } },
  );
  return res.matchedCount ? { ok: true } : fail("Esse comentário não existe, não é seu ou não pode mais ser editado.");
}

/** Quem escreveu apaga; quem criou o jogo oculta. Com respostas, o lugar fica no fio. */
export async function removeComment(userId: ObjectId, rawId: unknown): Promise<Result> {
  const id = typeof rawId === "string" ? toObjectId(rawId) : null;
  if (!id) return fail("Comentário não encontrado.");
  const { comments, projects, likes } = await db();
  const c = await comments.findOne({ _id: id });
  if (!c || c.status === "apagado" || c.status === "oculto") return fail("Comentário não encontrado.");
  const author = c.authorId.equals(userId);
  const owner = !author && (await projects.countDocuments({ _id: c.projectId, userId }, { limit: 1 })) > 0;
  if (!author && !owner) return fail("Comentário não encontrado.");

  if (owner) {
    if (c.status !== "visivel") return fail("Esse comentário já não aparece.");
    await comments.updateOne({ _id: id }, { $set: { status: "oculto" } });
    return { ok: true };
  }
  const replies = c.parentId ? 0 : await comments.countDocuments({ parentId: id }, { limit: 1 });
  if (replies) {
    await comments.updateOne({ _id: id }, { $set: { status: "apagado", body: "" } });
  } else {
    await comments.deleteOne({ _id: id });
    await likes.deleteMany({ target: commentTarget(id) });
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Curtir                                                              */
/* ------------------------------------------------------------------ */

/** Curte (on) ou descurte um jogo publicado (por slug) ou um comentário visível (por id). Idempotente. */
export async function setLike(userId: ObjectId, kind: unknown, rawId: unknown, on: boolean): Promise<Result> {
  const { likes, comments } = await db();
  let target: string;
  let commentId: ObjectId | null = null;
  if (kind === "jogo") {
    const p = await publishedBySlug(rawId);
    if (!p) return fail("Este jogo não está mais no programa.");
    target = gameTarget(p._id);
  } else if (kind === "comentario") {
    commentId = typeof rawId === "string" ? toObjectId(rawId) : null;
    const c = commentId ? await comments.findOne({ _id: commentId, status: "visivel" }, { projection: { _id: 1 } }) : null;
    if (!c) return fail("Esse comentário não está mais disponível.");
    target = commentTarget(c._id);
  } else {
    return fail("Pedido inválido.");
  }

  let changed = false;
  if (on) {
    try {
      await likes.insertOne({ userId, target, createdAt: new Date() });
      changed = true;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  } else {
    changed = (await likes.deleteOne({ userId, target })).deletedCount === 1;
  }
  if (changed && commentId) await comments.updateOne({ _id: commentId }, { $inc: { likes: on ? 1 : -1 } });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Exclusão (jogo, conta)                                              */
/* ------------------------------------------------------------------ */

/** Comentários e curtidas de um jogo excluído. */
export async function deleteSocialOfProject(projectId: ObjectId) {
  const { comments, likes } = await db();
  const ids = await comments.distinct("_id", { projectId });
  for (let i = 0; i < ids.length; i += 1000) {
    await likes.deleteMany({ target: { $in: ids.slice(i, i + 1000).map((x) => commentTarget(x)) } });
  }
  await comments.deleteMany({ projectId });
  await likes.deleteMany({ target: gameTarget(projectId) });
}

/** Curtidas e comentários de uma conta excluída. Comentário com respostas vira "apagado" (o fio dos outros fica). */
export async function deleteSocialOfUser(userId: ObjectId) {
  const { comments, likes } = await db();
  const own = await likes.find({ userId, target: /^comentario:/ }, { projection: { target: 1 } }).toArray();
  const liked = own.map((l) => toObjectId(l.target.slice("comentario:".length))).filter((x): x is ObjectId => x !== null);
  if (liked.length) await comments.updateMany({ _id: { $in: liked } }, { $inc: { likes: -1 } });
  await likes.deleteMany({ userId });

  const tops = await comments.distinct("_id", { authorId: userId, parentId: null });
  const withReplies = (await comments.distinct("parentId", { parentId: { $in: tops } })).filter((x): x is ObjectId => x !== null);
  if (withReplies.length) await comments.updateMany({ _id: { $in: withReplies } }, { $set: { status: "apagado", body: "" } });
  const gone = await comments.distinct("_id", { authorId: userId, _id: { $nin: withReplies } });
  for (let i = 0; i < gone.length; i += 1000) {
    const chunk = gone.slice(i, i + 1000);
    await likes.deleteMany({ target: { $in: chunk.map((x) => commentTarget(x)) } });
    await comments.deleteMany({ _id: { $in: chunk } });
  }
}

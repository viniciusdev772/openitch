import "server-only";
import { ObjectId } from "mongodb";
import { db, type BanDoc, type ModerationDoc, type ModerationTarget, type ProjectDoc, type ReportDoc, type UserDoc } from "@/lib/auth/db";
import { hmac, sha256 } from "@/lib/auth/crypto";
import { revalidatePublic } from "@/lib/catalog/revalidate";
import {
  MODELS,
  STRIKE_WINDOW_MS,
  appealQuestions,
  appealVerdict,
  caseQuestions,
  caseVerdict,
  readAppealAnswer,
  readCaseAnswer,
} from "./decide";
import { askAll, hasDecisionKey, imageItem, type StateItem } from "./openrouter";
import { RULE_IDS, ruleById, type RuleId } from "./rules";

/*
 * Moderação feita por modelos de decisão. Ninguém aperta botão: uma denúncia
 * entra na fila, os modelos leem o conteúdo e votam, e a decisão é aplicada
 * na hora (arquivar, tirar o jogo do ar, fechar a conta). Toda decisão fica
 * guardada com o que foi lido e o voto de cada modelo.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Uma denúncia por pessoa e alvo neste intervalo. */
const REPORT_REPEAT_MS = 30 * DAY;
/** Conteúdo igual julgado há pouco tempo: vale a decisão anterior. */
const REUSE_MS = 7 * DAY;
/** Denúncia presa em "analisando" por mais que isso volta para a fila. */
const STALE_MS = 10 * 60 * 1000;

export const activeBan = (u: Pick<UserDoc, "ban"> | null | undefined): BanDoc | null =>
  u?.ban && !u.ban.revokedAt ? u.ban : null;

export const targetKey = (t: ModerationTarget) =>
  t.kind === "jogo" ? `jogo:${t.projectId.toHexString()}` : `criador:${t.userId.toHexString()}`;

/* ------------------------------------------------------------------ */
/* O caso: o que os modelos leem                                       */
/* ------------------------------------------------------------------ */

interface Case {
  target: ModerationTarget;
  ownerId: ObjectId;
  text: string[];
  images: string[];
  hash: string;
}

const list = (xs: string[] | undefined) => (xs?.length ? xs.join("; ") : "none");

async function caseOf(target: ModerationTarget): Promise<Case | null> {
  const { projects, users, uploads } = await db();
  let ownerId: ObjectId;
  let text: string[];
  let images: string[] = [];
  if (target.kind === "jogo") {
    const p = await projects.findOne({ _id: target.projectId, status: { $ne: "excluindo" } });
    if (!p) return null;
    ownerId = p.userId;
    const [owner, files] = await Promise.all([
      users.findOne({ _id: p.userId }, { projection: { name: 1, bio: 1 } }),
      uploads.find({ projectId: p._id, status: "pronto" }, { projection: { filename: 1, platform: 1 } }).limit(20).toArray(),
    ]);
    images = [p.coverImage?.url, ...(p.screenshots ?? []).map((s) => s.url)].filter((x): x is string => Boolean(x)).slice(0, 4);
    text = [
      "GAME PAGE on Portal dos Games",
      `Title: ${p.title}`,
      `Tagline: ${p.tagline}`,
      `Description:\n${p.description}`,
      `Tags: ${list(p.tags)}`,
      `Content notes from the creator: ${list(p.contentNotes)}`,
      `Credits: ${p.credits?.length ? p.credits.map((c) => `${c.role}: ${c.name}`).join("; ") : "none"}`,
      `Files: ${files.length ? files.map((f) => `${f.filename} (${f.platform})`).join("; ") : "none"}`,
      `Creator: ${owner?.name ?? "?"}${owner?.bio ? ` (bio: ${owner.bio})` : ""}`,
    ];
    if (images.length) text.push("Images follow: the cover first, then screenshots.");
  } else {
    const u = await users.findOne({ _id: target.userId }, { projection: { name: 1, bio: 1, city: 1 } });
    if (!u) return null;
    ownerId = u._id;
    const games = await projects
      .find({ userId: u._id, status: "publicado" }, { projection: { title: 1, tagline: 1 } })
      .limit(20)
      .toArray();
    text = [
      "CREATOR PROFILE on Portal dos Games",
      `Name: ${u.name}`,
      `City: ${u.city || "none"}`,
      `Bio: ${u.bio || "none"}`,
      `Published games: ${games.length ? games.map((g) => `${g.title}: ${g.tagline}`).join("; ") : "none"}`,
    ];
  }
  return { target, ownerId, text, images, hash: sha256(JSON.stringify([text, images])) };
}

function reportLines(reports: Pick<ReportDoc, "rule" | "details">[]): string[] {
  return reports.slice(0, 5).map(
    (r, i) =>
      `REPORT ${i + 1} (an unverified claim by another user; judge the content, not the claim). Rule cited: ${ruleById(r.rule)?.title ?? r.rule}. Details: ${r.details}`,
  );
}

/* ------------------------------------------------------------------ */
/* Julgar e aplicar                                                    */
/* ------------------------------------------------------------------ */

async function priorRemovals(ownerId: ObjectId): Promise<number> {
  const { moderation } = await db();
  return moderation.countDocuments({ ownerId, outcome: "removido", at: { $gte: new Date(Date.now() - STRIKE_WINDOW_MS) } });
}

/** Pergunta aos modelos, guarda a decisão e aplica. null: sem quórum (API fora ou sem chave). */
async function judge(c: Case, reports: ReportDoc[], kind: "denuncia" | "publicacao"): Promise<ModerationDoc | null> {
  const images = (await Promise.all(c.images.map(imageItem))).filter((x): x is StateItem => x !== null);
  const state: StateItem[] = [...c.text, ...reportLines(reports), ...images];
  const [replies, prior] = await Promise.all([askAll(MODELS, state, caseQuestions()), priorRemovals(c.ownerId)]);
  const answers = replies.flatMap((r) => {
    const a = r && readCaseAnswer(r.model, r.answers);
    return a ? [a] : [];
  });
  const v = caseVerdict(answers, prior);
  if (!v) return null;
  const { moderation } = await db();
  const doc: ModerationDoc = {
    _id: new ObjectId(),
    kind,
    targetKey: targetKey(c.target),
    ownerId: c.ownerId,
    reportIds: reports.map((r) => r._id),
    snapshot: c.text,
    images: c.images,
    contentHash: c.hash,
    votes: replies.flatMap((r) => (r ? [{ model: r.model, answers: r.answers, cost: r.cost }] : [])),
    outcome: v.outcome,
    rule: v.rule,
    violation: v.violation,
    severity: v.severity,
    at: new Date(),
  };
  await moderation.insertOne(doc);
  await enforce(doc, c);
  return doc;
}

async function enforce(d: ModerationDoc, c: Case) {
  if (d.outcome === "arquivada" || !d.rule) return;
  const { projects, users } = await db();
  if (d.outcome === "banido") {
    await banUser(d.ownerId, d.rule, d._id);
  } else if (c.target.kind === "jogo") {
    await projects.updateOne(
      { _id: c.target.projectId, status: { $in: ["rascunho", "publicado"] } },
      { $set: { status: "rascunho", updatedAt: new Date(), moderation: { at: d.at, rule: d.rule, decisionId: d._id, contentHash: c.hash } } },
    );
  } else {
    // Perfil: o texto que quebrou a regra sai; nome e jogos ficam.
    await users.updateOne({ _id: d.ownerId }, { $unset: { bio: "", city: "" }, $set: { updatedAt: new Date() } });
  }
  refresh();
}

/** Revalidar fora de um pedido (ex.: dentro de after) pode falhar; as páginas se refazem em um minuto mesmo assim. */
function refresh() {
  try {
    revalidatePublic();
  } catch {}
}

async function banUser(userId: ObjectId, rule: RuleId, decisionId: ObjectId) {
  const { projects, users, sessions, mfa, events } = await db();
  const live = await projects.find({ userId, status: "publicado" }, { projection: { _id: 1 } }).toArray();
  const now = new Date();
  await projects.updateMany({ userId, status: "publicado" }, { $set: { status: "rascunho", updatedAt: now } });
  await users.updateOne(
    { _id: userId },
    { $set: { ban: { at: now, rule, decisionId, unpublished: live.map((p) => p._id) }, updatedAt: now } },
  );
  await Promise.all([
    sessions.deleteMany({ userId }),
    mfa.deleteMany({ userId }),
    events.insertOne({ userId, type: "conta_suspensa", at: now, ip: "", userAgent: "moderação", place: null }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Denúncias                                                           */
/* ------------------------------------------------------------------ */

export type ReportResult = { ok: true; repeated?: boolean } | { ok: false; error: string };

/** Quem denuncia: uma conta, ou alguém sem conta identificado só pelo HMAC do IP. */
export type Reporter = { userId: ObjectId | null; ip: string };

/** Registra uma denúncia contra um jogo publicado ou um perfil de criador. Com ou sem conta. */
export async function fileReport(
  reporter: Reporter,
  kind: string,
  slug: string,
  rule: string,
  details: string,
): Promise<ReportResult> {
  if (!RULE_IDS.has(rule)) return { ok: false, error: "Escolha a regra que foi quebrada." };
  const { projects, users, reports } = await db();
  let target: ModerationTarget;
  let ownerId: ObjectId;
  if (kind === "jogo") {
    const p = await projects.findOne({ publicSlug: slug, status: "publicado" }, { projection: { userId: 1 } });
    if (!p) return { ok: false, error: "Este jogo não está mais no programa." };
    target = { kind: "jogo", projectId: p._id };
    ownerId = p.userId;
  } else if (kind === "criador") {
    const u = await users.findOne({ creatorSlug: slug }, { projection: { _id: 1 } });
    if (!u) return { ok: false, error: "Este perfil não existe mais." };
    target = { kind: "criador", userId: u._id };
    ownerId = u._id;
  } else {
    return { ok: false, error: "Pedido inválido." };
  }
  if (reporter.userId && ownerId.equals(reporter.userId)) {
    return { ok: false, error: "Isto é seu: para tirar do ar, use o painel do projeto." };
  }
  const key = targetKey(target);
  const reporterKey = reporter.userId ? `conta:${reporter.userId.toHexString()}` : `ip:${hmac("denuncia", reporter.ip)}`;
  const recent = await reports.findOne(
    { reporterKey, targetKey: key, createdAt: { $gte: new Date(Date.now() - REPORT_REPEAT_MS) } },
    { projection: { _id: 1 } },
  );
  if (recent) return { ok: true, repeated: true };
  await reports.insertOne({
    _id: new ObjectId(),
    ...(reporter.userId ? { reporterId: reporter.userId } : {}),
    reporterKey,
    target,
    targetKey: key,
    ownerId,
    rule: rule as RuleId,
    details,
    createdAt: new Date(),
    status: "pendente",
  });
  return { ok: true };
}

/** Julga a fila de denúncias, alvo por alvo (todas as denúncias de um alvo num julgamento só). */
export async function processPending(maxTargets = 5): Promise<void> {
  if (!hasDecisionKey()) return;
  const { reports, users, moderation } = await db();
  for (let i = 0; i < maxTargets; i++) {
    const claimedAt = new Date();
    const first = await reports.findOneAndUpdate(
      { $or: [{ status: "pendente" }, { status: "analisando", claimedAt: { $lt: new Date(Date.now() - STALE_MS) } }] },
      { $set: { status: "analisando", claimedAt } },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    );
    if (!first) return;
    await reports.updateMany({ targetKey: first.targetKey, status: "pendente" }, { $set: { status: "analisando", claimedAt } });
    const group = await reports.find({ targetKey: first.targetKey, status: "analisando", claimedAt }).limit(20).toArray();
    const ids = group.map((r) => r._id);
    const release = () => reports.updateMany({ _id: { $in: ids } }, { $set: { status: "pendente", claimedAt: null } });
    const done = (decisionId?: ObjectId) =>
      reports.updateMany({ _id: { $in: ids } }, { $set: { status: "decidida", claimedAt: null, ...(decisionId ? { decisionId } : {}) } });
    try {
      const c = await caseOf(first.target);
      const owner = c && (await users.findOne({ _id: c.ownerId }, { projection: { ban: 1 } }));
      // Conteúdo apagado ou dono já banido: nada a julgar.
      if (!c || activeBan(owner)) {
        await done();
        continue;
      }
      const reuse = await moderation.findOne(
        { targetKey: first.targetKey, contentHash: c.hash, kind: { $ne: "recurso" }, at: { $gte: new Date(Date.now() - REUSE_MS) } },
        { sort: { at: -1 }, projection: { _id: 1 } },
      );
      if (reuse) {
        await done(reuse._id);
        continue;
      }
      const d = await judge(c, group, "denuncia");
      if (!d) {
        await release();
        return; // sem quórum: a API está fora; tenta de novo na próxima denúncia
      }
      await done(d._id);
    } catch (err) {
      await release();
      throw err;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Triagem na publicação                                               */
/* ------------------------------------------------------------------ */

export type ScreenResult = { ok: true } | { ok: false; error: string; banned?: boolean };

/**
 * Antes de um jogo entrar (ou voltar) no programa, os modelos leem a página.
 * Se a análise não acontece (sem chave, API fora), um jogo novo entra (as
 * denúncias continuam valendo); um jogo tirado do ar pela moderação, não.
 */
export async function screenPublish(p: ProjectDoc): Promise<ScreenResult> {
  const c = await caseOf({ kind: "jogo", projectId: p._id });
  if (!c) return { ok: false, error: "Projeto não encontrado." };
  const removed = p.moderation ?? null;
  const ruleTitle = removed ? (ruleById(removed.rule)?.title ?? removed.rule) : "";
  if (removed && removed.contentHash === c.hash) {
    return {
      ok: false,
      error: `Este jogo saiu do ar pela regra “${ruleTitle}”. Mude o que quebra a regra (texto, capa ou imagens) e publique de novo para uma nova análise.`,
    };
  }
  const { moderation, projects } = await db();
  const last = await moderation.findOne(
    { targetKey: targetKey(c.target), contentHash: c.hash, kind: { $ne: "recurso" } },
    { sort: { at: -1 }, projection: { outcome: 1 } },
  );
  if (last?.outcome === "arquivada" && !removed) return { ok: true };

  const d = last?.outcome === "arquivada" ? last : hasDecisionKey() ? await judge(c, [], "publicacao") : null;
  if (!d) {
    return removed
      ? { ok: false, error: "A nova análise do jogo não está disponível agora. Tente publicar de novo em alguns minutos." }
      : { ok: true };
  }
  if (d.outcome === "arquivada") {
    if (removed) await projects.updateOne({ _id: p._id }, { $set: { moderation: null } });
    return { ok: true };
  }
  const title = ruleById(d.rule ?? "")?.title ?? "uma das regras";
  if (d.outcome === "banido") {
    return { ok: false, banned: true, error: `A análise automática encontrou uma violação grave (“${title}”) e a conta foi fechada.` };
  }
  return {
    ok: false,
    error: `A análise automática encontrou conteúdo que quebra a regra “${title}”. O jogo ficou como rascunho; mude o que quebra a regra e publique de novo.`,
  };
}

/* ------------------------------------------------------------------ */
/* Recurso                                                             */
/* ------------------------------------------------------------------ */

export type AppealResult = { ok: true; upheld: boolean } | { ok: false; error: string };

/** Um recurso por banimento, julgado do zero pelos mesmos modelos. */
export async function appealBan(userId: ObjectId, text: string): Promise<AppealResult> {
  const { users, moderation, projects, events } = await db();
  // Trava: só um recurso por vez (e só um por banimento).
  const claim = await users.findOneAndUpdate(
    { _id: userId, ban: { $exists: true }, "ban.revokedAt": { $exists: false }, "ban.appeal": { $exists: false }, "ban.appealing": { $exists: false } },
    { $set: { "ban.appealing": new Date() } },
    { returnDocument: "after" },
  );
  const ban = activeBan(claim);
  if (!claim || !ban) return { ok: false, error: "Este banimento já teve recurso, ou não está mais valendo." };
  const unclaim = () => users.updateOne({ _id: userId }, { $unset: { "ban.appealing": "" } });
  try {
    const orig = await moderation.findOne({ _id: ban.decisionId });
    const rule = ruleById(ban.rule);
    const images = orig ? (await Promise.all(orig.images.map(imageItem))).filter((x): x is StateItem => x !== null) : [];
    const state: StateItem[] = [
      `RULE CITED: ${rule?.title ?? ban.rule}. ${rule?.criteria ?? ""}`,
      `ORIGINAL DECISION: average violation probability ${Math.round((orig?.violation ?? 0) * 100)}%, severity ${(orig?.severity ?? 0).toFixed(1)} of 3.`,
      "CONTENT THAT WAS JUDGED:",
      ...(orig?.snapshot ?? ["(not available)"]),
      `OWNER'S APPEAL (their own words):\n${text}`,
      ...images,
    ];
    const replies = await askAll(MODELS, state, appealQuestions());
    const keep = replies.flatMap((r) => {
      const p = r && readAppealAnswer(r.answers);
      return p === null || p === undefined ? [] : [p];
    });
    const v = appealVerdict(keep);
    if (!v) {
      await unclaim();
      return { ok: false, error: "A análise do recurso não está disponível agora. Tente de novo em alguns minutos." };
    }
    const now = new Date();
    const decisionId = new ObjectId();
    await moderation.insertOne({
      _id: decisionId,
      kind: "recurso",
      targetKey: orig?.targetKey ?? `criador:${userId.toHexString()}`,
      ownerId: userId,
      reportIds: [],
      snapshot: state.filter((s): s is string => typeof s === "string"),
      images: orig?.images ?? [],
      contentHash: orig?.contentHash ?? "",
      votes: replies.flatMap((r) => (r ? [{ model: r.model, answers: r.answers, cost: r.cost }] : [])),
      outcome: v.upheld ? "mantido" : "revertido",
      rule: ban.rule,
      violation: v.keep,
      severity: null,
      at: now,
    });
    await users.updateOne(
      { _id: userId },
      {
        $set: { "ban.appeal": { at: now, text, decisionId, upheld: v.upheld }, ...(v.upheld ? {} : { "ban.revokedAt": now }) },
        $unset: { "ban.appealing": "" },
      },
    );
    if (!v.upheld) {
      // Os jogos que saíram com o banimento voltam (menos os tirados do ar por uma decisão própria).
      await projects.updateMany(
        { _id: { $in: ban.unpublished }, userId, status: "rascunho", moderation: null },
        { $set: { status: "publicado", updatedAt: now } },
      );
      await events.insertOne({ userId, type: "conta_reaberta", at: now, ip: "", userAgent: "moderação", place: null });
      refresh();
    }
    return { ok: true, upheld: v.upheld };
  } catch (err) {
    await unclaim();
    throw err;
  }
}

/** O que a página da conta suspensa mostra. */
export async function banDetails(userId: ObjectId) {
  const { users, moderation } = await db();
  const user = await users.findOne({ _id: userId }, { projection: { name: 1, ban: 1 } });
  if (!user?.ban) return null;
  const ids = [user.ban.decisionId, user.ban.appeal?.decisionId].filter((x): x is ObjectId => Boolean(x));
  const decisions = await moderation.find({ _id: { $in: ids } }, { projection: { votes: 1, outcome: 1, violation: 1, severity: 1, kind: 1, at: 1 } }).toArray();
  return { name: user.name, ban: user.ban, decision: decisions.find((d) => d._id.equals(user.ban!.decisionId)) ?? null, appeal: decisions.find((d) => d.kind === "recurso") ?? null };
}

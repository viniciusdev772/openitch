"use server";

import { ObjectId } from "mongodb";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type UserDoc } from "./db";
import {
  decryptSecret,
  dummyPasswordHash,
  encryptSecret,
  hashPassword,
  hashRecoveryCode,
  newRecoveryCode,
  normalizeRecoveryCode,
  verifyPassword,
} from "./crypto";
import { newTotpSecret, verifyTotp } from "./totp";
import { clear, hit, peek, waitText } from "./ratelimit";
import { requestInfo } from "./request";
import { deleteUploadsOfUser } from "@/lib/uploads/server";
import { deleteBuildsOfUser } from "@/lib/builds/cleanup";
import {
  clearMfaChallenge,
  createMfaChallenge,
  createSession,
  destroyCurrentSession,
  destroyOtherSessions,
  getSession,
  logEvent,
  readMfaChallenge,
} from "./session";
import {
  emailError,
  nameError,
  normalizeEmail,
  normalizeName,
  passwordError,
  passwordWasLeaked,
  safeNext,
  str,
} from "./validate";

/*
 * Toda Server Action exportada daqui é um endpoint público: cada uma confere
 * sozinha quem está chamando. O Next já recusa POSTs de outra origem (CSRF) e
 * o cookie de sessão é SameSite=Lax + HttpOnly + __Host-.
 */

export type FormState =
  | {
      error?: string;
      fields?: Record<string, string>;
      values?: Record<string, string>;
      ok?: string;
      codes?: string[];
    }
  | undefined;

const MIN = 60 * 1000;
const SERVER_DOWN = "Não conseguimos falar com o servidor agora. Tente de novo em instantes.";
const MAX_PASSWORD_INPUT = 512;
const LEAKED = "Essa senha já apareceu em vazamentos de outros sites. Escolha uma que você não usa em outro lugar.";

async function guard(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    console.error("[auth]", err);
    return { error: SERVER_DOWN };
  }
}

async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/entrar?de=/conta");
  return s;
}

function makeRecoveryCodes(userId: ObjectId) {
  const codes = Array.from({ length: 10 }, newRecoveryCode);
  const hashed = codes.map((c) => ({
    hash: hashRecoveryCode(userId.toHexString(), normalizeRecoveryCode(c) as string),
    usedAt: null,
  }));
  return { codes, hashed };
}

/**
 * Confere um código de segundo fator: 6 dígitos do app, ou um código de
 * recuperação. Os dois são de uso único, marcados de forma atômica no banco.
 */
async function consumeSecondFactor(user: UserDoc, rawCode: string): Promise<"totp" | "recovery" | null> {
  const { users } = await db();
  const code = rawCode.replace(/\s/g, "");
  if (/^\d{6}$/.test(code)) {
    if (!user.totp.enabled || !user.totp.secret) return null;
    const secret = decryptSecret(user.totp.secret, user._id.toHexString());
    if (!secret) return null;
    const step = verifyTotp(secret, code, user.totp.lastStep);
    if (step === null) return null;
    const claim = await users.updateOne(
      { _id: user._id, "totp.lastStep": { $lt: step } },
      { $set: { "totp.lastStep": step } },
    );
    return claim.modifiedCount === 1 ? "totp" : null;
  }
  const norm = normalizeRecoveryCode(code);
  if (!norm) return null;
  return (await claimRecoveryCode(user._id, norm)) ? "recovery" : null;
}

/** Marca um código de recuperação como usado; só um pedido consegue. */
async function claimRecoveryCode(userId: ObjectId, normalized: string): Promise<boolean> {
  const { users } = await db();
  const hash = hashRecoveryCode(userId.toHexString(), normalized);
  const claim = await users.updateOne(
    { _id: userId, recoveryCodes: { $elemMatch: { hash, usedAt: null } } },
    { $set: { "recoveryCodes.$.usedAt": new Date() } },
  );
  return claim.modifiedCount === 1;
}

/** Senha atual para ações sensíveis, com limite próprio de tentativas. */
async function checkCurrentPassword(user: UserDoc, password: string): Promise<string | null> {
  const key = `reauth:${user._id.toHexString()}`;
  const limit = await peek(key, 5);
  if (!limit.allowed) return `Muitas tentativas com a senha errada. Espere ${waitText(limit.retryAfterMs)}.`;
  const { ok } =
    password && password.length <= MAX_PASSWORD_INPUT
      ? await verifyPassword(password, user.passwordHash)
      : { ok: false };
  if (!ok) {
    await hit(key, 5, 15 * MIN);
    return "Senha atual incorreta.";
  }
  await clear(key);
  return null;
}

/* ------------------------------------------------------------------ */
/* Entrar                                                              */
/* ------------------------------------------------------------------ */

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = normalizeEmail(str(form, "email", 320));
  const password = str(form, "senha", MAX_PASSWORD_INPUT + 1);
  const persistent = form.get("lembrar") === "on";
  const next = safeNext(str(form, "de", 600));
  const values = { email };

  const fields: Record<string, string> = {};
  const eErr = emailError(email);
  if (eErr) fields.email = eErr;
  if (!password) fields.senha = "Escreva sua senha.";
  if (Object.keys(fields).length) return { fields, values };

  let goTo: string | null = null;
  const result = await guard(async (): Promise<FormState> => {
    const info = await requestInfo();
    const byIp = await hit(`entrar:ip:${info.ip}`, 30, 15 * MIN);
    if (!byIp.allowed) {
      return { error: `Muitas tentativas a partir desta rede. Espere ${waitText(byIp.retryAfterMs)}.`, values };
    }
    // Erros contados por e-mail e rede: um estranho em outra rede não
    // consegue trancar o dono da conta. O teto por e-mail (todas as redes)
    // segura ataques espalhados por muitos IPs.
    const failKey = `entrar:falhas:${email}:${info.ip}`;
    const failAllKey = `entrar:falhas:${email}`;
    const [byAccount, byAccountAll] = await Promise.all([peek(failKey, 5), peek(failAllKey, 50)]);
    if (!byAccount.allowed || !byAccountAll.allowed) {
      const wait = Math.max(
        byAccount.allowed ? 0 : byAccount.retryAfterMs,
        byAccountAll.allowed ? 0 : byAccountAll.retryAfterMs,
      );
      return {
        error: `Muitas senhas erradas para este e-mail. Espere ${waitText(wait)} ou recupere o acesso.`,
        values,
      };
    }

    const { users } = await db();
    const user = await users.findOne({ email });
    // Mesmo trabalho com ou sem conta: o tempo de resposta não entrega quem existe.
    const verdict =
      password.length <= MAX_PASSWORD_INPUT
        ? await verifyPassword(password, user?.passwordHash ?? (await dummyPasswordHash()))
        : { ok: false, needsRehash: false };

    if (!user || !verdict.ok) {
      await Promise.all([hit(failKey, 5, 15 * MIN), hit(failAllKey, 50, 60 * MIN)]);
      if (user) await logEvent(user._id, "senha_errada", info);
      return { error: "E-mail ou senha incorretos.", values };
    }

    await clear(failKey);
    if (verdict.needsRehash) {
      await users.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password) } });
    }

    if (user.totp.enabled) {
      await createMfaChallenge(user._id, persistent);
      goTo = `/entrar/verificar?de=${encodeURIComponent(next)}`;
      return undefined;
    }

    await createSession(user._id, { persistent, mfa: false });
    await logEvent(user._id, "entrada", info);
    goTo = next;
    return undefined;
  });
  if (goTo) redirect(goTo);
  return result;
}

export async function verifySecondFactor(_prev: FormState, form: FormData): Promise<FormState> {
  const code = str(form, "codigo", 64).trim();
  const next = safeNext(str(form, "de", 600));
  if (!code) return { fields: { codigo: "Escreva o código de 6 dígitos do app." } };

  let goTo: string | null = null;
  const result = await guard(async (): Promise<FormState> => {
    const challenge = await readMfaChallenge();
    if (!challenge) {
      goTo = "/entrar?motivo=expirou";
      return undefined;
    }
    const { mfa, users } = await db();
    const counted = await mfa.findOneAndUpdate(
      { _id: challenge._id, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    const user = await users.findOne({ _id: challenge.userId });
    if (!counted || !user || !user.totp.enabled) {
      await clearMfaChallenge(challenge._id);
      goTo = "/entrar?motivo=tentativas";
      return undefined;
    }
    const perUser = await hit(`2fa:${user._id.toHexString()}`, 10, 15 * MIN);
    const info = await requestInfo();
    const used = perUser.allowed ? await consumeSecondFactor(user, code) : null;
    if (!used) {
      await logEvent(user._id, "2fa_errado", info);
      const left = 5 - counted.attempts;
      if (left <= 0 || !perUser.allowed) {
        await clearMfaChallenge(challenge._id);
        goTo = "/entrar?motivo=tentativas";
        return undefined;
      }
      return {
        fields: {
          codigo: `Código incorreto ou já usado. ${left === 1 ? "Resta 1 tentativa" : `Restam ${left} tentativas`}.`,
        },
      };
    }
    await clearMfaChallenge(challenge._id);
    await createSession(user._id, { persistent: challenge.persistent, mfa: true });
    await logEvent(user._id, "entrada_2fa", info);
    if (used === "recovery") await logEvent(user._id, "codigo_recuperacao_usado", info);
    goTo = next;
    return undefined;
  });
  if (goTo) redirect(goTo);
  return result;
}

/* ------------------------------------------------------------------ */
/* Criar conta                                                         */
/* ------------------------------------------------------------------ */

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const name = normalizeName(str(form, "nome", 200));
  const email = normalizeEmail(str(form, "email", 320));
  const password = str(form, "senha", MAX_PASSWORD_INPUT + 1);
  const persistent = form.get("lembrar") === "on";
  const values = { nome: name, email };

  const fields: Record<string, string> = {};
  const nErr = nameError(name);
  if (nErr) fields.nome = nErr;
  const eErr = emailError(email);
  if (eErr) fields.email = eErr;
  const pErr = passwordError(password, [email, name]);
  if (pErr) fields.senha = pErr;
  if (Object.keys(fields).length) return { fields, values };

  return guard(async (): Promise<FormState> => {
    const info = await requestInfo();
    const byIp = await hit(`cadastro:ip:${info.ip}`, 5, 60 * MIN);
    if (!byIp.allowed) {
      return { error: `Muitas contas criadas a partir desta rede. Espere ${waitText(byIp.retryAfterMs)}.`, values };
    }
    if (await passwordWasLeaked(password)) {
      return {
        fields: { senha: LEAKED },
        values,
      };
    }
    const { users } = await db();
    const taken = { fields: { email: "Já existe uma conta com esse e-mail. Entre ou recupere o acesso." }, values };
    if (await users.findOne({ email }, { projection: { _id: 1 } })) return taken;

    const _id = new ObjectId();
    const { codes, hashed } = makeRecoveryCodes(_id);
    const now = new Date();
    try {
      await users.insertOne({
        _id,
        email,
        name,
        passwordHash: await hashPassword(password),
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
        recoveryCodes: hashed,
        totp: { enabled: false, secret: null, lastStep: 0, enabledAt: null },
        totpPending: null,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return taken;
      throw err;
    }
    await createSession(_id, { persistent, mfa: false });
    await logEvent(_id, "conta_criada", info);
    return { codes };
  });
}

/* ------------------------------------------------------------------ */
/* Recuperar acesso (sem e-mail: código de recuperação)                 */
/* ------------------------------------------------------------------ */

export async function recoverAccess(_prev: FormState, form: FormData): Promise<FormState> {
  const email = normalizeEmail(str(form, "email", 320));
  const code = str(form, "codigo", 64);
  const password = str(form, "senha", MAX_PASSWORD_INPUT + 1);
  const values = { email };

  const fields: Record<string, string> = {};
  const eErr = emailError(email);
  if (eErr) fields.email = eErr;
  const norm = normalizeRecoveryCode(code);
  if (!norm) fields.codigo = "O código tem 10 letras e números, como k7m2q-x9c4d.";
  const pErr = passwordError(password, [email]);
  if (pErr) fields.senha = pErr;
  if (Object.keys(fields).length) return { fields, values };

  let goTo: string | null = null;
  const result = await guard(async (): Promise<FormState> => {
    const info = await requestInfo();
    const byIp = await hit(`recuperar:ip:${info.ip}`, 10, 15 * MIN);
    // Só os erros contam, por e-mail e rede, com um teto geral por e-mail.
    const failKey = `recuperar:falhas:${email}:${info.ip}`;
    const failAllKey = `recuperar:falhas:${email}`;
    const [byEmail, byEmailAll] = await Promise.all([peek(failKey, 5), peek(failAllKey, 30)]);
    if (!byIp.allowed || !byEmail.allowed || !byEmailAll.allowed) {
      const wait = Math.max(
        byIp.allowed ? 0 : byIp.retryAfterMs,
        byEmail.allowed ? 0 : byEmail.retryAfterMs,
        byEmailAll.allowed ? 0 : byEmailAll.retryAfterMs,
      );
      return { error: `Muitas tentativas de recuperação. Espere ${waitText(wait)}.`, values };
    }
    const failed = async () => {
      await Promise.all([hit(failKey, 5, 60 * MIN), hit(failAllKey, 30, 60 * MIN)]);
      return { error: "E-mail ou código de recuperação incorretos.", values };
    };
    if (await passwordWasLeaked(password)) {
      return {
        fields: { senha: LEAKED },
        values,
      };
    }
    const { users } = await db();
    const user = await users.findOne({ email });
    if (!user || !(await claimRecoveryCode(user._id, norm as string))) return failed();

    const now = new Date();
    await users.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(password), passwordChangedAt: now, updatedAt: now } },
    );
    await destroyOtherSessions(user._id);
    await Promise.all([clear(`entrar:falhas:${email}`), clear(`entrar:falhas:${email}:${info.ip}`), clear(failKey)]);
    await logEvent(user._id, "codigo_recuperacao_usado", info);
    await logEvent(user._id, "senha_redefinida", info);
    goTo = "/entrar?motivo=redefinida";
    return undefined;
  });
  if (goTo) redirect(goTo);
  return result;
}

/* ------------------------------------------------------------------ */
/* Sair                                                                */
/* ------------------------------------------------------------------ */

export async function signOut(): Promise<void> {
  const s = await getSession().catch(() => null);
  await destroyCurrentSession().catch(() => undefined);
  if (s) await logEvent(s.user._id, "saida").catch(() => undefined);
  redirect("/");
}

/* ------------------------------------------------------------------ */
/* Conta                                                               */
/* ------------------------------------------------------------------ */

async function updateNameInner(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const name = normalizeName(str(form, "nome", 200));
  const nErr = nameError(name);
  if (nErr) return { fields: { nome: nErr }, values: { nome: name } };
  return guard(async (): Promise<FormState> => {
    const { users } = await db();
    await users.updateOne({ _id: user._id }, { $set: { name, updatedAt: new Date() } });
    await logEvent(user._id, "nome_alterado");
    revalidatePath("/conta");
    return { ok: "Nome salvo.", values: { nome: name } };
  });
}

async function changePasswordInner(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, sessionId } = await requireSession();
  const current = str(form, "senha_atual", MAX_PASSWORD_INPUT + 1);
  const password = str(form, "senha_nova", MAX_PASSWORD_INPUT + 1);
  const pErr = passwordError(password, [user.email, user.name]);
  if (!current) return { fields: { senha_atual: "Escreva sua senha atual." } };
  if (pErr) return { fields: { senha_nova: pErr } };
  if (current === password) return { fields: { senha_nova: "A senha nova precisa ser diferente da atual." } };

  return guard(async (): Promise<FormState> => {
    const err = await checkCurrentPassword(user, current);
    if (err) return { fields: { senha_atual: err } };
    if (await passwordWasLeaked(password)) {
      return { fields: { senha_nova: LEAKED } };
    }
    const { users } = await db();
    const now = new Date();
    await users.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(password), passwordChangedAt: now, updatedAt: now } },
    );
    await destroyOtherSessions(user._id, sessionId);
    await logEvent(user._id, "senha_alterada");
    revalidatePath("/conta");
    return { ok: "Senha trocada. As outras sessões foram encerradas." };
  });
}

export async function revokeSession(form: FormData): Promise<void> {
  const { user, publicId: currentPublic } = await requireSession();
  const target = str(form, "sessao", 64);
  if (!/^[A-Za-z0-9_-]{16}$/.test(target)) return;
  if (target === currentPublic) {
    await signOut();
    return;
  }
  const { sessions } = await db();
  const res = await sessions.deleteOne({ publicId: target, userId: user._id });
  if (res.deletedCount === 1) await logEvent(user._id, "sessao_encerrada");
  revalidatePath("/conta");
}

export async function revokeOtherSessions(): Promise<void> {
  const { user, sessionId } = await requireSession();
  await destroyOtherSessions(user._id, sessionId);
  await logEvent(user._id, "outras_sessoes_encerradas");
  revalidatePath("/conta");
}

/* 2FA ---------------------------------------------------------------- */

export async function startTotpSetup(): Promise<void> {
  const { user } = await requireSession();
  if (user.totp.enabled) redirect("/conta");
  const { users } = await db();
  const secret = newTotpSecret();
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        totpPending: {
          secret: encryptSecret(secret, `${user._id.toHexString()}:pendente`),
          expiresAt: new Date(Date.now() + 15 * MIN),
        },
      },
    },
  );
  revalidatePath("/conta/duas-etapas");
}

async function confirmTotpSetupInner(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, sessionId } = await requireSession();
  const code = str(form, "codigo", 32).replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { fields: { codigo: "Escreva os 6 dígitos que o app mostra agora." } };

  let goTo: string | null = null;
  const result = await guard(async (): Promise<FormState> => {
    if (user.totp.enabled) {
      goTo = "/conta";
      return undefined;
    }
    const limit = await hit(`2fa-config:${user._id.toHexString()}`, 10, 15 * MIN);
    if (!limit.allowed) return { error: `Muitas tentativas. Espere ${waitText(limit.retryAfterMs)}.` };
    const pending = user.totpPending;
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      return { error: "A chave expirou. Gere uma nova e escaneie de novo." };
    }
    const secret = decryptSecret(pending.secret, `${user._id.toHexString()}:pendente`);
    if (!secret) return { error: "A chave expirou. Gere uma nova e escaneie de novo." };
    const step = verifyTotp(secret, code, -1);
    if (step === null) {
      return { fields: { codigo: "Esse código não confere. Confira se o relógio do celular está certo e tente o código novo." } };
    }
    const { users } = await db();
    const now = new Date();
    await users.updateOne(
      { _id: user._id, "totp.enabled": false },
      {
        $set: {
          totp: { enabled: true, secret: encryptSecret(secret, user._id.toHexString()), lastStep: step, enabledAt: now },
          totpPending: null,
          updatedAt: now,
        },
      },
    );
    // Quem entrou só com a senha antes disso perde o acesso agora.
    await destroyOtherSessions(user._id, sessionId);
    const { sessions } = await db();
    await sessions.updateOne({ _id: sessionId }, { $set: { mfa: true } });
    await logEvent(user._id, "2fa_ativado");
    revalidatePath("/conta");
    goTo = "/conta?2fa=ativada";
    return undefined;
  });
  if (goTo) redirect(goTo);
  return result;
}

async function disableTotpInner(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const password = str(form, "senha", MAX_PASSWORD_INPUT + 1);
  const code = str(form, "codigo", 64);
  if (!password) return { fields: { senha: "Escreva sua senha." } };
  if (!code.trim()) return { fields: { codigo: "Escreva um código do app ou um código de recuperação." } };
  if (!user.totp.enabled) return { ok: "A verificação em duas etapas já está desligada." };

  return guard(async (): Promise<FormState> => {
    const err = await checkCurrentPassword(user, password);
    if (err) return { fields: { senha: err } };
    const limit = await hit(`2fa:${user._id.toHexString()}`, 10, 15 * MIN);
    if (!limit.allowed || !(await consumeSecondFactor(user, code))) {
      return { fields: { codigo: "Código incorreto ou já usado." } };
    }
    const { users } = await db();
    await users.updateOne(
      { _id: user._id },
      { $set: { totp: { enabled: false, secret: null, lastStep: 0, enabledAt: null }, updatedAt: new Date() } },
    );
    await logEvent(user._id, "2fa_desativado");
    revalidatePath("/conta");
    return { ok: "Verificação em duas etapas desligada." };
  });
}

async function regenerateRecoveryCodesInner(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const password = str(form, "senha", MAX_PASSWORD_INPUT + 1);
  const code = str(form, "codigo", 32).replace(/\s/g, "");
  if (!password) return { fields: { senha: "Escreva sua senha para gerar códigos novos." } };
  if (user.totp.enabled && !/^\d{6}$/.test(code)) {
    return { fields: { codigo: "Escreva os 6 dígitos do app autenticador." } };
  }
  return guard(async (): Promise<FormState> => {
    const err = await checkCurrentPassword(user, password);
    if (err) return { fields: { senha: err } };
    if (user.totp.enabled) {
      // Só o código do app: códigos de recuperação não geram outros.
      const limit = await hit(`2fa:${user._id.toHexString()}`, 10, 15 * MIN);
      if (!limit.allowed || (await consumeSecondFactor(user, code)) !== "totp") {
        return { fields: { codigo: "Código incorreto ou já usado." } };
      }
    }
    const { users } = await db();
    const { codes, hashed } = makeRecoveryCodes(user._id);
    await users.updateOne({ _id: user._id }, { $set: { recoveryCodes: hashed, updatedAt: new Date() } });
    await logEvent(user._id, "codigos_gerados");
    revalidatePath("/conta");
    return { codes };
  });
}

async function deleteAccountInner(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const password = str(form, "senha", MAX_PASSWORD_INPUT + 1);
  const confirm = str(form, "confirmacao", 40).trim().toLowerCase();
  const code = str(form, "codigo", 64);
  const fields: Record<string, string> = {};
  if (!password) fields.senha = "Escreva sua senha.";
  if (confirm !== "excluir") fields.confirmacao = "Escreva excluir para confirmar.";
  if (user.totp.enabled && !code.trim()) fields.codigo = "Escreva um código do app ou de recuperação.";
  if (Object.keys(fields).length) return { fields };

  let done = false;
  const result = await guard(async (): Promise<FormState> => {
    const err = await checkCurrentPassword(user, password);
    if (err) return { fields: { senha: err } };
    if (user.totp.enabled) {
      const limit = await hit(`2fa:${user._id.toHexString()}`, 10, 15 * MIN);
      if (!limit.allowed || !(await consumeSecondFactor(user, code))) {
        return { fields: { codigo: "Código incorreto ou já usado." } };
      }
    }
    // Arquivos no MinIO primeiro (todas as versões e envios abertos): se o
    // armazenamento falhar, nada é excluído e a pessoa tenta de novo.
    await deleteUploadsOfUser(user._id);
    await deleteBuildsOfUser(user._id);
    const { users, sessions, mfa, events, saves, follows, projects } = await db();
    await sessions.deleteMany({ userId: user._id });
    await mfa.deleteMany({ userId: user._id });
    await events.deleteMany({ userId: user._id });
    await saves.deleteMany({ userId: user._id });
    await follows.deleteMany({ userId: user._id });
    await projects.deleteMany({ userId: user._id });
    await users.deleteOne({ _id: user._id });
    await destroyCurrentSession();
    done = true;
    return undefined;
  });
  if (done) redirect("/?conta=excluida");
  return result;
}

/** Falha do banco ao conferir a sessão vira mensagem, não página de erro. */
export async function updateName(prev: FormState, form: FormData): Promise<FormState> {
  return guard(() => updateNameInner(prev, form));
}

/** Falha do banco ao conferir a sessão vira mensagem, não página de erro. */
export async function changePassword(prev: FormState, form: FormData): Promise<FormState> {
  return guard(() => changePasswordInner(prev, form));
}

/** Falha do banco ao conferir a sessão vira mensagem, não página de erro. */
export async function confirmTotpSetup(prev: FormState, form: FormData): Promise<FormState> {
  return guard(() => confirmTotpSetupInner(prev, form));
}

/** Falha do banco ao conferir a sessão vira mensagem, não página de erro. */
export async function disableTotp(prev: FormState, form: FormData): Promise<FormState> {
  return guard(() => disableTotpInner(prev, form));
}

/** Falha do banco ao conferir a sessão vira mensagem, não página de erro. */
export async function regenerateRecoveryCodes(prev: FormState, form: FormData): Promise<FormState> {
  return guard(() => regenerateRecoveryCodesInner(prev, form));
}

/** Falha do banco ao conferir a sessão vira mensagem, não página de erro. */
export async function deleteAccount(prev: FormState, form: FormData): Promise<FormState> {
  return guard(() => deleteAccountInner(prev, form));
}

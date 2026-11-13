import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { db, type SecurityEventType, type UserDoc } from "./db";
import { randomToken, sha256 } from "./crypto";
import { requestInfo, type RequestInfo } from "./request";

const SECURE = process.env.NODE_ENV === "production";
/** __Host-: só HTTPS, sem Domain, Path=/; o navegador recusa qualquer outra forma. */
export const SESSION_COOKIE = SECURE ? "__Host-oi_sessao" : "oi_sessao";
export const MFA_COOKIE = SECURE ? "__Host-oi_2fa" : "oi_2fa";

const DAY = 24 * 60 * 60 * 1000;
/** Com "manter conectado": até 30 dias, caindo após 7 dias sem uso. */
const PERSISTENT_MAX = 30 * DAY;
const PERSISTENT_IDLE = 7 * DAY;
/** Sem "manter conectado": cookie de sessão do navegador, no máximo 12 horas e 2 horas parado. */
const BROWSER_MAX = 12 * 60 * 60 * 1000;
const BROWSER_IDLE = 2 * 60 * 60 * 1000;
const TOUCH_EVERY = 5 * 60 * 1000;

/** Uma sessão parada por mais tempo que o permitido já está morta. */
export function sessionIsIdle(s: { persistent: boolean; lastSeenAt: Date }, now = Date.now()) {
  return s.lastSeenAt.getTime() + (s.persistent ? PERSISTENT_IDLE : BROWSER_IDLE) < now;
}
export const MFA_TTL = 5 * 60 * 1000;

/**
 * Apagar um cookie __Host- exige os mesmos atributos (Secure, Path=/);
 * sem eles o navegador ignora o Set-Cookie e o cookie velho continua.
 */
async function expireCookie(name: string) {
  const jar = await cookies();
  jar.set(name, "", { ...cookieOptions(null), maxAge: 0 });
}

function cookieOptions(maxAgeMs: number | null) {
  return {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax" as const,
    path: "/",
    ...(maxAgeMs ? { maxAge: Math.floor(maxAgeMs / 1000) } : {}),
  };
}

export async function logEvent(userId: ObjectId, type: SecurityEventType, info?: RequestInfo) {
  const { events } = await db();
  const req = info ?? (await requestInfo());
  await events.insertOne({ userId, type, at: new Date(), ip: req.ip, userAgent: req.userAgent, place: req.place });
}

/** Cria uma sessão nova (token novo sempre: sem fixação de sessão). */
export async function createSession(userId: ObjectId, opts: { persistent: boolean; mfa: boolean }) {
  const { sessions } = await db();
  // Entrar por cima de uma sessão aberta: a antiga morre junto com o cookie.
  const previous = (await cookies()).get(SESSION_COOKIE)?.value;
  if (previous) await sessions.deleteOne({ _id: sha256(previous) });
  const info = await requestInfo();
  const token = randomToken(32);
  const now = new Date();
  const max = opts.persistent ? PERSISTENT_MAX : BROWSER_MAX;
  await sessions.insertOne({
    _id: sha256(token),
    publicId: randomToken(12),
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + max),
    persistent: opts.persistent,
    ip: info.ip,
    userAgent: info.userAgent,
    place: info.place,
    mfa: opts.mfa,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(opts.persistent ? max : null));
  await expireCookie(MFA_COOKIE);
}

export interface CurrentSession {
  user: UserDoc;
  sessionId: string;
  publicId: string;
}

/**
 * Sessão do pedido atual, ou null. Memorizada por pedido.
 * Também derruba sessões paradas por tempo demais.
 */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 40 || token.length > 60) return null;
  const { sessions, users } = await db();
  const id = sha256(token);
  const now = Date.now();
  const s = await sessions.findOne({ _id: id, expiresAt: { $gt: new Date(now) } });
  if (!s) return null;
  if (sessionIsIdle(s, now)) {
    await sessions.deleteOne({ _id: id });
    return null;
  }
  const user = await users.findOne({ _id: s.userId });
  if (!user) {
    await sessions.deleteOne({ _id: id });
    return null;
  }
  if (now - s.lastSeenAt.getTime() > TOUCH_EVERY) {
    await sessions.updateOne({ _id: id }, { $set: { lastSeenAt: new Date(now) } });
  }
  return { user, sessionId: id, publicId: s.publicId };
});

/** Encerra a sessão deste navegador. */
export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const { sessions } = await db();
    await sessions.deleteOne({ _id: sha256(token) });
  }
  await expireCookie(SESSION_COOKIE);
}

/** Encerra todas as sessões da conta, menos (opcionalmente) a atual. */
export async function destroyOtherSessions(userId: ObjectId, keepId?: string) {
  const { sessions, mfa } = await db();
  await sessions.deleteMany(keepId ? { userId, _id: { $ne: keepId } } : { userId });
  await mfa.deleteMany({ userId });
}

/* ------------------------------------------------------------------ */
/* Desafio de 2FA (entre a senha certa e o código do app)               */
/* ------------------------------------------------------------------ */

export async function createMfaChallenge(userId: ObjectId, persistent: boolean) {
  const { mfa } = await db();
  const token = randomToken(32);
  const now = new Date();
  await mfa.insertOne({
    _id: sha256(token),
    userId,
    persistent,
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + MFA_TTL),
  });
  const jar = await cookies();
  jar.set(MFA_COOKIE, token, cookieOptions(MFA_TTL));
}

export async function readMfaChallenge() {
  const jar = await cookies();
  const token = jar.get(MFA_COOKIE)?.value;
  if (!token || token.length < 40 || token.length > 60) return null;
  const { mfa } = await db();
  return mfa.findOne({ _id: sha256(token), expiresAt: { $gt: new Date() } });
}

export async function clearMfaChallenge(id?: string) {
  if (id) {
    const { mfa } = await db();
    await mfa.deleteOne({ _id: id });
  }
  await expireCookie(MFA_COOKIE);
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

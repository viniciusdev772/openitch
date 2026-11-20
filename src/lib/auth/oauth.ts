import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ObjectId } from "mongodb";
import { db } from "./db";
import { hashPassword, randomToken, safeEqual } from "./crypto";
import { hit } from "./ratelimit";
import { createMfaChallenge, createSession, destroyOtherSessions, logEvent } from "./session";
import { requestInfo } from "./request";
import { emailError, normalizeEmail, normalizeName, safeNext } from "./validate";

export type ProviderId = "google" | "resumestre";

export interface Claims {
  sub: string;
  email: string;
  name: string;
}

interface Provider {
  label: string;
  enabled(): boolean;
  /** Endpoint de autorização, client_id e parâmetros próprios do provedor. */
  authorize(): { url: string; params: Record<string, string>; clientId: string };
  /** "email" = e-mail não verificado; null = falha. */
  exchange(code: string, verifier: string, origin: string): Promise<Claims | "email" | null>;
}

const form = (body: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(body),
  signal: AbortSignal.timeout(8000),
  cache: "no-store" as const,
});

const resumestreUrl = () => (process.env.RESUMESTRE_URL || "https://www.resumestre.com.br").replace(/\/+$/, "");

const PROVIDERS: Record<ProviderId, Provider> = {
  google: {
    label: "Google",
    enabled: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    authorize: () => ({
      url: "https://accounts.google.com/o/oauth2/v2/auth",
      params: { prompt: "select_account" },
      clientId: process.env.GOOGLE_CLIENT_ID as string,
    }),
    // Troca o code pelo token direto no endpoint do Google (TLS) e confere as claims do id_token.
    async exchange(code, verifier, origin) {
      const clientId = process.env.GOOGLE_CLIENT_ID as string;
      const res = await fetch(
        "https://oauth2.googleapis.com/token",
        form({
          code,
          client_id: clientId,
          client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
          redirect_uri: redirectUri(origin, "google"),
          grant_type: "authorization_code",
          code_verifier: verifier,
        }),
      );
      if (!res.ok) return null;
      const idToken = ((await res.json()) as { id_token?: string }).id_token;
      const part = typeof idToken === "string" ? idToken.split(".") : [];
      if (part.length !== 3) return null;
      let p: Record<string, unknown>;
      try {
        p = JSON.parse(Buffer.from(part[1], "base64url").toString("utf8"));
      } catch {
        return null;
      }
      if (p.iss !== "https://accounts.google.com" && p.iss !== "accounts.google.com") return null;
      if (p.aud !== clientId || typeof p.exp !== "number" || p.exp * 1000 <= Date.now()) return null;
      if (typeof p.sub !== "string" || !p.sub || typeof p.email !== "string") return null;
      if (p.email_verified !== true) return "email";
      return { sub: p.sub, email: normalizeEmail(p.email), name: typeof p.name === "string" ? p.name : "" };
    },
  },
  resumestre: {
    label: "Resumestre",
    enabled: () => Boolean(process.env.RESUMESTRE_CLIENT_ID && process.env.RESUMESTRE_CLIENT_SECRET),
    authorize: () => ({
      url: `${resumestreUrl()}/oauth/authorize`,
      params: {},
      clientId: process.env.RESUMESTRE_CLIENT_ID as string,
    }),
    // Sem id_token: a identidade vem do /oauth/userinfo, chamado por TLS com o access_token.
    async exchange(code, verifier, origin) {
      const base = resumestreUrl();
      const res = await fetch(
        `${base}/oauth/token`,
        form({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri(origin, "resumestre"),
          client_id: process.env.RESUMESTRE_CLIENT_ID as string,
          client_secret: process.env.RESUMESTRE_CLIENT_SECRET as string,
          code_verifier: verifier,
        }),
      );
      if (!res.ok) return null;
      const token = ((await res.json()) as { access_token?: unknown }).access_token;
      if (typeof token !== "string" || !token) return null;
      const info = await fetch(`${base}/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!info.ok) return null;
      const p = (await info.json()) as Record<string, unknown>;
      if (typeof p.sub !== "string" || !p.sub || typeof p.email !== "string") return null;
      if (p.email_verified !== true) return "email";
      return { sub: p.sub, email: normalizeEmail(p.email), name: typeof p.name === "string" ? p.name : "" };
    },
  },
};

export const providerEnabled = (id: ProviderId) => PROVIDERS[id].enabled();
export const providerLabel = (id: ProviderId) => PROVIDERS[id].label;

/** Mensagens do ?erro=... em /entrar e /criar-conta. */
export const OAUTH_ERRORS: Record<string, string> = Object.fromEntries(
  (Object.keys(PROVIDERS) as ProviderId[]).flatMap((id) => {
    const l = PROVIDERS[id].label;
    return [
      [`${id}_cancelado`, `Você cancelou a entrada com o ${l}.`],
      [`${id}_falhou`, `Não deu para entrar com o ${l}. Tente de novo.`],
      [`${id}_sessao`, `A entrada com o ${l} expirou. Tente de novo.`],
      [`${id}_email`, `O ${l} não confirmou seu e-mail. Use outra conta ou entre com e-mail e senha.`],
      [`${id}_limite`, "Muitas tentativas. Espere alguns minutos."],
    ];
  }),
);

const cookieName = (id: ProviderId) => `${process.env.NODE_ENV === "production" ? "__Host-" : ""}oi_${id}`;
const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" } as const;

/** Só estes hosts podem ser o redirect_uri (precisam estar cadastrados no provedor). */
const HOSTS = [
  /^(www\.)?portaldosgames\.com\.br$/,
  /^openitch\.vercel\.app$/,
  /^openitch-[a-z0-9-]+\.vercel\.app$/,
  /^localhost(:\d{1,5})?$/,
];

/** Origem do pedido, se estiver na allowlist. */
function allowedOrigin(req: Request): string | null {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  if (!HOSTS.some((r) => r.test(host))) return null;
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

function redirectUri(origin: string, id: ProviderId) {
  return `${origin}/api/auth/${id}/callback`;
}

/** GET /api/auth/<id>/start */
export async function oauthStart(req: Request, id: ProviderId): Promise<never> {
  const url = new URL(req.url);
  const from = url.searchParams.get("p") === "criar-conta" ? "criar-conta" : "entrar";
  const origin = allowedOrigin(req);
  if (!providerEnabled(id) || !origin) redirect(`/${from}?erro=${id}_falhou`);
  if (!(await hit(`${id}:ip:${(await requestInfo()).ip}`, 20, 15 * 60 * 1000)).allowed) {
    redirect(`/${from}?erro=${id}_limite`);
  }

  const state = randomToken(24);
  const verifier = randomToken(32);
  const de = safeNext(url.searchParams.get("de"));
  // Lax: o cookie precisa voltar na navegação que vem do provedor.
  (await cookies()).set(cookieName(id), JSON.stringify({ s: state, v: verifier, de, p: from }), { ...cookieBase, maxAge: 600 });
  const a = PROVIDERS[id].authorize();
  const q = new URLSearchParams({
    client_id: a.clientId,
    redirect_uri: redirectUri(origin, id),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...a.params,
  });
  redirect(`${a.url}?${q}`);
}

/** GET /api/auth/<id>/callback */
export async function oauthCallback(req: Request, id: ProviderId): Promise<never> {
  const jar = await cookies();
  let saved: { s?: string; v?: string; de?: string; p?: string } = {};
  try {
    saved = JSON.parse(jar.get(cookieName(id))?.value ?? "{}");
  } catch {}
  jar.set(cookieName(id), "", { ...cookieBase, maxAge: 0 });
  const back = `/${saved.p === "criar-conta" ? "criar-conta" : "entrar"}`;

  const q = new URL(req.url).searchParams;
  const state = q.get("state") ?? "";
  const code = q.get("code") ?? "";
  const origin = allowedOrigin(req);
  if (!providerEnabled(id) || !origin || !saved.s || !saved.v || !state || !safeEqual(state, saved.s)) {
    redirect(`${back}?erro=${id}_sessao`);
  }
  if (q.get("error")) redirect(`${back}?erro=${id}_${q.get("error") === "access_denied" ? "cancelado" : "falhou"}`);
  if (!code) redirect(`${back}?erro=${id}_falhou`);

  let to: string;
  try {
    if (!(await hit(`${id}:cb:${(await requestInfo()).ip}`, 20, 15 * 60 * 1000)).allowed) {
      redirect(`${back}?erro=${id}_limite`);
    }
    const claims = await PROVIDERS[id].exchange(code, saved.v as string, origin as string);
    if (claims === "email") redirect(`${back}?erro=${id}_email`);
    if (!claims) redirect(`${back}?erro=${id}_falhou`);
    to = await signInWith(id, claims, safeNext(saved.de));
  } catch (err) {
    unstable_rethrow(err);
    console.error(`[${id}]`, err);
    to = `${back}?erro=${id}_falhou`;
  }
  redirect(to);
}

/**
 * Acha, vincula ou cria a conta e abre a sessão (ou o desafio de 2FA).
 * Devolve o destino do redirect.
 */
async function signInWith(id: ProviderId, c: Claims, next: string): Promise<string> {
  const { users } = await db();
  const info = await requestInfo();
  const subField = `${id}Sub` as "googleSub" | "resumestreSub";
  let user = await users.findOne({ [subField]: c.sub });

  if (!user) {
    if (emailError(c.email)) return `/entrar?erro=${id}_email`;
    user = await users.findOne({ email: c.email });
    if (user) {
      // E-mail verificado pelo provedor + conta existente: vincula. Como o site não confirma e-mail
      // no cadastro, quem tomou o endereço antes pode ter a senha; sem 2FA, a conta passa a ser
      // só do provedor (senha trocada por uma aleatória, outras sessões e códigos de recuperação limpos).
      const set: Record<string, unknown> = { [subField]: c.sub, updatedAt: new Date() };
      if (!user.totp.enabled && !user.noPassword) {
        Object.assign(set, {
          passwordHash: await hashPassword(randomToken(24)),
          noPassword: true,
          recoveryCodes: [],
          passwordChangedAt: new Date(),
        });
        await destroyOtherSessions(user._id);
      }
      await users.updateOne({ _id: user._id }, { $set: set });
      await logEvent(user._id, `${id}_vinculado`, info);
    } else {
      const _id = new ObjectId();
      const now = new Date();
      const name = normalizeName(c.name).slice(0, 60) || c.email.split("@")[0].slice(0, 60);
      try {
        await users.insertOne({
          _id,
          email: c.email,
          name,
          passwordHash: await hashPassword(randomToken(24)),
          noPassword: true,
          [subField]: c.sub,
          passwordChangedAt: now,
          createdAt: now,
          updatedAt: now,
          recoveryCodes: [],
          totp: { enabled: false, secret: null, lastStep: 0, enabledAt: null },
          totpPending: null,
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) return `/entrar?erro=${id}_falhou`;
        throw err;
      }
      await createSession(_id, { persistent: true, mfa: false });
      await logEvent(_id, "conta_criada", info);
      return next;
    }
  }

  if (user.totp.enabled) {
    await createMfaChallenge(user._id, true);
    return `/entrar/verificar?de=${encodeURIComponent(next)}`;
  }
  await createSession(user._id, { persistent: true, mfa: false });
  await logEvent(user._id, "entrada", info);
  return next;
}

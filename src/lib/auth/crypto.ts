import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/* ------------------------------------------------------------------ */
/* Segredo mestre                                                      */
/* ------------------------------------------------------------------ */
/*
 * AUTH_SECRET fica só no ambiente (Vercel), nunca no repositório. Dele saem,
 * por HKDF, chaves independentes para cada uso. Com isso, quem ler o banco
 * (sem o segredo) não consegue testar senhas offline, nem ler os segredos de
 * 2FA, nem forjar códigos de recuperação.
 */
const DEV_SECRET = "openitch-dev-only-secret-never-use-this-in-production";

function usesLocalDatabase(): boolean {
  const uri = process.env.MONGODB_URI ?? "";
  return /^mongodb(\+srv)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|\?|$)/.test(uri);
}

let master: Buffer | null = null;
function masterSecret(): Buffer {
  if (master) return master;
  const raw = process.env.AUTH_SECRET;
  if (raw && raw.length >= 32) {
    master = Buffer.from(raw, "utf8");
  } else if (process.env.NODE_ENV !== "production" && usesLocalDatabase()) {
    // Só com um banco nesta máquina: nunca grave no banco de produção dados
    // derivados de um segredo que a produção não conhece.
    master = Buffer.from(DEV_SECRET, "utf8");
  } else {
    // Falha fechada: sem segredo em produção, nada de autenticação.
    throw new Error(
      "AUTH_SECRET ausente ou curto demais (mínimo de 32 caracteres). Em desenvolvimento, defina AUTH_SECRET ou aponte MONGODB_URI para um MongoDB local (localhost).",
    );
  }
  return master;
}

type Purpose = "pepper" | "totp" | "recovery" | "ratelimit";
const derived = new Map<Purpose, Buffer>();
function key(purpose: Purpose): Buffer {
  let k = derived.get(purpose);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", masterSecret(), "openitch-auth-v1", purpose, 32));
    derived.set(purpose, k);
  }
  return k;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hmac(purpose: Purpose, value: string): string {
  return createHmac("sha256", key(purpose)).update(value, "utf8").digest("hex");
}

/** Comparação em tempo constante de duas strings (hex, base64url etc.). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/* ------------------------------------------------------------------ */
/* Senhas: HMAC (pimenta) + scrypt                                     */
/* ------------------------------------------------------------------ */

/*
 * Parâmetros da recomendação da OWASP com 32 MiB por hash (N=2^15, r=8, p=3):
 * mesmo custo de CPU que N=2^17/p=1, um quarto da memória. No máximo 4 hashes
 * rodam ao mesmo tempo por instância; o resto espera na fila, para que uma
 * rajada de pedidos não esgote a memória da função.
 */
const SCRYPT = { N: 2 ** 15, r: 8, p: 3, keylen: 32 } as const;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const MAX_PARALLEL = 4;

let running = 0;
const queue: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((r) => queue.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    queue.shift()?.();
  }
}

function scrypt(password: Buffer, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return withSlot(
    () =>
      new Promise((resolve, reject) => {
        scryptCb(password, salt, keylen, opts, (err, dk) => (err ? reject(err) : resolve(dk)));
      }),
  );
}

function pepper(password: string): Buffer {
  return createHmac("sha256", key("pepper")).update(password.normalize("NFKC"), "utf8").digest();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await scrypt(pepper(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$1$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64url")}$${dk.toString("base64url")}`;
}

/**
 * Confere a senha. Nunca lança por hash malformado: devolve false.
 * needsRehash avisa quando os parâmetros guardados ficaram abaixo dos atuais.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  const parts = stored.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "1") {
    return { ok: false, needsRehash: false };
  }
  const N = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);
  // Limites para que um hash adulterado no banco não vire negação de serviço.
  const sane =
    Number.isInteger(N) && N >= 2 ** 14 && N <= 2 ** 16 && (N & (N - 1)) === 0 &&
    Number.isInteger(r) && r === 8 &&
    Number.isInteger(p) && p >= 1 && p <= 4 &&
    128 * N * r * 1.1 < SCRYPT_MAXMEM;
  if (!sane) return { ok: false, needsRehash: false };
  const salt = Buffer.from(parts[5], "base64url");
  const expected = Buffer.from(parts[6], "base64url");
  if (salt.length < 16 || expected.length !== SCRYPT.keylen) return { ok: false, needsRehash: false };
  const dk = await scrypt(pepper(password), salt, expected.length, { N, r, p, maxmem: SCRYPT_MAXMEM });
  const ok = timingSafeEqual(dk, expected);
  return { ok, needsRehash: ok && (N !== SCRYPT.N || r !== SCRYPT.r || p !== SCRYPT.p) };
}

/** Hash de uma senha aleatória, usado para gastar o mesmo tempo quando o e-mail não existe. */
let dummy: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummy ??= hashPassword(randomToken(24));
  return dummy;
}

/* ------------------------------------------------------------------ */
/* Cifra simétrica (AES-256-GCM) para os segredos de 2FA                */
/* ------------------------------------------------------------------ */

export function encryptSecret(plain: Buffer, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("totp"), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${ct.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptSecret(sealed: string, context: string): Buffer | null {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key("totp"), Buffer.from(parts[1], "base64url"));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Códigos de recuperação                                               */
/* ------------------------------------------------------------------ */

/** Base32 de Crockford em minúsculas: sem i, l, o, u, para não confundir. */
const CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz";

export function newRecoveryCode(): string {
  let s = "";
  for (let i = 0; i < 10; i++) s += CROCKFORD[randomInt(32)];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

/** Aceita maiúsculas, espaços, hífens e as trocas comuns (i/l → 1, o → 0). */
export function normalizeRecoveryCode(input: string): string | null {
  const s = input
    .toLowerCase()
    .replace(/[\s-]/g, "")
    .replace(/[il]/g, "1")
    .replace(/o/g, "0");
  if (s.length !== 10) return null;
  for (const ch of s) if (!CROCKFORD.includes(ch)) return null;
  return s;
}

export function hashRecoveryCode(userId: string, normalized: string): string {
  return hmac("recovery", `${userId}:${normalized}`);
}

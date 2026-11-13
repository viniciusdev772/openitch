import "server-only";
import { createHash } from "node:crypto";

/**
 * Validação sem schema: cada campo vem do FormData e é tratado como string
 * desconhecida. Nada que não seja string chega a uma consulta do banco.
 */

export function str(form: FormData, name: string, max = 512): string {
  const v = form.get(name);
  if (typeof v !== "string") return "";
  return v.length > max ? v.slice(0, max) : v;
}

export function normalizeEmail(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

export function emailError(email: string): string | null {
  if (!email) return "Escreva seu e-mail.";
  if (email.length > 254 || !/^[^\s@\p{Cc}]+@[^\s@\p{Cc}]+\.[^\s@\p{Cc}]{2,}$/u.test(email)) {
    return "Esse e-mail não parece completo. Confira se tem @ e domínio, como voce@exemplo.com.";
  }
  return null;
}

export function normalizeName(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameError(name: string): string | null {
  const len = [...name].length;
  if (len < 2) return "Escreva como quer ser chamado (pelo menos 2 letras).";
  if (len > 60) return "Use até 60 caracteres no nome.";
  return null;
}

/** Senhas que aparecem no topo de toda lista de vazamentos. */
const COMMON = new Set(
  `123456 123456789 12345678 1234567890 1234567 12345 qwerty password senha senha123 senha1234
  111111 000000 123123 abc123 password1 iloveyou admin admin123 welcome letmein monkey dragon
  qwertyuiop asdfghjkl zxcvbnm 1q2w3e4r 1q2w3e4r5t qwerty123 football futebol flamengo corinthians
  palmeiras saopaulo gremio vasco brasil brasil123 mudar123 mudar@123 trocar123 teste123 teste
  sucesso princesa amor amorzinho batman superman pokemon minecraft openitch itchio gamer`
    .split(/\s+/)
    .filter(Boolean),
);

export function passwordError(password: string, context: string[] = []): string | null {
  const len = [...password].length;
  if (len < 10) return "Use pelo menos 10 caracteres. Uma frase curta funciona bem.";
  if (len > 128) return "Use até 128 caracteres.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password) || /^(0123456789|1234567890|9876543210)+$/.test(password)) {
    return "Essa senha é das mais usadas no mundo. Escolha outra.";
  }
  for (const c of context) {
    const part = c.toLowerCase().split("@")[0];
    if (part.length >= 4 && lower.includes(part)) return "A senha não pode conter seu nome ou seu e-mail.";
  }
  return null;
}

/**
 * Consulta anônima ao Have I Been Pwned (k-anonimato: só os 5 primeiros
 * caracteres do SHA-1 saem daqui). Se o serviço não responder em 2,5 s,
 * segue sem bloquear.
 */
export async function passwordWasLeaked(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "openitch-auth" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [s, count] = line.trim().split(":");
      if (s === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Só caminhos internos: evita redirecionamento aberto para outro site. */
export function safeNext(raw: string | null | undefined, fallback = "/conta"): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(raw)) return fallback;
  if (raw.length > 512) return fallback;
  // Voltar para uma tela de entrada depois de entrar daria um laço.
  if (/^\/(entrar|criar-conta|recuperar)(\/|\?|#|$)/.test(raw)) return fallback;
  return raw;
}

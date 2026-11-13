import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "./crypto";

/** TOTP (RFC 6238): HMAC-SHA1, 6 dígitos, passos de 30 segundos. */
const PERIOD = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret(): Buffer {
  return randomBytes(20);
}

export function base32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / PERIOD);
}

/**
 * Confere o código aceitando um passo de folga para cada lado (relógio do
 * celular adiantado ou atrasado). Passos já usados (<= lastStep) são
 * recusados, então um código não serve duas vezes.
 * Devolve o passo aceito, ou null.
 */
export function verifyTotp(secret: Buffer, code: string, lastStep: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = currentStep();
  let match: number | null = null;
  for (const step of [now - 1, now, now + 1]) {
    // Sem sair cedo do laço: o tempo gasto não depende de qual passo bateu.
    const ok = safeEqual(hotp(secret, step), code);
    if (ok && step > lastStep && match === null) match = step;
  }
  return match;
}

export function otpauthUri(secret: Buffer, account: string): string {
  const issuer = "VibeGames";
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: base32(secret),
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

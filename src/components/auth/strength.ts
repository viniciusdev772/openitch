/**
 * Estimativa de força de senha (0 a 4), feita no navegador só para orientar.
 * Quem decide é o servidor (tamanho mínimo, lista comum, vazamentos).
 */
const COMMON = /^(123456|password|senha|qwerty|abc123|111111|iloveyou|admin|letmein|welcome|brasil)/i;
const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function scorePassword(pw: string, context: string[] = []): number {
  const chars = [...pw];
  const len = chars.length;
  if (len < 10) return 0;

  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  let bits = len * Math.log2(Math.max(pool, 10));

  // Repetições e sequências valem pouco.
  const unique = new Set(chars).size;
  if (unique / len < 0.5) bits *= 0.6;
  const lower = pw.toLowerCase();
  for (const seq of SEQUENCES) {
    for (let i = 0; i + 4 <= seq.length; i++) {
      if (lower.includes(seq.slice(i, i + 4))) {
        bits -= 12;
        break;
      }
    }
  }
  if (COMMON.test(pw)) bits -= 30;
  for (const c of context) {
    const part = c.toLowerCase().split("@")[0];
    if (part.length >= 4 && lower.includes(part)) bits -= 30;
  }

  if (bits < 45) return 1;
  if (bits < 60) return 2;
  if (bits < 80) return 3;
  return 4;
}

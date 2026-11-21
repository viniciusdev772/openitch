/* Regras dos comentários, sem banco (testáveis e usadas no navegador também). */

import { stripInvisible } from "@/lib/projects/limits";

export const COMMENT_MAX = 1000;
export const COMMENT_MIN = 2;
/** Comentários de primeiro nível por página. */
export const COMMENTS_PAGE = 20;
/** Respostas mostradas por fio. */
export const REPLIES_MAX = 50;

/** Tira caracteres invisíveis, espaços nas pontas e linhas em branco demais. */
export function cleanComment(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Escreva o comentário." };
  const body = stripInvisible(raw)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (body.length < COMMENT_MIN) return { ok: false, error: "Escreva o comentário." };
  if (body.length > COMMENT_MAX) return { ok: false, error: `Use no máximo ${COMMENT_MAX.toLocaleString("pt-BR")} caracteres.` };
  return { ok: true, body };
}

/** Tem endereço da web? (conta nova não manda link: é o formato preferido do spam). */
export const hasLink = (s: string) => /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|br|xyz|ru|gg|ly|me|app|site|shop)(\/|\b)/i.test(s);

/** "agora", "há 5 min", "há 3 h", "há 2 dias", depois a data. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 30) return d === 1 ? "há 1 dia" : `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

import { formatDate, type Creator } from "@/data/base";

/** "No programa desde novembro de 2026." (ou só "No programa." sem a data). */
export function creatorSince(c: Creator): string {
  return c.joined ? `No programa desde ${formatDate(c.joined).replace(/^\d+ de /, "")}.` : "No programa da VibeGames.";
}

/**
 * A linha de apresentação de quem faz: cidade e bio quando existem; sem elas,
 * desde quando publica no programa.
 */
export function creatorLine(c: Creator): string {
  const parts = [c.city, c.bio].map((x) => x.trim()).filter(Boolean);
  if (parts.length) return parts.map((x) => (/[.!?…]$/.test(x) ? x : `${x}.`)).join(" ");
  return creatorSince(c);
}

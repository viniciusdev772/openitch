/* A conta da espera de conta nova, sem segredo nem banco (testável). Ver novato.ts. */

const HOUR = 60 * 60 * 1000;
export const MIN_WAIT_MS = 3 * HOUR;
export const MAX_WAIT_MS = 72 * HOUR;

/** createdAt + 3 h a 3 dias, escolhido pelos primeiros 48 bits do HMAC (hex). */
export function openAtFor(createdAt: Date, hmacHex: string): Date {
  const n = parseInt(hmacHex.slice(0, 12), 16);
  return new Date(createdAt.getTime() + MIN_WAIT_MS + (n % (MAX_WAIT_MS - MIN_WAIT_MS + 1)));
}

function left(ms: number): string {
  const h = Math.ceil(ms / HOUR);
  if (h <= 1) return "menos de 1 hora";
  if (h < 24) return `cerca de ${h} horas`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return `cerca de ${d} ${d === 1 ? "dia" : "dias"}${r ? ` e ${r} ${r === 1 ? "hora" : "horas"}` : ""}`;
}

export function waitMessage(at: Date, now: number): string {
  const when = at.toLocaleString("pt-BR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return (
    `Contas novas esperam um pouco antes de enviar arquivos (jogos, builds, capas e imagens). ` +
    `É a nossa defesa contra contas criadas só para espalhar vírus, golpes ou spam: a espera de cada conta é sorteada entre 3 horas e 3 dias, ` +
    `então quem cria contas em série não sabe quando poderá enviar. A sua libera em ${when.replace(" às", ", às")} (horário de Brasília), daqui a ${left(at.getTime() - now)}. ` +
    `Enquanto isso, você já pode escrever e salvar o rascunho.`
  );
}

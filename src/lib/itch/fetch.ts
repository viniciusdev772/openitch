import "server-only";
import { gameBase, parseImageUrl, parseItchUrl } from "./parse";

/*
 * Busca no itch.io, com as travas de servidor: só https em itch.io/*.itch.io
 * (sem credenciais nem porta), redirecionamentos seguidos à mão (no máximo 3,
 * cada salto validado de novo), imagens só de img.itch.zone, 10 s e um teto de
 * bytes por resposta.
 *
 * ponytail: a trava é pelo nome do host, sem conferir o IP resolvido. Como
 * *.itch.io só aponta para a infraestrutura do itch, serve; se o domínio
 * passar a aceitar apontamentos de terceiros, resolva o DNS e recuse IPs
 * privados antes de conectar.
 */

const UA = "PortalDosGames-Import/1.0";
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
export const HTML_MAX = 2 * 1024 * 1024;
export const IMAGE_MAX = 4 * 1024 * 1024;

export class ItchError extends Error {
  constructor(
    public code: "url" | "nao_encontrado" | "limite" | "indisponivel" | "chave" | "expirou" | "mudou" | "sem_conta" | "nao_e_seu",
    message: string,
  ) {
    super(message);
  }
}

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > max) throw new ItchError("indisponivel", "A página do itch é grande demais para importar.");
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      throw new ItchError("indisponivel", "A página do itch é grande demais para importar.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** GET com redirecionamentos à mão. `allow` decide, a cada salto, se o endereço serve. */
async function guarded(start: URL, allow: (u: URL) => URL | null, accept: string, max: number): Promise<{ url: URL; body: Uint8Array }> {
  let url: URL | null = allow(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!url) throw new ItchError("url", "Esse endereço não é de uma página do itch.io.");
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": UA, accept },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new ItchError("indisponivel", "O itch.io não respondeu a tempo. Tente de novo em instantes.");
    }
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => undefined);
      const loc = res.headers.get("location");
      url = loc ? allow(new URL(loc, url)) : null;
      continue;
    }
    if (res.status === 429) throw new ItchError("limite", "O itch.io pediu para esperar um pouco. Tente de novo em alguns minutos.");
    if (res.status === 404 || res.status === 403 || res.status === 410) {
      throw new ItchError("nao_encontrado", "Não achamos essa página no itch.io. Confira o endereço (e se o jogo é público).");
    }
    if (!res.ok) throw new ItchError("indisponivel", "O itch.io não respondeu como esperado. Tente de novo em instantes.");
    return { url, body: await readCapped(res, max) };
  }
  throw new ItchError("indisponivel", "O endereço do itch redirecionou vezes demais.");
}

const text = (b: Uint8Array) => new TextDecoder().decode(b);

/** data.json do jogo; o endereço final (depois dos redirecionamentos) diz onde a página mora. */
export async function fetchItchJson(pageUrl: URL): Promise<{ base: string; json: unknown }> {
  const { url, body } = await guarded(new URL(`${gameBase(pageUrl)}/data.json`), parseItchUrl_, "application/json", 256 * 1024);
  try {
    return { base: gameBase(url).replace(/\/data\.json$/, ""), json: JSON.parse(text(body)) };
  } catch {
    throw new ItchError("nao_encontrado", "Esse endereço não parece ser a página de um jogo do itch.io.");
  }
}

export async function fetchItchHtml(base: string): Promise<string> {
  const start = parseItchUrl(base);
  if (!start) throw new ItchError("url", "Esse endereço não é de uma página do itch.io.");
  return text((await guarded(start, parseItchUrl_, "text/html", HTML_MAX)).body);
}

/** Baixa a imagem (img.itch.zone). Quem chama confere os bytes. Qualquer falha: null (a capa é opcional). */
export async function fetchItchImage(raw: string): Promise<Uint8Array | null> {
  const start = parseImageUrl(raw);
  if (!start) return null;
  try {
    return (await guarded(start, (u) => parseImageUrl(u.href), "image/png,image/jpeg,image/webp", IMAGE_MAX)).body;
  } catch {
    return null;
  }
}

const parseItchUrl_ = (u: URL) => parseItchUrl(u.href);


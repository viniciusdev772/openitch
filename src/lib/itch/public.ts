import "server-only";
import { ItchError } from "./fetch";
import { parseItchUrl } from "./parse";
import { cdnExpiry, parseUploadList, type ItchUpload } from "./uploads";

/*
 * Arquivos de um jogo pelo caminho público do itch.io, o mesmo do botão
 * "Download" de um visitante (sem conta e sem chave):
 *
 *   1. GET da página do jogo: cookies da sessão anônima e o csrf_token (<meta>);
 *   2. ids dos arquivos: na própria página (jogo grátis) ou, se o jogo pede
 *      "pague quanto quiser", em POST /download_url -> página de downloads;
 *   3. POST /file/<id>?source=game_download com o csrf_token -> { url } assinado
 *      do CDN (dl.itch.zone -> espelho), válido por um tempo (Expires);
 *   4. os bytes saem do CDN com Range (ver itchRange).
 *
 * Jogo pago (sem "pague quanto quiser") não libera o arquivo sem compra: o itch
 * responde erro e o criador envia à mão.
 *
 * ponytail: depende da marcação e das rotas públicas do itch; se mudarem, a lista
 * sai vazia ou a cópia falha com mensagem, e o envio manual continua funcionando.
 */

const UA = "Mozilla/5.0 (compatible; PortalDosGames-Import/1.0)";
const TIMEOUT_MS = 15_000;
const HTML_MAX = 3 * 1024 * 1024;

type Jar = Map<string, string>;

function keep(jar: Jar, res: Response) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

const cookieHeader = (jar: Jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

/** Pedido ao itch.io (só https em *.itch.io), redirecionamentos à mão com os cookies acumulados. */
async function itch(jar: Jar, start: string, init: { method?: "GET" | "POST"; form?: Record<string, string>; accept?: string } = {}) {
  let url = parseItchUrl(start);
  let method = init.method ?? "GET";
  let body: string | undefined = init.form ? new URLSearchParams(init.form).toString() : undefined;
  for (let hop = 0; hop <= 3; hop++) {
    if (!url) throw new ItchError("url", "O itch.io mandou para um endereço que não é dele.");
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": UA,
          accept: init.accept ?? "text/html",
          ...(jar.size ? { cookie: cookieHeader(jar) } : {}),
          ...(body ? { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest", origin: url.origin, referer: url.href } : {}),
        },
        body,
      });
    } catch {
      throw new ItchError("indisponivel", "O itch.io não respondeu a tempo. Tente de novo em instantes.");
    }
    keep(jar, res);
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => undefined);
      const loc = res.headers.get("location");
      url = loc ? parseItchUrl(new URL(loc, url).href) : null;
      if (res.status === 303 || method === "POST") {
        method = "GET";
        body = undefined;
      }
      continue;
    }
    if (res.status === 429) throw new ItchError("limite", "O itch.io pediu para esperar um pouco. Tente de novo em alguns minutos.");
    if (res.status === 404 || res.status === 410) throw new ItchError("nao_encontrado", "Não achamos esse jogo no itch.io. Confira se ele ainda é público.");
    const declared = Number(res.headers.get("content-length"));
    if (declared > HTML_MAX) throw new ItchError("indisponivel", "A resposta do itch.io é grande demais.");
    const text = await res.text();
    if (text.length > HTML_MAX) throw new ItchError("indisponivel", "A resposta do itch.io é grande demais.");
    return { res, url, text };
  }
  throw new ItchError("indisponivel", "O itch.io redirecionou vezes demais.");
}

const csrfOf = (html: string) => /<meta\s+name="csrf_token"\s+value="([^"]+)"/.exec(html)?.[1] ?? null;

/** Sessão anônima na página do jogo: cookies e csrf_token. */
async function open(gameUrl: string) {
  const jar: Jar = new Map();
  const page = await itch(jar, gameUrl);
  const csrf = csrfOf(page.text);
  if (!csrf) throw new ItchError("indisponivel", "A página do itch.io não veio como esperado. Tente de novo em instantes.");
  const base = `${page.url.origin}${page.url.pathname.replace(/\/+$/, "")}`;
  return { jar, csrf, base, html: page.text };
}

async function postJson(jar: Jar, url: string, csrf: string): Promise<Record<string, unknown>> {
  const { text } = await itch(jar, url, { method: "POST", form: { csrf_token: csrf }, accept: "application/json" });
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ItchError("indisponivel", "O itch.io não respondeu como esperado. Tente de novo em instantes.");
  }
}

const errorsOf = (j: Record<string, unknown>) => (Array.isArray(j.errors) ? j.errors.map(String) : []);

/** Arquivos para baixar do jogo (pode ser vazia: jogo só de navegador, pago, ou marcação desconhecida). */
export async function publicUploads(gameUrl: string): Promise<ItchUpload[]> {
  const s = await open(gameUrl);
  const onPage = parseUploadList(s.html);
  if (onPage.length) return onPage;
  // "Pague quanto quiser" (ou mínimo zero): a lista com os ids fica na página de downloads.
  const j = await postJson(s.jar, `${s.base}/download_url`, s.csrf);
  const to = typeof j.url === "string" ? j.url : null;
  if (!to) return [];
  return parseUploadList((await itch(s.jar, to)).text);
}

/** Link assinado do CDN para um arquivo, com a validade dele. */
export async function publicFileUrl(gameUrl: string, uploadId: number): Promise<{ url: string; expires: Date | null }> {
  const s = await open(gameUrl);
  const j = await postJson(s.jar, `${s.base}/file/${uploadId}?source=game_download&as_props=1`, s.csrf);
  const url = typeof j.url === "string" ? j.url : null;
  if (!url) {
    const errs = errorsOf(j).join(" ");
    throw new ItchError(
      /purchase|buy|price|key/i.test(errs) ? "pago" : "indisponivel",
      /purchase|buy|price|key/i.test(errs)
        ? "Esse arquivo só sai do itch.io depois da compra. Baixe lá e envie pelo passo 3."
        : "O itch.io não liberou esse arquivo agora. Tente de novo em instantes.",
    );
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ItchError("indisponivel", "O itch.io devolveu um link de download inválido.");
  }
  if (u.protocol !== "https:") throw new ItchError("indisponivel", "O itch.io devolveu um link de download inválido.");
  return { url: u.href, expires: cdnExpiry(u.href) };
}

/**
 * Bytes [start, end] do CDN. Exige 206 com Content-Range batendo com o pedido e
 * com o tamanho total esperado (null = só descobrir o total, para o primeiro
 * pedido). Um servidor que ignore o Range é recusado, para nunca gravar bytes
 * fora do lugar. Redirecionamentos do CDN (dl.itch.zone -> espelho) são seguidos
 * só para https.
 */
export async function itchRange(url: string, start: number, end: number, total: number | null): Promise<{ bytes: Uint8Array; total: number }> {
  let at = url;
  let res: Response | null = null;
  for (let hop = 0; hop <= 3; hop++) {
    try {
      res = await fetch(at, {
        headers: { "user-agent": UA, range: `bytes=${start}-${end}` },
        redirect: "manual",
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
      });
    } catch {
      throw new ItchError("indisponivel", "O download do itch.io parou no meio. Tente de novo; continua de onde parou.");
    }
    if (res.status < 300 || res.status >= 400) break;
    await res.body?.cancel().catch(() => undefined);
    const loc = res.headers.get("location");
    const next = loc ? new URL(loc, at) : null;
    if (!next || next.protocol !== "https:") throw new ItchError("indisponivel", "O CDN do itch.io mandou para um endereço inválido.");
    at = next.href;
    res = null;
  }
  if (!res) throw new ItchError("indisponivel", "O CDN do itch.io redirecionou vezes demais.");
  if (res.status === 403 || res.status === 410 || res.status === 400) {
    await res.body?.cancel().catch(() => undefined);
    throw new ItchError("expirou", "O link de download do itch.io expirou.");
  }
  if (res.status !== 206) {
    await res.body?.cancel().catch(() => undefined);
    throw new ItchError("indisponivel", "O itch.io não entregou o arquivo em partes, então não dá para trazê-lo por aqui. Baixe no itch e envie pelo passo 3.");
  }
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
  const whole = m ? Number(m[3]) : NaN;
  const last = Math.min(end, whole - 1);
  if (!m || Number(m[1]) !== start || Number(m[2]) !== last || (total !== null && whole !== total)) {
    await res.body?.cancel().catch(() => undefined);
    throw new ItchError("mudou", "O arquivo no itch.io mudou durante a cópia. Exclua o envio e traga de novo.");
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength !== last - start + 1) throw new ItchError("indisponivel", "O download do itch.io veio incompleto. Tente de novo.");
  return { bytes, total: whole };
}

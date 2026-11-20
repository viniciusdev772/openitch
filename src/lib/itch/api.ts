import "server-only";
import { ItchError } from "./fetch";
import { normalizeUpload, type ItchUpload } from "./uploads";

export type { ItchUpload } from "./uploads";

/*
 * API do itch.io com a chave do próprio criador (Authorization: Bearer).
 *
 * - /profile e /profile/games são documentados (itch.io/docs/api/serverside).
 * - /games/<id>/uploads, /uploads/<id>/download e /builds/<id>/download/archive/default
 *   são os que o app oficial usa (github.com/itchio/go-itchio, endpoints_uploads.go).
 *   O formato da resposta varia (snake_case ou camelCase, plataformas em objeto
 *   ou em p_*), então a leitura aceita as duas formas.
 *
 * A chave nunca sai do servidor e nunca vai para log.
 */

const API = "https://api.itch.io";
const UA = "PortalDosGames-Import/1.0";
const TIMEOUT_MS = 15_000;

type Json = Record<string, unknown>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const strv = (v: unknown) => (typeof v === "string" ? v : "");
const pick = (o: Json, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

async function call(key: string, path: string): Promise<Json> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${key}`, "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new ItchError("indisponivel", "O itch.io não respondeu a tempo. Tente de novo em instantes.");
  }
  if (res.status === 429) throw new ItchError("limite", "O itch.io pediu para esperar um pouco. Tente de novo em alguns minutos.");
  const data = (await res.json().catch(() => null)) as Json | null;
  const errors = Array.isArray(data?.errors) ? (data.errors as unknown[]).map(String) : [];
  if (res.status === 401 || res.status === 403 || errors.some((e) => /key|auth|credential/i.test(e))) {
    throw new ItchError("chave", "O itch.io recusou a chave. Gere outra em itch.io/user/settings/api-keys e ligue de novo.");
  }
  if (res.status === 404 || errors.some((e) => /not found|invalid (game|upload)/i.test(e))) {
    throw new ItchError("nao_encontrado", "O itch.io não achou esse jogo ou arquivo na sua conta.");
  }
  if (!res.ok || !data || errors.length) throw new ItchError("indisponivel", "O itch.io não respondeu como esperado. Tente de novo em instantes.");
  return data;
}

/* ------------------------------------------------------------------ */
/* Conta e jogos                                                       */
/* ------------------------------------------------------------------ */

export async function itchProfile(key: string): Promise<{ id: number; username: string }> {
  const user = (await call(key, "/profile")).user as Json | undefined;
  const id = num(user?.id);
  if (!user || id === null) throw new ItchError("chave", "O itch.io não devolveu a conta dessa chave.");
  return { id, username: strv(user.username) || strv(user.display_name) || `#${id}` };
}

export interface ItchGame {
  id: number;
  title: string;
  url: string;
  coverUrl: string | null;
  shortText: string;
  published: boolean;
}

export async function itchGames(key: string): Promise<ItchGame[]> {
  const list = (await call(key, "/profile/games")).games;
  if (!Array.isArray(list)) return [];
  const out: ItchGame[] = [];
  for (const raw of list as Json[]) {
    const id = num(raw?.id);
    const url = strv(raw?.url).replace(/^http:\/\//i, "https://");
    if (id === null || !url) continue;
    out.push({
      id,
      title: strv(raw.title) || `Jogo ${id}`,
      url,
      coverUrl: strv(pick(raw, "cover_url", "coverUrl")).replace(/^http:\/\//i, "https://") || null,
      shortText: strv(pick(raw, "short_text", "shortText")),
      published: raw.published !== false,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Arquivos                                                            */
/* ------------------------------------------------------------------ */

export async function itchUploads(key: string, gameId: number): Promise<ItchUpload[]> {
  const list = (await call(key, `/games/${gameId}/uploads`)).uploads;
  if (!Array.isArray(list)) return [];
  return (list as Json[]).map(normalizeUpload).filter((u): u is ItchUpload => u !== null);
}

/** Endereço que entrega os bytes do upload (o do CDN, depois do redirecionamento da API). */
export async function itchDownloadUrl(key: string, up: Pick<ItchUpload, "id" | "storage" | "buildId">): Promise<string> {
  const path =
    up.storage === "build" && up.buildId ? `/builds/${up.buildId}/download/archive/default` : `/uploads/${up.id}/download`;
  const start = `${API}${path}?api_key=${encodeURIComponent(key)}`;
  let res: Response;
  try {
    res = await fetch(start, {
      method: "GET",
      headers: { authorization: `Bearer ${key}`, "user-agent": UA, range: "bytes=0-0" },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new ItchError("indisponivel", "O itch.io não respondeu a tempo. Tente de novo em instantes.");
  }
  await res.body?.cancel().catch(() => undefined);
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    const url = loc ? new URL(loc, start) : null;
    if (!url || url.protocol !== "https:") throw new ItchError("indisponivel", "O itch.io devolveu um endereço de download inválido.");
    return url.href;
  }
  if (res.status === 401 || res.status === 403) throw new ItchError("chave", "O itch.io não liberou o download desse arquivo para a sua chave.");
  if (res.status === 404) throw new ItchError("nao_encontrado", "O itch.io não achou esse arquivo.");
  if (res.status === 429) throw new ItchError("limite", "O itch.io pediu para esperar um pouco. Tente de novo em alguns minutos.");
  // Sem redirecionamento: a própria API entrega os bytes.
  if (res.ok) return start;
  throw new ItchError("indisponivel", "O itch.io não liberou o download agora. Tente de novo em instantes.");
}

/**
 * Bytes [start, end] do arquivo. Exige 206 com Content-Range batendo com o
 * pedido e com o tamanho total esperado: um servidor que ignore o Range
 * (200 com o arquivo inteiro) é recusado, para nunca gravar bytes fora do lugar.
 */
export async function itchRange(url: string, start: number, end: number, total: number, key: string): Promise<Uint8Array> {
  let res: Response;
  try {
    const sameApi = url.startsWith(API);
    res = await fetch(url, {
      headers: { "user-agent": UA, range: `bytes=${start}-${end}`, ...(sameApi ? { authorization: `Bearer ${key}` } : {}) },
      redirect: "error",
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
  } catch {
    throw new ItchError("indisponivel", "O download do itch.io parou no meio. Tente de novo; continua de onde parou.");
  }
  if (res.status === 403 || res.status === 410) {
    await res.body?.cancel().catch(() => undefined);
    throw new ItchError("expirou", "O link de download do itch.io expirou. Tente de novo.");
  }
  if (res.status !== 206) {
    await res.body?.cancel().catch(() => undefined);
    throw new ItchError("indisponivel", "O itch.io não entregou o arquivo em partes, então não dá para trazê-lo por aqui. Baixe no itch e envie pelo passo 3.");
  }
  const m = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(res.headers.get("content-range") ?? "");
  if (!m || Number(m[1]) !== start || Number(m[2]) !== end || (m[3] !== "*" && Number(m[3]) !== total)) {
    await res.body?.cancel().catch(() => undefined);
    throw new ItchError("mudou", "O arquivo no itch.io mudou de tamanho durante a importação. Comece de novo.");
  }
  const body = new Uint8Array(await res.arrayBuffer());
  if (body.byteLength !== end - start + 1) throw new ItchError("indisponivel", "O download do itch.io veio incompleto. Tente de novo.");
  return body;
}

import "server-only";

/*
 * Cliente da API de decisões do OpenRouter (POST /api/alpha/decisions).
 * A chave vem do ambiente (OPENROUTER_API_KEY). Sem ela, nada é julgado: as
 * denúncias esperam na fila e a publicação segue sem triagem.
 */

const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
const TIMEOUT_MS = 45_000;

/** Item do `state`: texto puro, ou uma imagem como data URL (os modelos não buscam links). */
export type StateItem = string | { type: "image_url"; image_url: { url: string } };

export const hasDecisionKey = () => Boolean(process.env.OPENROUTER_API_KEY);

export interface ModelReply {
  model: string;
  answers: unknown;
  cost: number | null;
}

type ImagePart = Exclude<StateItem, string>;
const isImage = (x: StateItem): x is ImagePart => typeof x !== "string";

/**
 * Pergunta a um modelo. Devolve null em qualquer falha (o quórum cuida do resto).
 * Cada modelo tem limites próprios de imagem (Jev só lê PNG e JPEG; alguns
 * pedem pelo menos 280 px de lado): se recusar o pedido com imagens, vai de
 * novo só com o texto, para não perder o voto.
 */
export async function askModel(model: string, state: StateItem[], questions: object): Promise<ModelReply | null> {
  const own = model.startsWith("typesafe/")
    ? state.filter((x) => !isImage(x) || !x.image_url.url.startsWith("data:image/webp"))
    : state;
  const first = await post(model, own, questions);
  if (first !== "recusado" || !own.some(isImage)) return first === "recusado" ? null : first;
  const retry = await post(model, own.filter((x) => !isImage(x)), questions);
  return retry === "recusado" ? null : retry;
}

async function post(model: string, state: StateItem[], questions: object): Promise<ModelReply | null | "recusado"> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Portal dos Games",
      },
      body: JSON.stringify({ model, state, questions }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[moderacao] ${model} respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return res.status === 400 ? "recusado" : null;
    }
    const body = (await res.json()) as { answers?: unknown; model?: string; usage?: { cost?: number } };
    return { model: body.model ?? model, answers: body.answers, cost: Number(body.usage?.cost ?? NaN) || null };
  } catch (err) {
    console.error(`[moderacao] ${model} falhou`, err);
    return null;
  }
}

/** Todos os modelos em paralelo. */
export function askAll(models: readonly string[], state: StateItem[], questions: object) {
  return Promise.all(models.map((m) => askModel(m, state, questions)));
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_MAX = 3 * 1024 * 1024;

/** Baixa uma imagem pública (capa, captura) e devolve o item de `state`, ou null. */
export async function imageItem(url: string): Promise<StateItem | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!res.ok || !IMAGE_TYPES.has(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > IMAGE_MAX) return null;
    return { type: "image_url", image_url: { url: `data:${type};base64,${bytes.toString("base64")}` } };
  } catch {
    return null;
  }
}

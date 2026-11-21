/*
 * Cliente do OpenRouter para a moderação: a API de decisões
 * (POST /api/alpha/decisions), que os juízes usam, e a de chat
 * (POST /api/v1/chat/completions), que o relator usa para o parecer e a
 * fundamentação. Recebe a chave por parâmetro, sem ler o ambiente: o servidor
 * passa OPENROUTER_API_KEY, e o script de calibração passa a dele.
 */

const DECISIONS = "https://openrouter.ai/api/alpha/decisions";
const CHAT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 45_000;

/** Item do `state`: texto puro, ou uma imagem como data URL (os modelos não buscam links). */
export type StateItem = string | { type: "image_url"; image_url: { url: string } };

export interface ModelReply {
  model: string;
  answers: unknown;
  cost: number | null;
}

type ImagePart = Exclude<StateItem, string>;
const isImage = (x: StateItem): x is ImagePart => typeof x !== "string";
const headers = (key: string) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Portal dos Games" });
const costOf = (usage: { cost?: number } | undefined) => Number(usage?.cost ?? NaN) || null;

/**
 * Pergunta a um modelo de decisão. Devolve null em qualquer falha (o quórum
 * cuida do resto). Cada modelo tem limites próprios de imagem (Jev só lê PNG
 * e JPEG; alguns pedem pelo menos 280 px de lado): se recusar o pedido com
 * imagens, vai de novo só com o texto, para não perder o voto.
 */
export async function askModel(key: string, model: string, state: StateItem[], questions: object): Promise<ModelReply | null> {
  const own = model.startsWith("typesafe/")
    ? state.filter((x) => !isImage(x) || !x.image_url.url.startsWith("data:image/webp"))
    : state;
  const first = await post(key, model, own, questions);
  if (first !== "recusado" || !own.some(isImage)) return first === "recusado" ? null : first;
  const retry = await post(key, model, own.filter((x) => !isImage(x)), questions);
  return retry === "recusado" ? null : retry;
}

async function post(key: string, model: string, state: StateItem[], questions: object): Promise<ModelReply | null | "recusado"> {
  try {
    const res = await fetch(DECISIONS, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({ model, state, questions }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[moderacao] ${model} respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return res.status === 400 ? "recusado" : null;
    }
    const body = (await res.json()) as { answers?: unknown; model?: string; usage?: { cost?: number } };
    return { model: body.model ?? model, answers: body.answers, cost: costOf(body.usage) };
  } catch (err) {
    console.error(`[moderacao] ${model} falhou`, err);
    return null;
  }
}

/** Todos os modelos em paralelo. */
export function askAll(key: string, models: readonly string[], state: StateItem[], questions: object) {
  return Promise.all(models.map((m) => askModel(key, m, state, questions)));
}

/** Uma resposta de texto do relator; null em qualquer falha. */
export async function chat(
  key: string,
  model: string,
  system: string,
  user: string,
  maxTokens = 700,
): Promise<{ text: string; cost: number | null } | null> {
  try {
    const res = await fetch(CHAT, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[moderacao] relator ${model} respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { cost?: number } };
    const text = body.choices?.[0]?.message?.content?.trim();
    return text ? { text, cost: costOf(body.usage) } : null;
  } catch (err) {
    console.error(`[moderacao] relator ${model} falhou`, err);
    return null;
  }
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

import "server-only";
import type { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth/session";
import { storageConfigured } from "@/lib/storage/s3";
import { BuildError } from "./server";

/*
 * Moldura comum das rotas /api/builds: sessão obrigatória, mesma origem nos
 * pedidos que mudam algo, JSON com tamanho máximo, erros com mensagem em
 * português e nada em cache.
 *
 * Rotas de API não têm a checagem de origem automática das Server Actions;
 * por isso a conferência do cabeçalho Origin aqui. O cookie de sessão é
 * SameSite=Lax (não vai em POST de outro site) e o corpo é JSON, que exige
 * preflight CORS: são três barreiras contra CSRF.
 */

const HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const MAX_BODY = 4 * 1024 * 1024;

export const fail = (status: number, error: string, extra?: Record<string, unknown>) =>
  Response.json({ error, ...(extra ?? {}) }, { status, headers: HEADERS });
export const ok = (data: unknown) => Response.json(data, { headers: HEADERS });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(request: Request): Promise<unknown> {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) throw new BuildError(415, "Mande JSON.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) throw new BuildError(413, "Pedido grande demais.");
  const text = await request.text();
  if (text.length > MAX_BODY) throw new BuildError(413, "Pedido grande demais.");
  try {
    return JSON.parse(text);
  } catch {
    throw new BuildError(400, "JSON inválido.");
  }
}

export async function handle(request: Request, tag: string, fn: (userId: ObjectId) => Promise<Response>): Promise<Response> {
  if (request.method !== "GET" && !sameOrigin(request)) return fail(403, "Origem não permitida.");
  if (!storageConfigured()) return fail(503, "O armazenamento de arquivos ainda não está configurado neste servidor.");
  try {
    const session = await getSession();
    if (!session) return fail(401, "Sua sessão terminou. Entre de novo para enviar o build.");
    return await fn(session.user._id);
  } catch (err) {
    if (err instanceof BuildError) return fail(err.status, err.message, err.extra);
    console.error(`[builds/${tag}]`, err);
    return fail(503, "O armazenamento não respondeu. Tente de novo em instantes.");
  }
}

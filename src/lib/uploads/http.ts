import "server-only";
import type { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth/session";
import { S3Error } from "@/lib/storage/s3";
import { UploadError } from "./server";

/*
 * Rotas JSON pequenas do envio (route handlers, não Server Actions: o Next
 * enfileira Server Actions uma por vez no navegador, e o envio paralelo de
 * vários arquivos precisa assinar partes ao mesmo tempo).
 *
 * Proteções de cada rota que muda estado:
 * - sessão obrigatória (cookie SameSite=Lax: não vai em POST de outro site);
 * - Origin/Sec-Fetch-Site conferidos (mesma origem);
 * - corpo só application/json (outro site não manda isso sem preflight CORS,
 *   que o Next não libera) e de até 8 KB.
 */

export const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const MAX_BODY = 8 * 1024;

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}

export function fail(status: number, code: string, error: string) {
  return json({ ok: false, code, error }, status);
}

function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return null;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type Handler = (ctx: { userId: ObjectId; body: Record<string, unknown> }) => Promise<unknown>;

/** Envolve uma rota: confere origem, sessão e corpo; traduz erros em JSON. */
export async function handle(req: Request, fn: Handler, opts: { mutates: boolean; body?: boolean } = { mutates: true }) {
  if (opts.mutates && !sameOrigin(req)) return fail(403, "origem", "Pedido de outra origem recusado.");
  let body: Record<string, unknown> = {};
  if (opts.body) {
    const parsed = await readBody(req);
    if (!parsed) return fail(400, "corpo", "Pedido inválido.");
    body = parsed;
  }
  try {
    const session = await getSession();
    if (!session) return fail(401, "sessao", "Sua sessão terminou. Entre de novo; o envio continua de onde parou.");
    const data = await fn({ userId: session.user._id, body });
    return json({ ok: true, ...(data as object) });
  } catch (err) {
    if (err instanceof UploadError) return fail(err.status, err.code, err.message);
    if (err instanceof S3Error) {
      console.error("[envios] MinIO", err.message);
      return fail(502, "armazenamento", "O armazenamento não respondeu como esperado. Tente de novo em instantes.");
    }
    console.error("[envios]", err);
    return fail(503, "servidor", "Não conseguimos falar com o servidor agora. Tente de novo em instantes.");
  }
}

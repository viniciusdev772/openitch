import { getSession } from "@/lib/auth/session";
import { hit } from "@/lib/auth/ratelimit";
import { requestInfo } from "@/lib/auth/request";
import { threadFor } from "@/lib/comments/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/comentarios?jogo=<slug>[&antes=<id>]: comentários, respostas e
 * curtidas de um jogo publicado. Aberto a todos; com sessão, diz também o que
 * a conta curtiu e o que é dela. Nunca vai para cache (muda por conta).
 */
const HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const l = await hit(`comentarios:ip:${(await requestInfo()).ip}`, 300, 10 * 60 * 1000);
    if (!l.allowed) return Response.json({ error: "Muitos pedidos seguidos." }, { status: 429, headers: HEADERS });
    const session = await getSession();
    const thread = await threadFor(params.get("jogo"), session?.user ?? null, params.get("antes"));
    if (!thread) return Response.json({ error: "Este jogo não está no programa." }, { status: 404, headers: HEADERS });
    return Response.json(thread, { headers: HEADERS });
  } catch (err) {
    console.error("[comentarios]", err);
    return Response.json({ error: "Os comentários estão fora do ar agora." }, { status: 503, headers: HEADERS });
  }
}

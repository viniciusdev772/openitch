import { hit } from "@/lib/auth/ratelimit";
import { processPending } from "@/lib/moderation/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Julga a fila de denúncias na hora (o normal é a própria denúncia disparar o
 * julgamento). Aberto: só adianta o que já está na fila, com limite global.
 */
export async function GET() {
  const limit = await hit("moderacao:fila", 20, 60 * 60 * 1000);
  if (!limit.allowed) return Response.json({ ok: false, error: "limite" }, { status: 429 });
  await processPending(10);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

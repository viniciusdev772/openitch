import { hit } from "@/lib/auth/ratelimit";
import { processPending } from "@/lib/moderation/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Julga a fila de denúncias. Chamado pelo cron da Vercel (vercel.json) como
 * reserva, caso o julgamento disparado pela própria denúncia não tenha rodado.
 * Aberto: só adianta o que já está na fila, e há um limite global de chamadas.
 */
export async function GET() {
  const limit = await hit("moderacao:fila", 20, 60 * 60 * 1000);
  if (!limit.allowed) return Response.json({ ok: false, error: "limite" }, { status: 429 });
  await processPending(10);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

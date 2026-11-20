import { getSession } from "@/lib/auth/session";
import { webZipChunk } from "@/lib/itch/files";
import { UploadError } from "@/lib/uploads/server";
import { NO_STORE, fail } from "@/lib/uploads/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/itch/web?projeto=<id>&upload=<id do itch>&n=<pedaço>: 4 MiB do zip da versão de navegador. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const session = await getSession().catch(() => null);
  if (!session) return fail(401, "sessao", "Sua sessão terminou. Entre de novo.");
  try {
    const r = await webZipChunk(session.user._id, q.get("projeto"), q.get("upload"), q.get("n"));
    return new Response(Buffer.from(r.bytes), {
      headers: { ...NO_STORE, "content-type": "application/octet-stream", "x-total-size": String(r.size) },
    });
  } catch (err) {
    if (err instanceof UploadError) return fail(err.status, err.code, err.message);
    console.error("[itch] web", err);
    return fail(503, "servidor", "Não conseguimos falar com o servidor agora. Tente de novo em instantes.");
  }
}

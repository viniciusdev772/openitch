import { getSession } from "@/lib/auth/session";
import { downloadUrlFor, UploadError } from "@/lib/uploads/server";

export const dynamic = "force-dynamic";

/**
 * GET /baixar/<uploadId>: redireciona (302) para uma URL curta do MinIO. Os
 * bytes nunca passam pela Vercel. Quem pode baixar é decidido em canView
 * (o dono do rascunho, ou qualquer pessoa se o jogo está publicado). Sem permissão, id forjado ou arquivo
 * inexistente: a mesma resposta 404.
 */
const HEADERS = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Cookie" };

function text(status: number, body: string) {
  return new Response(body, { status, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(req: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  try {
    const session = await getSession();
    const url = await downloadUrlFor(session?.user ?? null, uploadId);
    if (!url) return text(404, "Arquivo não encontrado.");
    // ?url=1: a URL em JSON, para o navegador baixar com fetch (o jogador de .exe).
    // Seguir o 302 com fetch não serve: depois do redirecionamento a origem vira "null" e o CORS do MinIO recusa.
    if (new URL(req.url).searchParams.get("url") === "1") return Response.json({ url }, { headers: HEADERS });
    return new Response(null, { status: 302, headers: { ...HEADERS, Location: url } });
  } catch (err) {
    if (err instanceof UploadError && err.status === 429) return text(429, err.message);
    console.error("[baixar]", err);
    return text(503, "O download está fora do ar agora. Tente de novo em instantes.");
  }
}

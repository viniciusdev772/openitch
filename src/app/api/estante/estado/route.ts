import { getSession } from "@/lib/auth/session";
import { catalogSlug, hasItem } from "@/lib/library/rules";

export const dynamic = "force-dynamic";

/**
 * Estado dos botões Guardar / Seguir de uma página estática, numa só ida:
 * GET /api/estante/estado?jogo=<slug>&criador=<slug> (um ou os dois).
 *
 * - Exige sessão (401 sem ela). A consulta é sempre filtrada pela conta da
 *   sessão: não existe parâmetro de usuário, então não há como perguntar
 *   pela estante de outra pessoa.
 * - Cada slug passa pelas mesmas regras das Server Actions (formato e
 *   existência no catálogo). Slug forjado, repetido ou ausente: 400, antes
 *   de qualquer consulta ao banco.
 * - Nunca vai para cache: a resposta muda por conta e a cada clique.
 */
const HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: HEADERS });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const jogoRaw = params.getAll("jogo");
  const criadorRaw = params.getAll("criador");
  if (jogoRaw.length > 1 || criadorRaw.length > 1) return fail(400, "Um jogo e um criador por pedido.");
  if (jogoRaw.length === 0 && criadorRaw.length === 0) return fail(400, "Diga qual jogo ou criador.");

  try {
    const jogo = jogoRaw.length ? await catalogSlug("save", jogoRaw[0]) : null;
    const criador = criadorRaw.length ? await catalogSlug("follow", criadorRaw[0]) : null;
    if ((jogoRaw.length && !jogo) || (criadorRaw.length && !criador)) {
      return fail(400, "Esse item não está no catálogo.");
    }

    const session = await getSession();
    if (!session) return fail(401, "Entre na sua conta.");
    const userId = session.user._id;
    const [guardado, seguindo] = await Promise.all([
      jogo ? hasItem("save", userId, jogo) : null,
      criador ? hasItem("follow", userId, criador) : null,
    ]);
    return Response.json(
      {
        jogo: jogo ? { slug: jogo, guardado } : null,
        criador: criador ? { slug: criador, seguindo } : null,
      },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("[estante/estado]", err);
    return fail(503, "A estante está fora do ar agora.");
  }
}

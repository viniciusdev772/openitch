import { db } from "@/lib/auth/db";
import { getSession, readSuspended, toObjectId } from "@/lib/auth/session";
import { decisionPdf, pdfDataOf } from "@/lib/moderation/pdf";

export const dynamic = "force-dynamic";

/**
 * A decisão do tribunal em PDF. Só para a pessoa dona do conteúdo julgado:
 * com sessão, ou com o cookie da página de conta suspensa.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const _id = toObjectId(id);
  if (!_id) return new Response("Decisão não encontrada.", { status: 404 });
  const [session, suspended] = await Promise.all([getSession().catch(() => null), readSuspended()]);
  const viewer = session?.user._id ?? suspended;
  if (!viewer) return new Response("Entre na sua conta para baixar a decisão.", { status: 401 });

  const { moderation, projects, users } = await db();
  const d = await moderation.findOne({ _id, ownerId: viewer });
  if (!d) return new Response("Decisão não encontrada.", { status: 404 });

  const [kind, raw] = d.targetKey.split(":");
  const targetId = toObjectId(raw ?? "");
  let target = kind === "jogo" ? "Jogo (excluído)" : "Perfil de criador";
  if (targetId && kind === "jogo") {
    const p = await projects.findOne({ _id: targetId }, { projection: { title: 1 } });
    if (p) target = `Jogo "${p.title}"`;
  } else if (targetId) {
    const u = await users.findOne({ _id: targetId }, { projection: { name: 1 } });
    if (u) target = `Perfil de criador "${u.name}"`;
  }

  // O logotipo mora em public/; na Vercel ele não está no disco da função, então vem pela própria origem.
  const logo = await fetch(new URL("/marca/logo.png", req.url))
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? new Uint8Array(b) : null))
    .catch(() => null);

  const data = pdfDataOf(d, target, d.appealText);
  const pdf = await decisionPdf(data, logo);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="decisao-${data.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

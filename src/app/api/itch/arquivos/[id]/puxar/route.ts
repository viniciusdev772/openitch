import { handle } from "@/lib/uploads/http";
import { pullItchParts } from "@/lib/itch/files";

export const dynamic = "force-dynamic";
// Cada pedido copia até 4 partes do itch para o MinIO.
export const maxDuration = 120;

/** POST /api/itch/arquivos/<id>/puxar { parts: [n] }: o servidor copia essas partes do itch.io. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ({ userId, body }) => pullItchParts(userId, id, body), { mutates: true, body: true });
}

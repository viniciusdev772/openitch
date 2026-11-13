import { handle } from "@/lib/uploads/http";
import { signParts } from "@/lib/uploads/server";

export const dynamic = "force-dynamic";

/** POST /api/envios/<id>/partes { parts: [{ n, sha256? }] }: URLs de um lote de partes. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ({ userId, body }) => signParts(userId, id, body), { mutates: true, body: true });
}

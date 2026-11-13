import { handle } from "@/lib/uploads/http";
import { completeUpload } from "@/lib/uploads/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/envios/<id>/concluir: o servidor confere as partes no MinIO,
 * conclui e confere o tamanho final. Responde { missing: [n...] } se faltar parte.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ({ userId }) => completeUpload(userId, id), { mutates: true, body: true });
}

import { handle } from "@/lib/uploads/http";
import { removeUpload, uploadState } from "@/lib/uploads/server";

export const dynamic = "force-dynamic";

/** GET /api/envios/<id>: estado e partes já recebidas pelo MinIO (para retomar). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ({ userId }) => uploadState(userId, id), { mutates: false });
}

/** DELETE /api/envios/<id>: cancela um envio aberto ou exclui um arquivo pronto. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ({ userId }) => removeUpload(userId, id), { mutates: true, body: true });
}

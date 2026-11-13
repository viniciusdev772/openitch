import { handle } from "@/lib/uploads/http";
import { listFiles, startUpload } from "@/lib/uploads/server";

export const dynamic = "force-dynamic";

/** GET /api/envios?projeto=<id>: arquivos do rascunho e espaço usado pela conta. */
export async function GET(req: Request) {
  const projeto = new URL(req.url).searchParams.get("projeto");
  return handle(req, ({ userId }) => listFiles(userId, projeto), { mutates: false });
}

/** POST /api/envios: começa (ou retoma) o envio de um arquivo. */
export async function POST(req: Request) {
  return handle(req, ({ userId, body }) => startUpload(userId, body), { mutates: true, body: true });
}

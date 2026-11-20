import { handle } from "@/lib/uploads/http";
import { listItchFiles, startItchFile } from "@/lib/itch/files";

export const dynamic = "force-dynamic";

/** GET /api/itch/arquivos?projeto=<id>: arquivos do jogo no itch.io e o que já foi trazido. */
export async function GET(req: Request) {
  const projeto = new URL(req.url).searchParams.get("projeto");
  return handle(req, ({ userId }) => listItchFiles(userId, projeto), { mutates: false });
}

/** POST /api/itch/arquivos { projectId, itchUploadId, platform? }: começa (ou retoma) a cópia de um download. */
export async function POST(req: Request) {
  return handle(req, ({ userId, body }) => startItchFile(userId, body), { mutates: true, body: true });
}

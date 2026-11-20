import { handle } from "@/lib/uploads/http";
import { importItchWeb } from "@/lib/itch/web";

export const dynamic = "force-dynamic";
// Segue as referências do build no itch e grava tudo no armazenamento numa só chamada.
export const maxDuration = 300;

/** POST /api/itch/web { projectId }: traz a versão de navegador do jogo no itch.io como build daqui. */
export async function POST(req: Request) {
  return handle(req, ({ userId, body }) => importItchWeb(userId, body), { mutates: true, body: true });
}

import { startMultipart } from "@/lib/builds/server";
import { handle, ok, readJson } from "@/lib/builds/http";

export const dynamic = "force-dynamic";

/** POST /api/builds/<id>/partes { caminho }: abre ou retoma o envio em partes de um arquivo grande. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(request, "partes", async (userId) => {
    const body = (await readJson(request)) as { caminho?: unknown } | null;
    return ok(await startMultipart(userId, id, body?.caminho));
  });
}

import { completeFileMultipart } from "@/lib/builds/server";
import { handle, ok, readJson } from "@/lib/builds/http";

export const dynamic = "force-dynamic";

/** POST /api/builds/<id>/partes/concluir { caminho }: junta as partes (ETags lidas do próprio MinIO). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(request, "partes-concluir", async (userId) => {
    const body = (await readJson(request)) as { caminho?: unknown } | null;
    return ok(await completeFileMultipart(userId, id, body?.caminho));
  });
}

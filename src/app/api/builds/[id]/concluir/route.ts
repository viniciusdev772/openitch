import { finishBuild } from "@/lib/builds/server";
import { handle, ok } from "@/lib/builds/http";

export const dynamic = "force-dynamic";

/** POST /api/builds/<id>/concluir: confere no MinIO (ListObjects) que tudo chegou com o tamanho certo e marca pronto. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(request, "concluir", async (userId) => ok({ build: await finishBuild(userId, id) }));
}

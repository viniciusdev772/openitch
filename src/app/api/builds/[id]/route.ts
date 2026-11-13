import { deleteBuild } from "@/lib/builds/server";
import { handle, ok } from "@/lib/builds/http";

export const dynamic = "force-dynamic";

/** DELETE /api/builds/<id>: cancela um envio ou exclui um build (objetos e registro). */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(request, "excluir", async (userId) => ok(await deleteBuild(userId, id)));
}

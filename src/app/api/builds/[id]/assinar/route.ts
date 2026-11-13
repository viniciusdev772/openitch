import { signFiles } from "@/lib/builds/server";
import { handle, ok, readJson } from "@/lib/builds/http";

export const dynamic = "force-dynamic";

/** POST /api/builds/<id>/assinar { arquivos: string[] }: URLs de PUT com cabeçalhos assinados. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(request, "assinar", async (userId) => {
    const body = (await readJson(request)) as { arquivos?: unknown } | null;
    return ok({ urls: await signFiles(userId, id, body?.arquivos) });
  });
}

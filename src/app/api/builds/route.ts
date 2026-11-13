import { toObjectId } from "@/lib/auth/session";
import { createBuild, listBuilds, parseCreate } from "@/lib/builds/server";
import { fail, handle, ok, readJson } from "@/lib/builds/http";

export const dynamic = "force-dynamic";

/** GET /api/builds?projeto=<id>: builds de navegador de um rascunho do usuário. */
export function GET(request: Request) {
  return handle(request, "listar", async (userId) => {
    const projectId = toObjectId(new URL(request.url).searchParams.get("projeto") ?? "");
    if (!projectId) return fail(400, "Diga qual rascunho.");
    return ok({ builds: await listBuilds(userId, projectId) });
  });
}

/**
 * POST /api/builds: declara um build (lista de caminhos e tamanhos), confere
 * cota e limites e devolve o id público. Os bytes vão depois, direto para o MinIO.
 */
export function POST(request: Request) {
  return handle(request, "criar", async (userId) => {
    const input = parseCreate(await readJson(request));
    return ok(await createBuild(userId, input));
  });
}

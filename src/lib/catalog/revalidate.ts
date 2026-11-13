import "server-only";
import type { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/auth/db";

/**
 * Refaz as páginas do programa (início, catálogo, jogo, criador, etiquetas,
 * jams) depois de publicar, editar um jogo publicado ou tirar do ar. Sem isso
 * elas se atualizam sozinhas em até um minuto (revalidate).
 */
export function revalidatePublic() {
  revalidatePath("/", "layout");
}

/** Refaz as páginas do programa só se este projeto está no ar (troca de arquivos, de capa). */
export async function revalidateIfLive(projectId: ObjectId) {
  const { projects } = await db();
  const live = await projects.findOne({ _id: projectId, status: "publicado" }, { projection: { _id: 1 } });
  if (live) revalidatePublic();
}

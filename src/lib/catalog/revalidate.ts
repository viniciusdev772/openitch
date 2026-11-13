import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Refaz as páginas do programa (início, catálogo, jogo, criador, etiquetas,
 * jams) depois de publicar, editar um jogo publicado ou tirar do ar. Sem isso
 * elas se atualizam sozinhas em até um minuto (revalidate).
 */
export function revalidatePublic() {
  revalidatePath("/", "layout");
}

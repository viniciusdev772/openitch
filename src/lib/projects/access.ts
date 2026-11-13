import "server-only";
import type { ObjectId } from "mongodb";
import type { ProjectDoc } from "@/lib/auth/db";

/*
 * Quem pode ver os arquivos de um projeto (baixar, abrir o jogável).
 * Ponto único de decisão: o dono vê sempre (prévia do rascunho); um projeto
 * publicado abre para todos, com ou sem conta.
 */

type Viewer = { _id: ObjectId } | null | undefined;

export function canView(viewer: Viewer, project: Pick<ProjectDoc, "userId" | "status">): boolean {
  if (viewer && project.userId.equals(viewer._id)) return true;
  return project.status === "publicado";
}

/** Só o dono altera arquivos, em qualquer estado do projeto. */
export function canEdit(viewer: Viewer, project: Pick<ProjectDoc, "userId">): boolean {
  return Boolean(viewer && project.userId.equals(viewer._id));
}

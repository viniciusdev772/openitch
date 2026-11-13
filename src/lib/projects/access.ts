import "server-only";
import type { ObjectId } from "mongodb";
import type { ProjectDoc } from "@/lib/auth/db";

/*
 * Quem pode ver os arquivos de um projeto (baixar, abrir o jogável).
 * Ponto único de decisão: hoje só existe rascunho, então só o dono vê (prévia).
 * Quando o catálogo público existir, é aqui que um projeto publicado passa a
 * ser visível para todos, sem mexer nas rotas de download e do jogável.
 */

type Viewer = { _id: ObjectId } | null | undefined;

export function canView(viewer: Viewer, project: Pick<ProjectDoc, "userId" | "status">): boolean {
  if (viewer && project.userId.equals(viewer._id)) return true;
  // Futuro: return project.status === "publicado";
  return false;
}

/** Só o dono altera arquivos, em qualquer estado do projeto. */
export function canEdit(viewer: Viewer, project: Pick<ProjectDoc, "userId">): boolean {
  return Boolean(viewer && project.userId.equals(viewer._id));
}

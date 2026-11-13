import "server-only";
import type { ObjectId } from "mongodb";
import type { ProjectDoc } from "@/lib/auth/db";

/**
 * Quem pode ver (jogar, baixar) os arquivos de um projeto. Ponto ÚNICO de
 * decisão: as rotas de jogar e de baixar chamam só isto.
 *
 * Hoje a publicação no catálogo ainda não existe, então só o dono do
 * rascunho vê (prévia). Quando houver projeto publicado, basta acrescentar
 * aqui a regra (ex.: project.status === "publicado") e tudo passa a valer
 * nas duas rotas ao mesmo tempo.
 */
export function canView(viewer: { _id: ObjectId } | null, project: Pick<ProjectDoc, "userId" | "status"> | null): boolean {
  if (!project) return false;
  if (viewer && project.userId.equals(viewer._id)) return true;
  return false;
}

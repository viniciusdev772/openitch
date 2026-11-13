import "server-only";
import type { ObjectId } from "mongodb";
import { db } from "@/lib/auth/db";
import { storageConfigured } from "@/lib/storage/s3";
import { purge } from "./server";

/*
 * Limpeza dos builds de navegador quando o rascunho ou a conta somem.
 * Chamadas pela exclusão de rascunho (src/lib/projects/actions.ts) e pela
 * exclusão de conta (deleteAccountInner em src/lib/auth/actions.ts).
 *
 * Apagam os objetos sob b/<publicId>/ no bucket jogável (e qualquer envio
 * em partes aberto) e depois os registros. Lançam erro se o armazenamento
 * falhar, para quem chama decidir se continua; os registros de builds cujos
 * objetos não puderam ser apagados ficam, para uma nova tentativa.
 */

async function purgeAll(filter: { userId: ObjectId; projectId?: ObjectId }): Promise<number> {
  const { builds } = await db();
  const docs = await builds.find(filter, { projection: { _id: 1, bucket: 1, prefix: 1 } }).toArray();
  if (docs.length === 0) return 0;
  if (!storageConfigured()) throw new Error("Armazenamento não configurado: não dá para apagar os builds.");
  let failed: unknown = null;
  for (const b of docs) {
    try {
      await purge(b);
    } catch (err) {
      failed = err;
    }
  }
  if (failed) throw failed;
  return docs.length;
}

/** Apaga todos os builds de navegador de um rascunho do usuário. Devolve quantos. */
export function deleteBuildsOfProject(userId: ObjectId, projectId: ObjectId): Promise<number> {
  return purgeAll({ userId, projectId });
}

/** Apaga todos os builds de navegador da conta. Devolve quantos. */
export function deleteBuildsOfUser(userId: ObjectId): Promise<number> {
  return purgeAll({ userId });
}

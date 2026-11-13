import "server-only";
import type { ObjectId } from "mongodb";
import { db } from "@/lib/auth/db";
import { purgePrefix, s3Config, storageConfigured } from "@/lib/storage/s3";

/*
 * STUB da frente "upload": a frente "jogavel" é dona deste arquivo e entrega
 * a versão completa. Aqui só o mínimo para a exclusão de rascunho e de conta
 * já apagarem builds: registros `builds` e objetos `b/<buildId>/` do bucket
 * jogável. Na hora do merge, fica a versão da frente "jogavel" (com estas
 * mesmas assinaturas).
 */

async function purgeBuilds(filter: { userId: ObjectId; projectId?: ObjectId }) {
  const { builds } = await db();
  const list = await builds.find(filter, { projection: { _id: 1, bucket: 1 } }).toArray();
  if (storageConfigured()) {
    const { buckets } = s3Config();
    for (const b of list) await purgePrefix(b.bucket || buckets.play, `b/${b._id.toHexString()}/`);
  }
  await builds.deleteMany(filter);
}

export async function deleteBuildsOfProject(userId: ObjectId, projectId: ObjectId): Promise<void> {
  await purgeBuilds({ userId, projectId });
}

export async function deleteBuildsOfUser(userId: ObjectId): Promise<void> {
  await purgeBuilds({ userId });
}

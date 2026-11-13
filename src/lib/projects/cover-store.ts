import "server-only";
import { randomBytes } from "node:crypto";
import type { ProjectDoc } from "@/lib/auth/db";
import { deleteObject, publicUrl, s3Config, storageConfigured } from "@/lib/storage/s3";

/*
 * Imagem de capa de um jogo. Fica no bucket jogável, sob b/capa-<aleatório>/,
 * que a política do bucket já deixa ler (b/*); o nome aleatório de 128 bits
 * não colide com as pastas dos builds (b/<hex de 32>/). Só PNG, JPEG e WebP:
 * o tipo vai assinado no envio e o servidor confere os primeiros bytes antes
 * de aceitar, para nada que o navegador execute (SVG, HTML) ser servido daqui.
 */

export const COVER_MAX_BYTES = 4 * 1024 * 1024;
export const COVER_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export type CoverType = keyof typeof COVER_TYPES;

export const COVER_KEY_RE = /^b\/capa-[a-f0-9]{32}\/capa\.(png|jpg|webp)$/;

export function newCoverKey(type: CoverType): string {
  return `b/capa-${randomBytes(16).toString("hex")}/capa.${COVER_TYPES[type]}`;
}

export function coverBucket(): string {
  return s3Config().buckets.play;
}

export function coverUrl(key: string): string {
  return publicUrl(coverBucket(), key);
}

/** Os primeiros bytes batem com o tipo declarado? */
export function magicMatches(type: CoverType, head: Uint8Array): boolean {
  const at = (i: number, ...b: number[]) => b.every((x, j) => head[i + j] === x);
  if (type === "image/png") return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (type === "image/jpeg") return at(0, 0xff, 0xd8, 0xff);
  return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50); // RIFF....WEBP
}

/** Apaga o objeto da capa (e da capa pendente) de um projeto. Sem armazenamento, nada a apagar. */
export async function deleteCoverObjects(p: Pick<ProjectDoc, "coverImage"> & { pendingCover?: { key: string } | null }) {
  if (!storageConfigured()) return;
  const keys = [p.coverImage?.key, p.pendingCover?.key].filter((k): k is string => Boolean(k && COVER_KEY_RE.test(k)));
  for (const key of keys) await deleteObject(coverBucket(), key).catch(() => undefined);
}

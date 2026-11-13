import "server-only";
import type { ObjectId } from "mongodb";
import { creatorBySlug, gameBySlug } from "@/data/catalog";
import { db } from "@/lib/auth/db";

/**
 * Regras da estante (jogos guardados e criadores seguidos). Tudo aqui roda só
 * no servidor; as Server Actions ficam em actions.ts.
 */

export type Kind = "save" | "follow";

/** Teto por conta em cada coleção. */
export const MAX_ITEMS = 500;
/** Alternâncias por conta (guardar e seguir somados) a cada janela. */
export const TOGGLES_PER_WINDOW = 60;
export const TOGGLE_WINDOW_MS = 60 * 1000;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Só aceita uma string simples que exista no catálogo. Nada que venha do
 * cliente chega ao banco sem passar por aqui: nem objeto, nem operador.
 */
export function catalogSlug(kind: Kind, raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 64 || !SLUG.test(raw)) return null;
  const found = kind === "save" ? gameBySlug(raw) : creatorBySlug(raw);
  return found ? found.slug : null;
}

/** Página canônica do item, para voltar depois de entrar. */
export function itemPath(kind: Kind, slug: string): string {
  return kind === "save" ? `/jogo/${slug}` : `/criador/${slug}`;
}

/** O item está na estante desta conta? Sempre filtrado pelo dono. */
export async function hasItem(kind: Kind, userId: ObjectId, slug: string): Promise<boolean> {
  const { saves, follows } = await db();
  const found =
    kind === "save"
      ? await saves.findOne({ userId, game: slug }, { projection: { _id: 1 } })
      : await follows.findOne({ userId, creator: slug }, { projection: { _id: 1 } });
  return Boolean(found);
}

export interface ShelfItem {
  slug: string;
  /** ISO 8601 */
  at: string;
}

/** Estante inteira de uma conta, mais recente primeiro. Itens que saíram do catálogo ficam de fora. */
export async function readShelf(userId: ObjectId): Promise<{ saves: ShelfItem[]; follows: ShelfItem[] }> {
  const { saves, follows } = await db();
  const [s, f] = await Promise.all([
    saves.find({ userId }, { projection: { _id: 0, game: 1, at: 1 } }).sort({ at: -1 }).limit(MAX_ITEMS).toArray(),
    follows.find({ userId }, { projection: { _id: 0, creator: 1, at: 1 } }).sort({ at: -1 }).limit(MAX_ITEMS).toArray(),
  ]);
  return {
    saves: s.filter((d) => gameBySlug(d.game)).map((d) => ({ slug: d.game, at: d.at.toISOString() })),
    follows: f.filter((d) => creatorBySlug(d.creator)).map((d) => ({ slug: d.creator, at: d.at.toISOString() })),
  };
}

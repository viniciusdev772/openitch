"use server";

import type { ObjectId } from "mongodb";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/auth/db";
import { getSession } from "@/lib/auth/session";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { str } from "@/lib/auth/validate";
import {
  MAX_ITEMS,
  TOGGLES_PER_WINDOW,
  TOGGLE_WINDOW_MS,
  catalogSlug,
  hasItem,
  itemPath,
  type Kind,
} from "./rules";

/*
 * Guardar jogos e seguir criadores. Cada ação é um endpoint público: confere
 * sozinha quem chama (sessão do cookie, nunca um id vindo do formulário), só
 * toca documentos dessa conta e só aceita slugs que existem no catálogo.
 * O Next recusa POSTs de outra origem e o cookie de sessão é SameSite=Lax.
 *
 * O formulário manda o estado desejado ("quero" = 1 ou 0), não um "inverta":
 * dois cliques que chegam juntos dão o mesmo resultado, sem corrida.
 */

export interface ToggleState {
  on: boolean;
  error?: string;
}

const SERVER_DOWN = "Não conseguimos salvar agora. Tente de novo em instantes.";

const COPY: Record<Kind, { missing: string; full: string }> = {
  save: {
    missing: "Esse jogo não está no catálogo.",
    full: `Sua estante chegou a ${MAX_ITEMS} jogos. Tire algum para guardar este.`,
  },
  follow: {
    missing: "Esse criador não está no catálogo.",
    full: `Você já segue ${MAX_ITEMS} criadores. Deixe de seguir algum para seguir este.`,
  },
};

async function toggle(kind: Kind, form: FormData): Promise<ToggleState> {
  const slug = catalogSlug(kind, str(form, "slug", 80));
  const quero = str(form, "quero", 2);
  if (quero !== "1" && quero !== "0") return { on: false, error: SERVER_DOWN };
  const want = quero === "1";
  if (!slug) return { on: !want, error: COPY[kind].missing };

  let goTo: string | null = null;
  let result: ToggleState;
  try {
    result = await (async (): Promise<ToggleState> => {
      const session = await getSession();
      if (!session) {
        goTo = `/entrar?de=${encodeURIComponent(itemPath(kind, slug))}`;
        return { on: !want };
      }
      const userId = session.user._id;
      const limit = await hit(`estante:${userId.toHexString()}`, TOGGLES_PER_WINDOW, TOGGLE_WINDOW_MS);
      if (!limit.allowed) {
        return {
          on: await hasItem(kind, userId, slug),
          error: `Muitas alterações seguidas. Espere ${waitText(limit.retryAfterMs)}.`,
        };
      }

      const { saves, follows } = await db();
      if (want) {
        let inserted: ObjectId | null = null;
        try {
          const res =
            kind === "save"
              ? await saves.updateOne({ userId, game: slug }, { $setOnInsert: { at: new Date() } }, { upsert: true })
              : await follows.updateOne({ userId, creator: slug }, { $setOnInsert: { at: new Date() } }, { upsert: true });
          inserted = res.upsertedId;
        } catch (err) {
          // Dois pedidos iguais ao mesmo tempo: o índice único segura o segundo.
          if ((err as { code?: number }).code !== 11000) throw err;
        }
        if (inserted) {
          // Conferido depois de gravar, para que pedidos simultâneos não passem do teto.
          const total = kind === "save" ? await saves.countDocuments({ userId }) : await follows.countDocuments({ userId });
          if (total > MAX_ITEMS) {
            if (kind === "save") await saves.deleteOne({ _id: inserted, userId });
            else await follows.deleteOne({ _id: inserted, userId });
            return { on: false, error: COPY[kind].full };
          }
        }
      } else if (kind === "save") {
        await saves.deleteOne({ userId, game: slug });
      } else {
        await follows.deleteOne({ userId, creator: slug });
      }

      // Limpa o cache do navegador: voltar para a página mostra o estado novo.
      revalidatePath(itemPath(kind, slug));
      revalidatePath("/estante");
      return { on: want };
    })();
  } catch (err) {
    unstable_rethrow(err);
    console.error("[estante]", err);
    result = { on: !want, error: SERVER_DOWN };
  }
  if (goTo) redirect(goTo);
  return result;
}

/** Guarda ou tira um jogo da estante de quem está dentro. */
export async function toggleSave(_prev: ToggleState, form: FormData): Promise<ToggleState> {
  return toggle("save", form);
}

/** Segue ou deixa de seguir um criador. */
export async function toggleFollow(_prev: ToggleState, form: FormData): Promise<ToggleState> {
  return toggle("follow", form);
}

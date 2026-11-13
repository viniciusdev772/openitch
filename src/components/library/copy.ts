import { Bookmark, BookmarkCheck, UserCheck, UserPlus } from "lucide-react";

export type LibraryKind = "save" | "follow";

/** Rótulos e ícones de Guardar / Seguir, usados no servidor e no cliente. */
export const LIBRARY_COPY = {
  save: { off: "Guardar", on: "Guardado", Off: Bookmark, On: BookmarkCheck },
  follow: { off: "Seguir", on: "Seguindo", Off: UserPlus, On: UserCheck },
} as const;

/** Página canônica do item (mesma regra de itemPath em lib/library/rules.ts, sem tocar no catálogo). */
export const libraryItemPath = (kind: LibraryKind, slug: string) =>
  kind === "save" ? `/jogo/${slug}` : `/criador/${slug}`;

/**
 * Âncoras para onde o formulário sem JavaScript volta depois de gravar. A
 * página é HTML estático; a nota certa aparece por :target, sem servidor.
 */
export const LIBRARY_FRAGMENT = {
  save: { ok: "estante-guardado", error: "estante-erro-guardar" },
  follow: { ok: "estante-seguindo", error: "estante-erro-seguir" },
} as const;

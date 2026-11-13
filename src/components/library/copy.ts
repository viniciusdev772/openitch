import { Bookmark, BookmarkCheck, UserCheck, UserPlus } from "lucide-react";

export type LibraryKind = "save" | "follow";

/** Rótulos e ícones de Guardar / Seguir, usados no servidor e no cliente. */
export const LIBRARY_COPY = {
  save: { off: "Guardar", on: "Guardado", Off: Bookmark, On: BookmarkCheck },
  follow: { off: "Seguir", on: "Seguindo", Off: UserPlus, On: UserCheck },
} as const;

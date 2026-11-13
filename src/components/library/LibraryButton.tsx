import "server-only";
import "@/styles/estante.css";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { catalogSlug, hasItem, itemPath } from "@/lib/library/rules";
import { LIBRARY_COPY, type LibraryKind } from "./copy";
import { LibraryToggle } from "./LibraryToggle";

interface Props {
  kind: LibraryKind;
  slug: string;
  name?: string;
  small?: boolean;
}

/**
 * Guardar / Seguir com o estado lido no servidor. Visitante sem conta recebe
 * um link para entrar e voltar a esta página; se o banco não responder, o
 * botão aparece desativado com o motivo. Sem Suspense de propósito: o botão
 * chega pronto no HTML e o formulário funciona mesmo sem JavaScript.
 */
export async function LibraryButton({ kind, slug, name, small }: Props) {
  const valid = catalogSlug(kind, slug);
  if (!valid) return null;
  let state: "out" | "down" | boolean;
  try {
    const session = await getSession();
    state = session ? await hasItem(kind, session.user._id, valid) : "out";
  } catch (err) {
    unstable_rethrow(err);
    console.error("[estante]", err);
    state = "down";
  }

  const copy = LIBRARY_COPY[kind];
  const cls = `btn btn--ghost lib-btn${small ? " btn--sm" : ""}`;
  if (state === "out") {
    const back = itemPath(kind, valid);
    return (
      <div className="lib-toggle">
        <Link href={`/entrar?de=${encodeURIComponent(back)}`} className={cls}>
          <copy.Off aria-hidden />
          <span>{copy.off}</span>
          <span className="visually-hidden">
            {name ? `: ${name}` : ""} (entre na sua conta para {kind === "save" ? "guardar" : "seguir"})
          </span>
        </Link>
      </div>
    );
  }
  if (state === "down") {
    return (
      <div className="lib-toggle">
        <button type="button" className={cls} aria-disabled="true" aria-describedby={`lib-down-${kind}-${valid}`}>
          <copy.Off aria-hidden />
          <span>{copy.off}</span>
        </button>
        <p className="lib-note" id={`lib-down-${kind}-${valid}`}>
          A estante está fora do ar agora. Recarregue a página em instantes.
        </p>
      </div>
    );
  }
  return <LibraryToggle kind={kind} slug={valid} initialOn={state} name={name} small={small} />;
}

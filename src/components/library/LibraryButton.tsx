"use client";

import Link from "next/link";
import { keepFollow, keepSave } from "@/lib/library/actions";
import { LIBRARY_COPY, LIBRARY_FRAGMENT, libraryItemPath, type LibraryKind } from "./copy";
import { useLibraryStatus } from "./LibraryState";
import { LibraryToggle } from "./LibraryToggle";

interface Props {
  kind: LibraryKind;
  slug: string;
  /** Nome do jogo ou criador, lido só por leitores de tela. */
  name?: string;
  small?: boolean;
}

/**
 * Guardar / Seguir nas páginas estáticas. Precisa de um <LibraryState> acima.
 *
 * No HTML (e enquanto o estado não chega) o botão é neutro: um formulário que
 * só grava e volta para esta página, então funciona sem JavaScript. Com o
 * estado em mãos vira o botão de alternância de sempre (aria-pressed,
 * pendente, erro); visitante recebe o link para entrar e voltar aqui.
 */
export function LibraryButton({ kind, slug, name, small }: Props) {
  const status = useLibraryStatus(kind, slug);
  const copy = LIBRARY_COPY[kind];
  const cls = `btn btn--ghost lib-btn${small ? " btn--sm" : ""}`;
  const verb = kind === "save" ? "guardar" : "seguir";
  const sr = name ? <span className="visually-hidden">: {name}</span> : null;

  if (typeof status === "boolean") {
    return <LibraryToggle kind={kind} slug={slug} initialOn={status} name={name} small={small} />;
  }

  if (status === "out") {
    return (
      <div className="lib-toggle">
        <Link href={`/entrar?de=${encodeURIComponent(libraryItemPath(kind, slug))}`} className={cls}>
          <copy.Off aria-hidden />
          <span>{copy.off}</span>
          {sr}
          <span className="visually-hidden"> (entre na sua conta para {verb})</span>
        </Link>
      </div>
    );
  }

  if (status === "down") {
    const noteId = `lib-down-${kind}`;
    return (
      <div className="lib-toggle">
        <button type="button" className={cls} aria-disabled="true" aria-describedby={noteId}>
          <copy.Off aria-hidden />
          <span>{copy.off}</span>
          {sr}
        </button>
        <p className="lib-note" id={noteId}>
          A estante está fora do ar agora. Recarregue a página em instantes.
        </p>
      </div>
    );
  }

  const frag = LIBRARY_FRAGMENT[kind];
  return (
    <form action={kind === "save" ? keepSave : keepFollow} className="lib-toggle">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className={cls}
        // Hidratado mas ainda sem resposta: espera o estado real em vez de gravar às cegas.
        onClick={(e) => e.preventDefault()}
      >
        <copy.Off aria-hidden />
        <span>{copy.off}</span>
        {sr}
      </button>
      {/* Só aparecem quando o formulário sem JavaScript volta para cá com a âncora. */}
      <p className="lib-done" id={frag.ok}>
        {kind === "save" ? "Guardado na sua estante." : "Agora você segue. Os jogos novos aparecem na sua estante."}{" "}
        <Link href="/estante">Abrir a estante</Link>
      </p>
      <p className="lib-error lib-done" id={frag.error}>
        Não deu para {verb} agora. Tente de novo em instantes ou confira a sua estante.
      </p>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useId } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { toggleFollow, toggleSave, type ToggleState } from "@/lib/library/actions";
import { LIBRARY_COPY, type LibraryKind } from "./copy";

interface Props {
  kind: LibraryKind;
  slug: string;
  /** Estado lido no servidor. */
  initialOn: boolean;
  /** Nome do jogo ou criador, lido só por leitores de tela quando há vários botões na página. */
  name?: string;
  small?: boolean;
  /** Avisado a cada mudança visível (inclusive a otimista e a reversão em caso de erro). */
  onChange?: (on: boolean) => void;
}

/**
 * Botão de alternância de Guardar / Seguir. É um formulário com Server Action:
 * sem JavaScript ele envia e a página volta com o estado novo; com JavaScript
 * o rótulo muda na hora (useFormStatus) e volta atrás se o servidor recusar.
 */
export function LibraryToggle({ kind, slug, initialOn, name, small, onChange }: Props) {
  const [state, formAction] = useActionState<ToggleState, FormData>(kind === "save" ? toggleSave : toggleFollow, {
    on: initialOn,
  });
  const errId = useId();
  return (
    <form action={formAction} className="lib-toggle">
      <input type="hidden" name="slug" value={slug} />
      <ToggleButton kind={kind} state={state} name={name} small={small} errId={errId} onChange={onChange} />
      {state.error ? (
        <p id={errId} className="lib-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function ToggleButton({
  kind,
  state,
  name,
  small,
  errId,
  onChange,
}: {
  kind: LibraryKind;
  state: ToggleState;
  name?: string;
  small?: boolean;
  errId: string;
  onChange?: (on: boolean) => void;
}) {
  const { pending, data } = useFormStatus();
  // Enquanto o pedido viaja, mostra o estado pedido; depois, o que o servidor confirmou.
  const shown = pending && data ? data.get("quero") === "1" : state.on;
  const copy = LIBRARY_COPY[kind];
  const Icon = pending ? LoaderCircle : shown ? copy.On : copy.Off;

  useEffect(() => {
    onChange?.(shown);
  }, [shown, onChange]);

  return (
    <>
      <input type="hidden" name="quero" value={shown ? "0" : "1"} />
      <button
        type="submit"
        className={`btn btn--ghost lib-btn${small ? " btn--sm" : ""}`}
        aria-pressed={shown}
        aria-describedby={state.error ? errId : undefined}
        data-pending={pending || undefined}
        data-error={state.error ? true : undefined}
        onClick={(e) => {
          // Um pedido por vez: o segundo clique esperaria o primeiro e inverteria de novo.
          if (pending) e.preventDefault();
        }}
      >
        <Icon aria-hidden className={pending ? "bo-spin" : undefined} />
        <span>{shown ? copy.on : copy.off}</span>
        {name ? <span className="visually-hidden">: {name}</span> : null}
      </button>
    </>
  );
}

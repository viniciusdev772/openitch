"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { submitAppeal, type AppealState } from "@/lib/moderation/actions";
import { FormAlert, Submit } from "@/components/auth/Fields";

export function AppealForm() {
  const [state, action] = useActionState<AppealState, FormData>(submitAppeal, undefined);
  const id = useId();
  if (state?.ok) {
    return (
      <div className="bo-sheet">
        <FormAlert ok={state.ok} />
        {state.upheld === false ? (
          <p>
            <Link className="btn" href="/entrar">
              Entrar
            </Link>
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <form action={action} className="bo-sheet" noValidate>
      <FormAlert error={state?.error} />
      <div className="bo-field">
        <label className="field-label" htmlFor={id}>
          Por que a decisão está errada?
        </label>
        <textarea
          id={id}
          name="recurso"
          className="textarea"
          rows={7}
          minLength={20}
          maxLength={2000}
          required
          aria-describedby={`${id}-dica`}
        />
        <p className="field-hint" id={`${id}-dica`}>
          Seja específico: o que os modelos entenderam errado, que contexto faltou, se você tem licença para usar o que foi
          apontado. Só existe um recurso por decisão.
        </p>
      </div>
      <div className="bo-row">
        <span />
        <Submit pendingLabel="Analisando o recurso">Enviar recurso</Submit>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { submitRemovalAppeal, type AppealState } from "@/lib/moderation/actions";
import type { DraftRow } from "@/lib/projects/limits";
import { FormAlert, Submit } from "@/components/auth/Fields";
import { Reasoning } from "@/components/Reasoning";

/** Aviso de jogo tirado do ar pela moderação, com o recurso (um por remoção). */
export function RemovalAppeal({ id, title, moderated }: { id: string; title: string; moderated: NonNullable<DraftRow["moderated"]> }) {
  const [state, action] = useActionState<AppealState, FormData>(submitRemovalAppeal, undefined);
  const uid = useId();
  return (
    <span className="pj-moderated">
      {state?.ok ? null : (
        <>
          <small className="field-error">
            Tirado do ar pela moderação: {moderated.rule} (<Link href="/termos#regras">regras</Link>). Mude o que quebra a
            regra e publique de novo, ou recorra.
          </small>
          <Reasoning text={moderated.reasoning} />
          <small>
            <a href={`/api/moderacao/decisao/${moderated.decisionId}`} target="_blank" rel="noopener">
              Baixar a decisão em PDF
            </a>
            {moderated.appealId ? (
              <>
                {" · "}
                <a href={`/api/moderacao/decisao/${moderated.appealId}`} target="_blank" rel="noopener">
                  a decisão do recurso
                </a>
              </>
            ) : null}
          </small>
        </>
      )}
      {state?.ok ? (
        <>
          <FormAlert ok={state.ok} />
          <Reasoning text={state.reasoning} />
        </>
      ) : moderated.appeal === "mantido" ? (
        <small>O recurso já foi analisado e a remoção foi mantida.</small>
      ) : moderated.appeal === "analisando" ? (
        <small>O recurso está sendo analisado.</small>
      ) : (
        <details className="report">
          <summary>Recorrer da remoção</summary>
          <form action={action} className="report-form">
            <input type="hidden" name="id" value={id} />
            <FormAlert error={state?.error} />
            <label className="field-label" htmlFor={uid}>
              Por que tirar “{title}” do ar foi um erro?
            </label>
            <textarea
              id={uid}
              name="recurso"
              className="textarea"
              rows={5}
              minLength={20}
              maxLength={2000}
              required
              aria-describedby={`${uid}-dica`}
            />
            <small className="field-hint" id={`${uid}-dica`}>
              O plenário (cinco juízes de IA) julga o caso do zero, com o que você escrever. Um recurso por remoção. Se ele for
              aceito, a remoção não conta mais contra a sua conta.
            </small>
            <Submit pendingLabel="Analisando o recurso" className="btn--sm">
              Enviar recurso
            </Submit>
          </form>
        </details>
      )}
    </span>
  );
}

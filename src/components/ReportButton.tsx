"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { reportContent, type ReportState } from "@/lib/moderation/actions";
import { RULES } from "@/lib/moderation/rules";
import { FormAlert, Submit } from "@/components/auth/Fields";

const WHAT = { jogo: ["este jogo", "a página do jogo"], criador: ["este perfil", "o perfil"], comentario: ["", "o comentário"] } as const;

/** Denunciar um jogo, um perfil ou um comentário. O formulário fala com o servidor só ao enviar. */
export function ReportButton({ kind, slug, name }: { kind: "jogo" | "criador" | "comentario"; slug: string; name: string }) {
  const [state, action] = useActionState<ReportState, FormData>(reportContent, undefined);
  const id = useId();
  return (
    <details className={kind === "comentario" ? "report report--inline" : "report"}>
      <summary>
        <Flag aria-hidden /> Denunciar {WHAT[kind][0]}
      </summary>
      {state?.ok ? (
        <FormAlert ok={state.ok} />
      ) : (
        <form action={action} className="report-form">
          <input type="hidden" name="tipo" value={kind} />
          <input type="hidden" name="alvo" value={slug} />
          <p className="report-lead">
            Quem julga é uma análise automática com três modelos de IA, que lê {WHAT[kind][1]} de{" "}
            <strong>{name}</strong>. Veja as <Link href="/termos#regras">regras</Link> e{" "}
            <Link href="/termos#moderacao">como a decisão é tomada</Link>. Não precisa de conta, e quem é denunciado não sabe quem
            denunciou.
          </p>
          <FormAlert error={state?.error} />
          <label className="field-label" htmlFor={`${id}-regra`}>
            Qual regra foi quebrada?
          </label>
          <select id={`${id}-regra`} name="regra" className="input" required defaultValue="">
            <option value="" disabled>
              Escolha uma regra
            </option>
            {RULES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <label className="field-label" htmlFor={`${id}-detalhes`}>
            O que está errado?
          </label>
          <textarea
            id={`${id}-detalhes`}
            name="detalhes"
            className="textarea"
            rows={4}
            minLength={10}
            maxLength={1000}
            required
            placeholder="Onde está o problema: na descrição, na capa, numa imagem, no arquivo…"
          />
          <Submit pendingLabel="Enviando" className="btn--sm">
            Enviar denúncia
          </Submit>
        </form>
      )}
    </details>
  );
}

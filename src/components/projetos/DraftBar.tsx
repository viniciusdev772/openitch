"use client";

import Link from "next/link";
import { Check, LoaderCircle } from "lucide-react";
import { dayKey, formatTime, shortDay } from "@/data/base";
import type { SaveResult } from "@/lib/projects/limits";

type ErrorCode = Extract<SaveResult, { ok: false }>["code"];

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; code: ErrorCode; message: string; fields?: string[] };

/** "às 14:32" hoje; "em 12 nov às 14:32" antes disso. Números no tipo do programa. */
function When({ iso }: { iso: string }) {
  const today = dayKey(iso) === dayKey(new Date());
  return (
    <time dateTime={iso}>
      {today ? "às " : `em ${shortDay(iso)} às `}
      <span className="num">{formatTime(iso)}</span>
    </time>
  );
}

/**
 * Linha do rascunho, sob a prévia: diz se o que está na tela está salvo,
 * salva, e quando algo dá errado diz o que houve e oferece a saída.
 */
export function DraftBar({
  account,
  status,
  dirty,
  saved,
  isNew,
  busy,
  nextPath,
  fieldNames,
  onSave,
  onSaveAsNew,
  onFocusField,
  onLeave,
}: {
  account: "visitante" | "dentro" | "indisponivel";
  status: SaveStatus;
  dirty: boolean;
  saved: string | null;
  isNew: boolean;
  busy: boolean;
  nextPath: string;
  fieldNames: Record<string, string>;
  onSave: () => void;
  onSaveAsNew: () => void;
  onFocusField: (field: string) => void;
  onLeave: () => void;
}) {
  const back = encodeURIComponent(nextPath);

  if (account === "visitante") {
    return (
      <section className="pj-bar pj-bar--guest" aria-label="Salvar rascunho">
        <p className="pj-bar-text">
          <strong>Salvar pede uma conta.</strong> Entre e o que você escreveu vem junto, pronto para virar rascunho.
        </p>
        <div className="pj-bar-act">
          <Link href={`/entrar?de=${back}`} className="btn" onClick={onLeave} data-keeps-draft>
            Entrar para salvar
          </Link>
          <Link href={`/criar-conta?de=${back}`} className="bo-link" onClick={onLeave} data-keeps-draft>
            Criar conta
          </Link>
        </div>
      </section>
    );
  }

  if (account === "indisponivel") {
    return (
      <section className="pj-bar pj-bar--guest" aria-label="Salvar rascunho">
        <p className="bo-alert" role="alert">
          Não conseguimos conferir sua conta agora, então salvar está fora do ar. O formulário continua funcionando;
          recarregue a página em instantes.
        </p>
      </section>
    );
  }

  const saving = status.kind === "saving" || busy;
  const state = saving ? (
    <>
      <LoaderCircle aria-hidden className="bo-spin" />
      Salvando…
    </>
  ) : saved && !dirty ? (
    <>
      <span className="pj-tick" aria-hidden>
        <Check />
      </span>
      <span>
        Rascunho salvo <When iso={saved} />
      </span>
    </>
  ) : saved ? (
    <span>
      <strong>Alterações não salvas.</strong> Última gravação <When iso={saved} />
    </span>
  ) : isNew && !dirty ? (
    <span>Rascunho novo, ainda não salvo.</span>
  ) : (
    <span>
      <strong>Ainda não salvo.</strong>
    </span>
  );

  return (
    <section className="pj-bar" aria-label="Salvar rascunho" data-dirty={(!saving && dirty) || undefined}>
      <p className="pj-state" role="status" aria-live="polite">
        {state}
      </p>

      {status.kind === "error" ? (
        <div className="pj-error" role="alert">
          <p>{status.message}</p>
          {status.code === "campos" && status.fields && status.fields.length > 0 ? (
            <ul className="pj-error-fields">
              {status.fields.map((k) => (
                <li key={k}>
                  <button type="button" className="bo-link" onClick={() => onFocusField(k)}>
                    Ir para {fieldNames[k] ?? k}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {status.code === "servidor" || status.code === "taxa" ? (
            <button type="button" className="btn btn--sm btn--ghost" onClick={onSave} disabled={saving}>
              Tentar de novo
            </button>
          ) : null}
          {status.code === "sessao" ? (
            <Link href={`/entrar?de=${back}`} className="btn btn--sm" onClick={onLeave} data-keeps-draft>
              Entrar de novo
            </Link>
          ) : null}
          {status.code === "limite" ? (
            <Link href="/conta/projetos" className="btn btn--sm btn--ghost">
              Abrir seus rascunhos
            </Link>
          ) : null}
          {status.code === "nao_encontrado" ? (
            <button type="button" className="btn btn--sm btn--ghost" onClick={onSaveAsNew} disabled={saving}>
              Salvar como rascunho novo
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="pj-bar-act">
        {/* aria-disabled e não disabled: o foco do teclado fica no botão enquanto salva. */}
        <button type="submit" className="btn" aria-disabled={saving}>
          {saving ? "Salvando" : "Salvar rascunho"}
        </button>
        <Link href="/conta/projetos" className="bo-link">
          Seus rascunhos
        </Link>
      </div>
      <p className="pj-hint">
        Só você vê seus rascunhos. <kbd>Ctrl</kbd> + <kbd>S</kbd> também salva.
      </p>
    </section>
  );
}

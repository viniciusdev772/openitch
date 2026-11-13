"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { entryNumber } from "@/data/base";
import { useRouter } from "next/navigation";
import { checkPublish, deleteDraft, publishProject, unpublishProject } from "@/lib/projects/actions";
import { FILES_CHANGED } from "@/lib/projects/events";
import {
  publishFieldProblems,
  type DraftFields,
  type PublishField,
  type PublishProblem,
  type PublishResult,
  type PublishState,
} from "@/lib/projects/limits";

type Live = { state: PublishState; slug: string | null; number: number | null };

const OFFLINE = "Sem conexão com o servidor. Nada mudou: tente de novo em instantes.";

/**
 * O último passo da sequência: entrar no programa. Mostra o que falta (o que
 * o formulário sabe na hora, mais os arquivos que o servidor confere), publica
 * o que está salvo e tira do ar. O servidor decide; aqui só se mostra.
 */
export function PublishPanel({
  signedIn,
  draftId,
  fields,
  dirty,
  savedAt,
  initial,
  onFocusField,
  onLiveChange,
  slug,
}: {
  signedIn: boolean;
  draftId: string | null;
  fields: Pick<DraftFields, "title" | "tagline" | "description" | "platforms" | "priceKind">;
  dirty: boolean;
  /** Muda a cada gravação: o painel confere de novo. */
  savedAt: string | null;
  initial: Live;
  onFocusField: (k: PublishField) => void;
  /** O passo fica marcado como feito enquanto o jogo está no ar. */
  onLiveChange?: (live: boolean, slug: string | null) => void;
  /** Endereço atual (muda quando o dono troca o endereço no passo 1). */
  slug?: string | null;
}) {
  const [live, setLive] = useState<Live>(initial);
  const [files, setFiles] = useState<PublishProblem[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLParagraphElement>(null);

  const formProblems: PublishProblem[] = Object.entries(publishFieldProblems(fields)).map(([field, text]) => ({
    field: field as PublishField,
    text,
  }));
  // O formulário manda nos campos (é o que vai ser salvo); o servidor, nos arquivos.
  const problems = [...formProblems, ...(files ?? [])];
  const isLive = live.state === "publicado";

  const check = useCallback(async () => {
    if (!signedIn || !draftId) return;
    const fd = new FormData();
    fd.set("id", draftId);
    setChecking(true);
    try {
      const res = await checkPublish(fd);
      if (res.ok) setFiles([]);
      else if (res.code === "pendencias") setFiles((res.problems ?? []).filter((p) => p.file));
    } catch {
      /* sem rede: a lista do formulário continua valendo; publicar confere de novo */
    } finally {
      setChecking(false);
    }
  }, [signedIn, draftId]);

  // Ao abrir, depois de cada gravação e quando os arquivos mudam (com uma pausa, que envios avisam várias vezes).
  useEffect(() => {
    void check();
  }, [check, savedAt]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      clearTimeout(t);
      t = setTimeout(() => void check(), 400);
    };
    window.addEventListener(FILES_CHANGED, on);
    return () => {
      clearTimeout(t);
      window.removeEventListener(FILES_CHANGED, on);
    };
  }, [check]);

  useEffect(() => {
    if (message) statusRef.current?.focus();
  }, [message]);

  const run = (action: typeof publishProject, done: (r: Extract<PublishResult, { ok: true }>) => string) => {
    if (!draftId || pending) return;
    const fd = new FormData();
    fd.set("id", draftId);
    setMessage(null);
    startTransition(async () => {
      let res: PublishResult;
      try {
        res = await action(fd);
      } catch {
        res = { ok: false, code: "servidor", error: OFFLINE };
      }
      if (res.ok) {
        setLive({ state: res.state, slug: res.slug, number: res.number });
        onLiveChange?.(res.state === "publicado", res.slug);
        setFiles([]);
        setMessage({ ok: true, text: done(res) });
        return;
      }
      if (res.code === "pendencias") setFiles((res.problems ?? []).filter((p) => p.file));
      setMessage({ ok: false, text: res.error });
    });
  };

  const publish = () =>
    run(publishProject, (r) => `Publicado como ${entryNumber(r.number ?? 0)}. A página já está no programa e qualquer pessoa pode abrir.`);
  const takeDown = () =>
    run(unpublishProject, () => "O jogo saiu do programa e voltou a ser rascunho. O endereço e o número continuam reservados para quando ele voltar.");

  if (!signedIn || !draftId) {
    return (
      <div className="pj-publish">
        <p className="pj-publish-line">
          <strong>Ainda não há o que publicar.</strong>{" "}
          {signedIn
            ? "Salve o rascunho e envie os arquivos; depois o jogo entra no programa daqui."
            : "Entre na sua conta e salve o rascunho; depois o jogo entra no programa daqui."}
        </p>
      </div>
    );
  }

  const blocked = dirty || problems.length > 0;
  const current = slug ?? live.slug;
  const href = current ? `/jogo/${current}` : null;

  return (
    <div className="pj-publish" data-live={isLive || undefined}>
      <p className="pj-publish-line">
        {isLive ? (
          <>
            <span className="pj-live" aria-hidden />
            <strong>No programa</strong>
            {live.number ? (
              <>
                {" "}
                como <span className="num">{entryNumber(live.number)}</span>
              </>
            ) : null}
            {". Cada vez que você salva, a página pública muda junto."}
          </>
        ) : (
          <>
            <strong>Rascunho.</strong> Só você vê este jogo até publicar.
          </>
        )}
      </p>

      {problems.length > 0 ? (
        <div className="pj-todo">
          <p className="pj-todo-head">
            {isLive ? "Para a página continuar completa" : "O que falta para publicar"}
            <span className="num">{problems.length}</span>
          </p>
          <ul>
            {problems.map((p) => (
              <li key={p.text}>
                <span>{p.text}</span>
                {p.field ? (
                  <button type="button" className="bo-link" onClick={() => onFocusField(p.field!)}>
                    Ir ao campo
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : files !== null ? (
        <p className="pj-ready">
          <span className="pj-tick" aria-hidden>
            <Check />
          </span>
          {isLive ? "A página está completa." : "Tudo pronto: página completa e arquivos no ar."}
        </p>
      ) : null}

      {dirty ? (
        <p className="pj-hint">
          {isLive
            ? "Há alterações não salvas. Salve para que elas entrem na página pública."
            : "Há alterações não salvas. Salve antes: publicar leva o que está salvo."}
        </p>
      ) : null}

      <div className="pj-publish-act">
        {isLive ? (
          <>
            {href ? (
              <Link href={href} className="btn btn--sm">
                Ver a página publicada <ArrowRight aria-hidden />
              </Link>
            ) : null}
            <button type="button" className="btn btn--sm btn--ghost" onClick={takeDown} aria-disabled={pending}>
              {pending ? <LoaderCircle aria-hidden className="bo-spin" /> : null}
              {pending ? "Tirando do ar" : "Tirar do ar"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn"
              onClick={publish}
              disabled={blocked && !pending}
              aria-disabled={pending || undefined}
              aria-describedby={blocked ? "pj-publish-why" : undefined}
            >
              {pending ? <LoaderCircle aria-hidden className="bo-spin" /> : null}
              {pending ? "Publicando" : "Publicar no programa"}
            </button>
            {checking ? <span className="pj-hint">Conferindo os arquivos…</span> : null}
            {blocked ? (
              <span id="pj-publish-why" className="visually-hidden">
                {dirty ? "Salve as alterações antes." : "Resolva os itens da lista antes."}
              </span>
            ) : null}
          </>
        )}
      </div>

      {message ? (
        <p ref={statusRef} tabIndex={-1} className={message.ok ? "bo-ok pj-notice" : "pj-error"} role={message.ok ? "status" : "alert"}>
          {message.text}{" "}
          {message.ok && isLive && href ? (
            <Link href={href} className="bo-link">
              Abrir {href}
            </Link>
          ) : null}
        </p>
      ) : null}

      <DeleteGame draftId={draftId} live={isLive} />
    </div>
  );
}

/** Excluir de vez, com a confirmação no próprio lugar (sem janela por cima). */
function DeleteGame({ draftId, live }: { draftId: string; live: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const keepRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const was = useRef(false);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (was.current) askRef.current?.focus();
    was.current = confirming;
  }, [confirming]);

  const remove = () => {
    if (pending) return;
    const fd = new FormData();
    fd.set("id", draftId);
    fd.set("confirmar", "excluir");
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteDraft(fd);
        if (res.ok || res.code === "nao_encontrado") {
          router.push("/conta/projetos");
          return;
        }
        setError(res.error);
      } catch {
        setError("Sem conexão com o servidor. Nada foi excluído: tente de novo.");
      }
    });
  };

  return (
    <div className="pj-delete" data-confirm={confirming || undefined}>
      {confirming ? (
        <>
          <p>
            <strong>Excluir este jogo de vez?</strong>{" "}
            {live ? "Ele sai do programa agora, com" : "Vão junto"} os arquivos, os builds e a capa. Não dá para desfazer.
          </p>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="pj-publish-act">
            <button type="button" className="btn btn--sm pj-danger" onClick={remove} aria-disabled={pending}>
              {pending ? <LoaderCircle aria-hidden className="bo-spin" /> : null}
              {pending ? "Excluindo" : "Excluir de vez"}
            </button>
            <button ref={keepRef} type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Manter o jogo
            </button>
          </div>
        </>
      ) : (
        <button ref={askRef} type="button" className="bo-link pj-delete-ask" onClick={() => setConfirming(true)}>
          Excluir este jogo
        </button>
      )}
    </div>
  );
}

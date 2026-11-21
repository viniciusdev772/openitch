"use client";

import { useActionState, useCallback, useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, MessageSquare } from "lucide-react";
import type { CommentView, ThreadView } from "@/lib/comments/server";
import { changeComment, deleteComment, like, sendComment } from "@/lib/comments/actions";
import { COMMENT_MAX, ago } from "@/lib/comments/rules";
import { submitCommentAppeal, type AppealState } from "@/lib/moderation/actions";
import { FormAlert, Submit } from "@/components/auth/Fields";
import { Reasoning } from "@/components/Reasoning";
import { ReportButton } from "@/components/ReportButton";

/*
 * Comentários e curtidas de um jogo publicado, em qualquer página que o mostre
 * (/jogo/<slug>, /jogar/<build>). A página pode ser estática; esta ilha lê
 * /api/comentarios depois de hidratar e fala com o servidor por Server
 * Actions. Curtir muda na hora e desfaz se o servidor recusar. Entrar na
 * conta volta para a página onde a ilha está.
 */

type Load = "loading" | "ready" | "down";

async function fetchThread(slug: string, before?: string): Promise<ThreadView | null> {
  const q = new URLSearchParams({ jogo: slug });
  if (before) q.set("antes", before);
  const r = await fetch(`/api/comentarios?${q}`, { cache: "no-store", credentials: "same-origin" });
  return r.ok ? ((await r.json()) as ThreadView) : null;
}

export function Comments({ slug }: { slug: string }) {
  const login = `/entrar?de=${encodeURIComponent(`${usePathname()}#comentarios`)}`;
  const [data, setData] = useState<ThreadView | null>(null);
  const [status, setStatus] = useState<Load>("loading");
  const [error, setError] = useState<string | null>(null);
  const [older, setOlder] = useState(false);

  const reload = useCallback(async () => {
    const t = await fetchThread(slug).catch(() => null);
    if (t) {
      setData(t);
      setStatus("ready");
    } else setStatus((s) => (s === "ready" ? s : "down"));
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial da ilha
    void reload();
    window.addEventListener("openitch:sessao", reload);
    return () => window.removeEventListener("openitch:sessao", reload);
  }, [reload]);

  /** Depois de uma ação: erro na tela, ou lê o fio de novo. */
  const after = async (res: { ok: true } | { ok: false; error: string }) => {
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    await reload();
    return true;
  };

  const loadOlder = async () => {
    if (!data?.next) return;
    setOlder(true);
    const t = await fetchThread(slug, data.next).catch(() => null);
    setOlder(false);
    if (t) setData({ ...data, comments: [...data.comments, ...t.comments], next: t.next });
  };

  // Curtida otimista: muda já, desfaz se o servidor recusar.
  const toggleLike = async (kind: "jogo" | "comentario", id: string, on: boolean) => {
    const flip = (d: ThreadView): ThreadView =>
      kind === "jogo"
        ? { ...d, game: { ...d.game, liked: on, likes: d.game.likes + (on ? 1 : -1) } }
        : {
            ...d,
            comments: d.comments.map((c) => {
              const f = (x: CommentView): CommentView => (x.id === id ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x);
              return { ...f(c), replies: c.replies.map(f) };
            }),
          };
    setData((d) => (d ? flip(d) : d));
    const res = await like({ tipo: kind, id, curtir: on }).catch(() => ({ ok: false as const, error: "Não conseguimos curtir agora." }));
    if (!res.ok) {
      setError(res.error);
      await reload();
    }
  };

  const signedIn = data?.viewer.signedIn ?? false;

  return (
    <section className="wrap game-comments" id="comentarios" aria-labelledby="comentarios-titulo">
      <header className="cm-head">
        <h2 id="comentarios-titulo">
          Comentários{data ? <span className="num cm-count"> {data.game.comments}</span> : null}
        </h2>
        {data ? (
          signedIn ? (
            <button
              type="button"
              className={`btn btn--sm${data.game.liked ? " btn--lime" : " btn--ghost"}`}
              aria-pressed={data.game.liked}
              onClick={() => toggleLike("jogo", slug, !data.game.liked)}
            >
              <Heart aria-hidden fill={data.game.liked ? "currentColor" : "none"} /> {data.game.liked ? "Curtido" : "Curtir"} ·{" "}
              <span className="num">{data.game.likes}</span>
            </button>
          ) : (
            <Link className="btn btn--sm btn--ghost" href={login}>
              <Heart aria-hidden /> Curtir · <span className="num">{data.game.likes}</span>
            </Link>
          )
        ) : null}
      </header>

      {error ? <FormAlert error={error} /> : null}

      {status === "loading" ? (
        <p className="cm-muted">Carregando os comentários…</p>
      ) : status === "down" || !data ? (
        <p className="cm-muted">Os comentários estão fora do ar agora. Tente recarregar a página.</p>
      ) : (
        <>
          {signedIn ? (
            <CommentForm
              noLinks={data.viewer.noLinks}
              submit={(texto) => sendComment({ jogo: slug, texto }).then(after)}
              label="Seu comentário"
              cta="Comentar"
            />
          ) : (
            <p className="cm-gate">
              <Link href={login}>Entre na sua conta</Link> para comentar e
              curtir. Ler e denunciar não pedem conta.
            </p>
          )}

          {data.comments.length === 0 ? (
            <p className="cm-muted">Ninguém comentou ainda.{signedIn ? " Seja a primeira pessoa." : ""}</p>
          ) : (
            <ol className="cm-list">
              {data.comments.map((c) => (
                <Comment
                  key={c.id}
                  c={c}
                  viewer={data.viewer}
                  login={login}
                  onLike={toggleLike}
                  onDone={after}
                  reply={(texto) => sendComment({ jogo: slug, texto, resposta: c.id }).then(after)}
                >
                  {c.replies.length ? (
                    <ol className="cm-replies">
                      {c.replies.map((r) => (
                        <Comment
                          key={r.id}
                          c={r}
                          viewer={data.viewer}
                          login={login}
                          onLike={toggleLike}
                          onDone={after}
                          reply={(texto) => sendComment({ jogo: slug, texto, resposta: r.id }).then(after)}
                        />
                      ))}
                    </ol>
                  ) : null}
                </Comment>
              ))}
            </ol>
          )}
          {data.next ? (
            <button type="button" className="btn btn--ghost btn--sm cm-older" onClick={loadOlder} disabled={older}>
              {older ? "Carregando…" : "Mostrar comentários mais antigos"}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

const GONE: Record<string, string> = {
  apagado: "Comentário apagado por quem escreveu.",
  oculto: "Comentário ocultado por quem criou o jogo.",
  removido: "Comentário removido pela moderação.",
  indisponivel: "Comentário indisponível.",
};

function Comment({
  c,
  viewer,
  login,
  onLike,
  onDone,
  reply,
  children,
}: {
  c: CommentView;
  viewer: ThreadView["viewer"];
  /** Link para entrar e voltar a esta página. */
  login: string;
  onLike: (kind: "comentario", id: string, on: boolean) => void;
  onDone: (res: { ok: true } | { ok: false; error: string }) => Promise<boolean>;
  reply: (texto: string) => Promise<boolean>;
  children?: React.ReactNode;
}) {
  const [mode, setMode] = useState<"idle" | "reply" | "edit" | "confirm">("idle");
  const [pending, start] = useTransition();

  if (!c.author) {
    return (
      <li className="cm-item cm-item--gone">
        <p className="cm-muted">{GONE[c.state] ?? GONE.indisponivel}</p>
        {children}
      </li>
    );
  }

  const live = c.state === "visivel";
  const remove = () =>
    start(async () => {
      await onDone(await deleteComment({ id: c.id }));
      setMode("idle");
    });

  return (
    <li className={`cm-item${live ? "" : " cm-item--removed"}`} id={`comentario-${c.id}`}>
      <p className="cm-meta">
        {c.author.href ? (
          <Link className="cm-author" href={c.author.href}>
            {c.author.name}
          </Link>
        ) : (
          <strong className="cm-author">{c.author.name}</strong>
        )}
        {c.author.creator ? <span className="cm-badge">criador do jogo</span> : null}
        <time dateTime={c.at} title={new Date(c.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}>
          {ago(c.at)}
        </time>
        {c.edited ? <span className="cm-muted">(editado)</span> : null}
      </p>

      {mode === "edit" ? (
        <CommentForm
          initial={c.body}
          noLinks={viewer.noLinks}
          label="Editar comentário"
          cta="Salvar"
          submit={async (texto) => {
            const ok = await onDone(await changeComment({ id: c.id, texto }));
            if (ok) setMode("idle");
            return ok;
          }}
          cancel={() => setMode("idle")}
        />
      ) : (
        <p className="cm-body">{c.body}</p>
      )}

      {c.moderation ? <Removed c={c} /> : null}

      {live && mode !== "edit" ? (
        <div className="cm-actions">
          {viewer.signedIn ? (
            <button type="button" className="cm-act" aria-pressed={c.liked} onClick={() => onLike("comentario", c.id, !c.liked)}>
              <Heart aria-hidden fill={c.liked ? "currentColor" : "none"} />
              <span className="visually-hidden">{c.liked ? "Descurtir" : "Curtir"}</span>
              <span className="num">{c.likes}</span>
            </button>
          ) : (
            <Link className="cm-act" href={login}>
              <Heart aria-hidden />
              <span className="visually-hidden">Entrar para curtir</span>
              <span className="num">{c.likes}</span>
            </Link>
          )}
          {viewer.signedIn ? (
            <button type="button" className="cm-act" onClick={() => setMode(mode === "reply" ? "idle" : "reply")} aria-expanded={mode === "reply"}>
              <MessageSquare aria-hidden /> Responder
            </button>
          ) : null}
          {c.mine ? (
            <button type="button" className="cm-act" onClick={() => setMode("edit")}>
              Editar
            </button>
          ) : null}
          {c.mine || viewer.owner ? (
            mode === "confirm" ? (
              <>
                <button type="button" className="cm-act cm-act--danger" onClick={remove} disabled={pending}>
                  {pending ? "Apagando…" : c.mine ? "Confirmar: apagar" : "Confirmar: ocultar"}
                </button>
                <button type="button" className="cm-act" onClick={() => setMode("idle")}>
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" className="cm-act" onClick={() => setMode("confirm")}>
                {c.mine ? "Apagar" : "Ocultar"}
              </button>
            )
          ) : null}
          {!c.mine ? <ReportButton kind="comentario" slug={c.id} name={c.author.name} /> : null}
        </div>
      ) : null}

      {mode === "reply" ? (
        <CommentForm
          noLinks={viewer.noLinks}
          label={`Responder a ${c.author.name}`}
          cta="Responder"
          submit={async (texto) => {
            const ok = await reply(texto);
            if (ok) setMode("idle");
            return ok;
          }}
          cancel={() => setMode("idle")}
          autoFocus
        />
      ) : null}
      {children}
    </li>
  );
}

function CommentForm({
  submit,
  label,
  cta,
  initial = "",
  noLinks,
  cancel,
  autoFocus,
}: {
  submit: (texto: string) => Promise<boolean>;
  label: string;
  cta: string;
  initial?: string;
  noLinks: string | null;
  cancel?: () => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form
      className="cm-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (await submit(text)) setText("");
        });
      }}
    >
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="textarea"
        rows={3}
        maxLength={COMMENT_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        autoFocus={autoFocus}
        aria-describedby={`${id}-dica`}
      />
      <small className="field-hint" id={`${id}-dica`}>
        {text.length}/{COMMENT_MAX}. Crítica é bem-vinda; ataque a pessoas, não.{" "}
        <Link href="/termos#regras">Regras</Link>.{noLinks ? ` ${noLinks}` : ""}
      </small>
      <div className="cm-form-row">
        <button type="submit" className="btn btn--sm" disabled={pending || text.trim().length < 2}>
          {pending ? "Enviando…" : cta}
        </button>
        {cancel ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={cancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** O próprio comentário removido pela moderação: motivo, decisão e recurso (só quem escreveu vê). */
function Removed({ c }: { c: CommentView }) {
  const m = c.moderation!;
  const [state, action] = useActionState<AppealState, FormData>(submitCommentAppeal, undefined);
  const id = useId();
  return (
    <div className="cm-removed">
      <p className="field-error">
        Removido pela moderação: {m.rule} (<Link href="/termos#regras">regras</Link>). Só você vê este comentário.
      </p>
      <Reasoning text={m.reasoning} />
      <p className="cm-muted">
        <a href={`/api/moderacao/decisao/${m.decisionId}`} target="_blank" rel="noopener">
          Baixar a decisão em PDF
        </a>
        {m.appealId ? (
          <>
            {" · "}
            <a href={`/api/moderacao/decisao/${m.appealId}`} target="_blank" rel="noopener">
              a decisão do recurso
            </a>
          </>
        ) : null}
      </p>
      {state?.ok ? (
        <>
          <FormAlert ok={state.ok} />
          <Reasoning text={state.reasoning} />
        </>
      ) : m.appeal === "mantido" ? (
        <p className="cm-muted">O recurso já foi analisado e a remoção foi mantida.</p>
      ) : m.appeal === "analisando" ? (
        <p className="cm-muted">O recurso está sendo analisado.</p>
      ) : (
        <details className="report">
          <summary>Recorrer da remoção</summary>
          <form action={action} className="report-form">
            <input type="hidden" name="id" value={c.id} />
            <FormAlert error={state?.error} />
            <label className="field-label" htmlFor={id}>
              Por que remover este comentário foi um erro?
            </label>
            <textarea id={id} name="recurso" className="textarea" rows={4} minLength={20} maxLength={2000} required />
            <small className="field-hint">O plenário (cinco juízes de IA) julga do zero. Um recurso por remoção.</small>
            <Submit pendingLabel="Analisando o recurso" className="btn--sm">
              Enviar recurso
            </Submit>
          </form>
        </details>
      )}
    </div>
  );
}

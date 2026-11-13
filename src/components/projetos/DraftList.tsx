"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { dayParts, formatDay, formatTime, type TrackId } from "@/data/base";
import { TrackChip, trackStyle } from "@/components/bits-base";
import { deleteDraft } from "@/lib/projects/actions";
import type { DeleteResult, DraftRow } from "@/lib/projects/limits";

export interface OpenJam {
  slug: string;
  title: string;
  start: string;
  end: string;
  state: "past" | "live" | "next";
  track: TrackId;
}

const pad = (n: number) => String(n).padStart(2, "0");

const STEPS: [string, string][] = [
  ["O jogo", "Título e uma frase. Só o título já basta para salvar."],
  ["Trilha e capa", "A cor da sua seção no programa e uma capa provisória."],
  ["Plataformas e arquivos", "Onde o jogo roda e o arquivo de cada plataforma."],
  ["Preço", "Por enquanto, só jogos grátis entram no programa."],
  ["A página", "A descrição e detalhes como duração e controles."],
  ["No programa", "Publicado, o jogo ganha número e endereço e abre para todos."],
];

/**
 * Lista pautada dos rascunhos. Excluir transforma a própria linha na
 * confirmação; sem janela por cima. Depois de excluir, o foco vai para o
 * título da lista e a mensagem diz o que saiu.
 */
export function DraftList({
  drafts,
  jamTitles,
  openJams,
  max,
}: {
  drafts: DraftRow[];
  jamTitles: Record<string, string>;
  openJams: OpenJam[];
  max: number;
}) {
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const rows = drafts.filter((d) => !removed.has(d.id));

  const onDeleted = (d: DraftRow) => {
    setRemoved((s) => new Set(s).add(d.id));
    setNotice(`"${d.title}" foi excluído.`);
  };

  useEffect(() => {
    if (notice) headRef.current?.focus();
  }, [notice]);

  if (rows.length === 0) {
    return <FirstUse openJams={openJams} notice={notice} headRef={headRef} />;
  }

  return (
    <section className="acc-section pj-list-section" aria-labelledby="rascunhos">
      <div className="acc-head">
        <h2 id="rascunhos" ref={headRef} tabIndex={-1}>
          Jogos
        </h2>
        <span className="acc-count">
          <span aria-hidden>
            {pad(rows.length)}
            <small>/{max}</small>
          </span>
          <span className="visually-hidden">
            {rows.length} de {max} jogos
          </span>
        </span>
      </div>
      {notice ? (
        <p className="bo-ok pj-notice" role="status">
          {notice}
        </p>
      ) : null}
      {rows.length >= max ? (
        <p className="acc-intro">
          Você chegou ao máximo de {max} rascunhos. Exclua algum para começar outro.
        </p>
      ) : null}
      <div className="pj-cols" aria-hidden>
        <span>Salvo em</span>
        <span>Jogo</span>
        <span>Trilha</span>
        <span>Jam</span>
        <span />
      </div>
      <ol className="pj-list">
        {rows.map((d) => (
          <Row key={d.id} draft={d} jamTitle={d.jam ? jamTitles[d.jam] : undefined} onDeleted={onDeleted} />
        ))}
      </ol>
      {rows.length < max ? (
        <div className="pj-after">
          <Link href="/publicar" className="btn btn--ghost btn--sm">
            Começar outro rascunho
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function Row({ draft, jamTitle, onDeleted }: { draft: DraftRow; jamTitle?: string; onDeleted: (d: DraftRow) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const keepRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const [day, month] = dayParts(draft.updatedAt);
  const href = `/publicar?projeto=${draft.id}`;

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (wasConfirming.current) askRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const remove = () => {
    if (pending) return;
    const fd = new FormData();
    fd.set("id", draft.id);
    fd.set("confirmar", "excluir");
    setError(null);
    startTransition(async () => {
      let res: DeleteResult;
      try {
        res = await deleteDraft(fd);
      } catch {
        res = { ok: false, error: "Sem conexão com o servidor. O rascunho continua salvo; tente de novo." };
      }
      if (res.ok || res.code === "nao_encontrado") {
        // Já não existe (excluído agora ou antes, em outra aba): sai da lista do mesmo jeito.
        onDeleted(draft);
        return;
      }
      setError(res.error);
    });
  };

  return (
    <li style={trackStyle(draft.track)} data-confirm={confirming || undefined}>
      <time className="pj-when" dateTime={draft.updatedAt}>
        <b>{day}</b>
        <small>
          {month} · <span className="num">{formatTime(draft.updatedAt)}</span>
        </small>
      </time>
      <span className="pj-title">
        <Link href={href}>
          <h3>{draft.title}</h3>
        </Link>
        <small>{draft.tagline || "Sem frase de apresentação ainda."}</small>
        {draft.state === "publicado" ? (
          <span className="pj-onair">
            <span className="pj-live" aria-hidden />
            No programa
          </span>
        ) : null}
      </span>
      {confirming ? (
        <div className="pj-confirm" role="group" aria-label={`Confirmar exclusão de ${draft.title}`}>
          <p>
            <strong>Excluir "{draft.title}"?</strong>{" "}
            {draft.state === "publicado" ? "Ele sai do programa junto, com os arquivos. Não dá para desfazer." : "Não dá para desfazer."}
          </p>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="pj-confirm-act">
            <button type="button" className="btn btn--sm pj-danger" onClick={remove} aria-disabled={pending}>
              {pending ? <LoaderCircle aria-hidden className="bo-spin" /> : null}
              {pending ? "Excluindo" : "Excluir de vez"}
            </button>
            <button ref={keepRef} type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirming(false)}>
              Manter o jogo
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className="pj-meta">
            <span className="pj-track">
              <TrackChip id={draft.track} />
            </span>
            <span className="pj-jam">{jamTitle ?? <span className="pj-none">Sem jam</span>}</span>
          </span>
          <span className="pj-act">
            {draft.publicSlug ? (
              <Link href={`/jogo/${draft.publicSlug}`} className="btn btn--sm btn--ghost" aria-label={`Ver a página publicada de ${draft.title}`}>
                Ver
              </Link>
            ) : null}
            <Link href={href} className="btn btn--sm" aria-label={`Abrir ${draft.title}`}>
              Abrir
            </Link>
            <button
              ref={askRef}
              type="button"
              className="btn btn--sm btn--ghost pj-ask"
              onClick={() => setConfirming(true)}
              aria-label={`Excluir ${draft.title}`}
            >
              Excluir
            </button>
          </span>
        </>
      )}
    </li>
  );
}

function FirstUse({
  openJams,
  notice,
  headRef,
}: {
  openJams: OpenJam[];
  notice: string | null;
  headRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="pj-first">
      {notice ? (
        <p className="bo-ok pj-notice" role="status">
          {notice}
        </p>
      ) : null}
      <section className="pj-start" aria-labelledby="sem-rascunhos">
        <div className="pj-start-text">
          <h2 id="sem-rascunhos" ref={headRef} tabIndex={-1}>
            {notice ? "Nenhum rascunho agora" : "Nenhum rascunho ainda"}
          </h2>
          <p className="pj-start-lead">
            Cada jogo que você salvar em Publicar aparece aqui, com a hora da última gravação. Dá para escrever aos
            poucos e continuar de onde parou.
          </p>
          <div className="pj-start-go">
            <Link href="/publicar" className="btn">
              Começar um rascunho <ArrowRight aria-hidden />
            </Link>
            <Link href="/ajuda#publicar" className="bo-link">
              Perguntas sobre publicar
            </Link>
          </div>
        </div>
        <ol className="pj-steps" aria-label="Os passos de Publicar">
          {STEPS.map(([name, text], i) => (
            <li key={name} data-first={i === 0 || undefined}>
              <span className="pj-step-num" aria-hidden>
                {i + 1}
              </span>
              <span>
                <strong>{name}</strong>
                <small>{text}</small>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {openJams.length > 0 ? (
        <section className="acc-section" aria-labelledby="jams-abertas">
          <div className="acc-head">
            <h2 id="jams-abertas">Fazendo um jogo para uma jam?</h2>
          </div>
          <p className="acc-intro">Comece o rascunho com a jam já marcada.</p>
          <ol className="pj-jams">
            {openJams.map((j) => (
              <li key={j.slug} style={trackStyle(j.track)}>
                <span className="pj-title">
                  <Link href={`/publicar?jam=${encodeURIComponent(j.slug)}`}>
                    <h3>{j.title}</h3>
                  </Link>
                  <small>
                    {j.state === "live" ? (
                      <>
                        Aberta até <span className="num">{formatDay(j.end)}</span>
                      </>
                    ) : (
                      <>
                        Abre em <span className="num">{formatDay(j.start)}</span>
                      </>
                    )}
                  </small>
                </span>
                <ArrowRight aria-hidden className="pj-go" />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

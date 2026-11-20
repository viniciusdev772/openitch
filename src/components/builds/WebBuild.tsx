"use client";

import { FILES_CHANGED } from "@/lib/projects/events";

import "@/styles/jogavel.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { FileArchive, FolderOpen, Info, Play, RotateCcw, TriangleAlert, Trash2, X, OctagonX } from "lucide-react";
import { formatBytes } from "@/lib/storage/limits";
import { ENGINE_LABEL, type Notice } from "@/lib/builds/detect";
import {
  analyze,
  BuildUpload,
  IngestError,
  ingestDirectoryInput,
  ingestDrop,
  ingestZip,
  prepareFiles,
  type Analysis,
  type Progress,
  type SourceFile,
} from "@/lib/builds/client";

/*
 * Build de navegador de um rascunho: escolher um .zip ou uma pasta, ver o
 * que foi reconhecido, enviar direto para o armazenamento e testar.
 * Tudo que é pesado roda neste navegador; o servidor só assina e confere.
 */

interface BuildRow {
  id: string;
  motor: keyof typeof ENGINE_LABEL;
  versao: string | null;
  arquivos: number;
  tamanho: number;
  estado: "enviando" | "pronto" | "falhou";
  isolamento: boolean;
  criadoEm: string;
}

type Stage =
  | { kind: "vazio" }
  | { kind: "lendo"; name: string }
  | { kind: "pronto-para-enviar"; analysis: Analysis; name: string }
  | { kind: "enviando"; analysis: Analysis; name: string; progress: Progress }
  | { kind: "erro"; message: string };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function speed(bps: number) {
  if (bps <= 0) return "";
  return `${formatBytes(bps)}/s`;
}

export function WebBuild({ projectId }: { projectId: string }) {
  const zipInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<BuildUpload | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "vazio" });
  const [over, setOver] = useState(false);
  const [entry, setEntry] = useState<string | null>(null);
  const [isolation, setIsolation] = useState(false);
  const [builds, setBuilds] = useState<BuildRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const headingId = useId();
  const entryId = useId();
  const isoId = useId();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/builds?projeto=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { builds?: BuildRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não deu para carregar a lista de builds. Recarregue a página.");
      setBuilds(data.builds ?? []);
      setListError(null);
      // O painel de publicar confere de novo o que falta.
      window.dispatchEvent(new Event(FILES_CHANGED));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Não deu para carregar a lista de builds. Recarregue a página.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Sair da página no meio do envio: o navegador pergunta antes.
  useEffect(() => {
    if (stage.kind !== "enviando" || !["criando", "enviando", "concluindo"].includes(stage.progress.phase)) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  const take = async (name: string, get: () => Promise<SourceFile[]> | SourceFile[]) => {
    setStage({ kind: "lendo", name });
    try {
      const files = await get();
      const analysis = await analyze(files);
      setEntry(analysis.detection.entry);
      setIsolation(analysis.detection.needsIsolation);
      setStage({ kind: "pronto-para-enviar", analysis, name });
    } catch (err) {
      setStage({ kind: "erro", message: err instanceof IngestError ? err.message : "Não deu para ler esse arquivo. Confira se é um .zip inteiro ou uma pasta com o build." });
      if (!(err instanceof IngestError)) console.error(err);
    }
  };

  const chooseEntry = async (value: string) => {
    if (stage.kind !== "pronto-para-enviar") return;
    setEntry(value);
    const analysis = await analyze(stage.analysis.files, value);
    setIsolation(analysis.detection.needsIsolation || isolation);
    setStage({ ...stage, analysis });
  };

  const send = async () => {
    if (stage.kind !== "pronto-para-enviar" || !entry) return;
    const { analysis, name } = stage;
    const d = analysis.detection;
    let files: SourceFile[];
    try {
      files = await prepareFiles(analysis, entry, isolation);
    } catch (err) {
      setStage({ kind: "erro", message: err instanceof Error ? err.message : "Não deu para preparar os arquivos para o envio. Tente de novo." });
      return;
    }
    const up = new BuildUpload(
      files,
      {
        projectId,
        entry,
        engine: d.engine,
        engineVersion: d.version,
        isolation,
        width: d.width,
        height: d.height,
        unityweb: analysis.unityweb,
      },
      (progress) => {
        if (uploadRef.current !== up) return; // cancelado ou trocado
        setStage({ kind: "enviando", analysis, name, progress });
        if (progress.phase === "pronto") void load();
      },
    );
    uploadRef.current = up;
    setStage({ kind: "enviando", analysis, name, progress: up.snapshot() });
    await up.start();
  };

  const cancel = async () => {
    const up = uploadRef.current;
    uploadRef.current = null;
    setStage({ kind: "vazio" });
    await up?.cancel();
    void load();
  };

  const retry = () => void uploadRef.current?.retryFailed();

  const reset = () => {
    uploadRef.current = null;
    setStage({ kind: "vazio" });
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/builds/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não deu para excluir o build. Tente de novo.");
      setConfirming(null);
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Não deu para excluir o build. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const dt = e.dataTransfer;
    const label = dt.files[0]?.name ?? "pasta";
    void take(label, () => ingestDrop(dt));
  };

  return (
    <section className="wb" aria-labelledby={headingId}>
      <h3 id={headingId}>Build de navegador</h3>
      <p className="wb-intro">
        Um .zip ou a pasta exportada pelo motor (Unity, Godot, Construct, GameMaker, Defold, PICO-8, Unreal 4 HTML5, Rust/Bevy ou
        HTML5). O arquivo é lido neste navegador e cada parte vai direto para o armazenamento.
      </p>

      <input
        ref={zipInput}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void take(file.name, () => ingestZip(file));
        }}
      />
      <input
        ref={dirInput}
        type="file"
        hidden
        // @ts-expect-error: atributo não padronizado, suportado por Chrome, Edge, Firefox e Safari
        webkitdirectory=""
        multiple
        onChange={(e) => {
          const list = e.target.files;
          const name = list?.[0]?.webkitRelativePath.split("/")[0] ?? "pasta";
          if (list && list.length) {
            const copy = [...list];
            e.target.value = "";
            void take(name, () => ingestDirectoryInput(copy));
          }
        }}
      />

      {(stage.kind === "vazio" || stage.kind === "erro" || stage.kind === "lendo") && (
        <div
          className="dropzone wb-drop"
          data-over={over}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          {stage.kind === "lendo" ? (
            <p className="wb-reading" role="status">
              Lendo {stage.name}…
            </p>
          ) : (
            <>
              <strong>Solte aqui o .zip ou a pasta do build</strong>
              <span>Até {formatBytes(3 * 1024 ** 3)} descompactado, até 20.000 arquivos.</span>
              <div className="wb-pick">
                <button type="button" className="btn btn--sm" onClick={() => zipInput.current?.click()}>
                  <FileArchive aria-hidden />
                  Escolher .zip
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => dirInput.current?.click()}>
                  <FolderOpen aria-hidden />
                  Escolher pasta
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stage.kind === "erro" && (
        <p className="publish-error wb-error" role="alert">
          {stage.message}
        </p>
      )}

      {(stage.kind === "pronto-para-enviar" || stage.kind === "enviando") && (
        <Proof
          stage={stage}
          entry={entry}
          entryId={entryId}
          isoId={isoId}
          isolation={isolation}
          onEntry={chooseEntry}
          onIsolation={setIsolation}
          onSend={send}
          onCancel={cancel}
          onRetry={retry}
          onReset={reset}
        />
      )}

      <div className="wb-list">
        <h4>Builds deste rascunho</h4>
        {listError && (
          <p className="publish-error" role="alert">
            {listError}
          </p>
        )}
        {builds === null && !listError ? (
          <p className="wb-muted">Carregando…</p>
        ) : builds && builds.length === 0 ? (
          <p className="wb-muted">Nenhum build enviado ainda. O primeiro que você enviar aparece aqui, com o link para testar.</p>
        ) : (
          <ol className="wb-rows">
            {builds?.map((b, i) => (
              <li key={b.id} data-state={b.estado}>
                <span className="num wb-no">{String(builds.length - i).padStart(2, "0")}</span>
                <span className="wb-what">
                  <strong>
                    {ENGINE_LABEL[b.motor] ?? "HTML5"}
                    {b.versao ? ` ${b.versao}` : ""}
                  </strong>
                  <span>
                    <span className="num">{b.arquivos.toLocaleString("pt-BR")}</span> arquivos ·{" "}
                    <span className="num">{formatBytes(b.tamanho)}</span> · {dateFmt.format(new Date(b.criadoEm))}
                    {b.isolamento ? " · com threads" : ""}
                  </span>
                </span>
                <span className="wb-state">{b.estado === "pronto" ? "Pronto" : b.estado === "enviando" ? "Envio incompleto" : "Falhou"}</span>
                <span className="wb-actions">
                  {b.estado === "pronto" && (
                    <Link className="btn btn--sm" href={`/jogar/${b.id}`} target="_blank">
                      <Play aria-hidden />
                      Testar no navegador
                    </Link>
                  )}
                  {confirming === b.id ? (
                    <>
                      <button type="button" className="btn btn--sm wb-danger" onClick={() => void remove(b.id)} disabled={busy === b.id}>
                        {busy === b.id ? "Excluindo…" : "Excluir de vez"}
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(null)}>
                        Manter o build
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Excluir o build ${String(builds.length - i).padStart(2, "0")}`}
                      onClick={() => setConfirming(b.id)}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const NOTICE_ICON = { erro: OctagonX, aviso: TriangleAlert, info: Info } as const;

function Notices({ items }: { items: Notice[] }) {
  if (!items.length) return null;
  return (
    <ul className="wb-notices">
      {items.map((n, i) => {
        const Icon = NOTICE_ICON[n.level];
        return (
          <li key={i} data-level={n.level}>
            <Icon aria-hidden />
            <span>
              <span className="visually-hidden">{n.level === "erro" ? "Erro: " : n.level === "aviso" ? "Aviso: " : "Nota: "}</span>
              {n.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const SHOWN_FILES = 10;

function Proof(props: {
  stage: Extract<Stage, { kind: "pronto-para-enviar" | "enviando" }>;
  entry: string | null;
  entryId: string;
  isoId: string;
  isolation: boolean;
  onEntry: (v: string) => void;
  onIsolation: (v: boolean) => void;
  onSend: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onReset: () => void;
}) {
  const { stage } = props;
  const a = stage.analysis;
  const d = a.detection;
  const sending = stage.kind === "enviando" ? stage.progress : null;
  const locked = sending !== null;
  const biggest = [...a.files].sort((x, y) => y.size - x.size).slice(0, SHOWN_FILES);
  const pct = sending && sending.totalBytes > 0 ? Math.floor((sending.sentBytes / sending.totalBytes) * 100) : 0;

  return (
    <div className="wb-sheet">
      <div className="wb-head">
        <p className="wb-engine">{ENGINE_LABEL[d.engine]}{d.version ? ` ${d.version}` : ""}</p>
        <p className="wb-meta">
          <span className="num">{a.files.length.toLocaleString("pt-BR")}</span> arquivos · <span className="num">{formatBytes(a.totalBytes)}</span>
          {d.width && d.height ? (
            <>
              {" "}
              · tela <span className="num">{d.width} × {d.height}</span>
            </>
          ) : null}
          <span className="wb-source"> · {stage.name}</span>
        </p>
      </div>

      <Notices items={d.notices} />

      {d.entryCandidates.length > 1 && !d.generateRuffleEntry && (
        <div className="wb-field">
          <label className="field-label" htmlFor={props.entryId}>
            Página que abre o jogo
          </label>
          <select
            id={props.entryId}
            className="wb-select"
            value={props.entry ?? ""}
            disabled={locked}
            onChange={(e) => props.onEntry(e.target.value)}
          >
            {!props.entry && <option value="">Escolha…</option>}
            {d.entryCandidates.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {!d.blocked && (
        <label className="check wb-iso" htmlFor={props.isoId}>
          <input id={props.isoId} type="checkbox" checked={props.isolation} disabled={locked} onChange={(e) => props.onIsolation(e.target.checked)} />
          <span>
            Precisa de isolamento (threads, SharedArrayBuffer)
            <span className="field-hint">
              {d.isolationReason ?? "Ligue só se o motor exportou com threads. O site acrescenta um service worker que liga o isolamento."}
            </span>
          </span>
        </label>
      )}

      <details className="wb-files">
        <summary>
          Maiores arquivos {props.entry ? <>· entrada <code>{props.entry}</code></> : null}
        </summary>
        <ul className="filetree">
          {biggest.map((f) => (
            <li key={f.path} className={f.path === props.entry ? "is-entry" : undefined}>
              <span>{f.path}</span>
              <span>{formatBytes(f.size)}</span>
            </li>
          ))}
          {a.files.length > SHOWN_FILES && (
            <li>
              <span>e mais {(a.files.length - SHOWN_FILES).toLocaleString("pt-BR")} arquivos</span>
              <span />
            </li>
          )}
        </ul>
      </details>

      {sending ? (
        <div className="wb-progress">
          <div
            className="wb-bar"
            role="progressbar"
            aria-label="Envio do build"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            data-phase={sending.phase}
          >
            <span style={{ width: `${sending.phase === "pronto" ? 100 : pct}%` }} />
          </div>
          <p className="wb-numbers" aria-live="polite">
            {sending.phase === "criando" && "Reservando espaço…"}
            {sending.phase === "enviando" && (
              <>
                <span className="num">{pct}%</span> · <span className="num">{formatBytes(sending.sentBytes)}</span> de{" "}
                <span className="num">{formatBytes(sending.totalBytes)}</span> · <span className="num">{sending.doneFiles.toLocaleString("pt-BR")}</span>/
                <span className="num">{sending.totalFiles.toLocaleString("pt-BR")}</span> arquivos
                {sending.bytesPerSecond > 0 && (
                  <>
                    {" "}
                    · <span className="num">{speed(sending.bytesPerSecond)}</span>
                  </>
                )}
              </>
            )}
            {sending.phase === "concluindo" && "Conferindo no armazenamento…"}
            {sending.phase === "pronto" && "Build no ar."}
            {sending.phase === "falhas" && `${sending.failed.length} ${sending.failed.length === 1 ? "arquivo não subiu" : "arquivos não subiram"}.`}
            {sending.phase === "cancelado" && "Envio cancelado. O que tinha subido foi apagado."}
            {sending.phase === "erro" && (sending.error ?? "O envio parou.")}
          </p>
          {sending.phase === "falhas" && (
            <ul className="wb-failed">
              {sending.failed.slice(0, 5).map((f) => (
                <li key={f.path}>
                  <code>{f.path}</code> {f.error}
                </li>
              ))}
            </ul>
          )}
          <div className="wb-buttons">
            {sending.phase === "pronto" && sending.buildId && (
              <>
                <Link className="btn btn--lime" href={`/jogar/${sending.buildId}`} target="_blank">
                  <Play aria-hidden />
                  Testar no navegador
                </Link>
                <button type="button" className="btn btn--ghost" onClick={props.onReset}>
                  Enviar outro build
                </button>
              </>
            )}
            {sending.phase === "falhas" && (
              <button type="button" className="btn" onClick={props.onRetry}>
                <RotateCcw aria-hidden />
                Tentar de novo os que falharam
              </button>
            )}
            {sending.phase === "erro" && (
              <button type="button" className="btn" onClick={props.onRetry}>
                <RotateCcw aria-hidden />
                Tentar de novo
              </button>
            )}
            {["criando", "enviando", "concluindo", "falhas", "erro"].includes(sending.phase) && (
              <button type="button" className="btn btn--ghost" onClick={props.onCancel}>
                <X aria-hidden />
                Cancelar envio
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="wb-buttons">
          <button type="button" className="btn" onClick={props.onSend} disabled={d.blocked || !props.entry}>
            Enviar build
          </button>
          <button type="button" className="btn btn--ghost" onClick={props.onReset}>
            Escolher outro
          </button>
        </div>
      )}
    </div>
  );
}

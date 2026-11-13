"use client";

import "@/styles/envios.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CloudUpload, Download, Pause, Play, RotateCcw, Trash2, TriangleAlert, X } from "lucide-react";
import { PLATFORMS, type Platform } from "@/data/base";
import { MAX_FILE_BYTES } from "@/lib/storage/limits";
import {
  api,
  ApiError,
  findPendingFor,
  formatEta,
  formatSize,
  formatSpeed,
  forgetPending,
  Uploader,
  type RemoteFile,
  type UploadSnapshot,
} from "@/lib/uploads/client";
import { DOWNLOAD_PLATFORMS, PLATFORM_HINTS, PLATFORM_NAMES, type DownloadPlatform } from "@/lib/uploads/rules";

/*
 * Arquivos para baixar de um rascunho, por plataforma (Windows, macOS, Linux,
 * Android). Autocontido: recebe o id do rascunho salvo e as plataformas
 * marcadas, lista o que já está no armazenamento e envia arquivos novos
 * direto do navegador para o MinIO (motor em lib/uploads/client.ts).
 *
 * Um envio por vez (os outros esperam na fila): as partes de um arquivo já
 * ocupam a conexão; dois arquivos ao mesmo tempo só dividiriam a banda.
 */

interface Props {
  /** Id do rascunho salvo; null enquanto o rascunho não foi salvo. */
  projectId: string | null;
  /** Plataformas marcadas no rascunho (as de navegador são ignoradas aqui). */
  platforms: readonly Platform[];
}

interface ListResponse {
  files: RemoteFile[];
  used: number;
  quota: number;
  storage: boolean;
}

interface LocalRow {
  localId: string;
  platform: DownloadPlatform;
  file: File;
  snap: UploadSnapshot | null;
  /** Ainda esperando a vez (um envio por vez). */
  queued: boolean;
  /** Envio interrompido a retomar com este arquivo. */
  resumeId: string | null;
  /** Erro antes de começar (tamanho, arquivo vazio). */
  earlyError: string | null;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.floor((a / b) * 100)) : 0);

const RETRYABLE = new Set(["rede", "servidor", "armazenamento", "sessao", "envio", "taxa", "incompleto", "concluindo"]);

export default function DownloadFiles({ projectId, platforms }: Props) {
  const uid = useId();
  const shown = useMemo(
    () => DOWNLOAD_PLATFORMS.filter((p) => platforms.includes(p)),
    [platforms],
  );
  const [list, setList] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [progressOf, setProgressOf] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [announce, setAnnounce] = useState("");
  const uploaders = useRef(new Map<string, Uploader>());

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api<ListResponse>(`/api/envios?projeto=${encodeURIComponent(projectId)}`);
      setList(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Não conseguimos carregar os arquivos.");
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Percentual dos envios interrompidos (página recarregada no meio).
  useEffect(() => {
    if (!list) return;
    for (const f of list.files) {
      if (f.status !== "enviando" || progressOf[f.id] !== undefined) continue;
      void api<{ parts: { n: number; size: number }[] }>(`/api/envios/${f.id}`)
        .then((s) => setProgressOf((m) => ({ ...m, [f.id]: s.parts.reduce((a, p) => a + p.size, 0) })))
        .catch(() => setProgressOf((m) => ({ ...m, [f.id]: 0 })));
    }
  }, [list, progressOf]);

  // Fila: um envio por vez.
  useEffect(() => {
    const running = rows.some((r) => !r.queued && r.snap && (r.snap.phase === "preparando" || r.snap.phase === "enviando" || r.snap.phase === "sem-rede" || r.snap.phase === "concluindo"));
    if (running || !projectId) return;
    const next = rows.find((r) => r.queued);
    if (!next) return;
    // O envio aberto já conta no espaço da conta: atualiza a linha de espaço uma vez.
    let counted = false;
    const up = new Uploader({
      projectId,
      platform: next.platform,
      file: next.file,
      resumeId: next.resumeId,
      onChange: (snap) => {
        setRows((rs) => rs.map((r) => (r.localId === next.localId ? { ...r, snap } : r)));
        if (snap.phase === "enviando" && !counted) {
          counted = true;
          void refresh();
        }
        if (snap.phase === "pronto") {
          setAnnounce(`${snap.name} enviado.`);
          void refresh().then(() => {
            uploaders.current.delete(next.localId);
            setRows((rs) => rs.filter((r) => r.localId !== next.localId));
          });
        } else if (snap.phase === "erro") setAnnounce(`Erro no envio de ${snap.name}: ${snap.error ?? ""}`);
        else if (snap.phase === "pausado") setAnnounce(`Envio de ${snap.name} pausado.`);
      },
    });
    uploaders.current.set(next.localId, up);
    setRows((rs) => rs.map((r) => (r.localId === next.localId ? { ...r, queued: false } : r)));
    setAnnounce(`Enviando ${next.file.name}.`);
    void up.start();
  }, [rows, projectId, refresh]);

  // Aviso antes de sair da página no meio de um envio.
  const anyActive = rows.some((r) => r.queued || (r.snap && ["preparando", "enviando", "sem-rede", "concluindo"].includes(r.snap.phase)));
  useEffect(() => {
    if (!anyActive) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyActive]);

  useEffect(() => {
    const map = uploaders.current;
    return () => {
      for (const u of map.values()) u.detach();
    };
  }, []);

  function addFiles(platform: DownloadPlatform, files: FileList | File[]) {
    const add: LocalRow[] = [];
    for (const file of Array.from(files)) {
      const interrupted = list?.files.find(
        (f) =>
          f.status === "enviando" &&
          f.platform === platform &&
          f.filename === file.name.normalize("NFC") &&
          f.size === file.size &&
          (f.lastModified === null || f.lastModified === file.lastModified) &&
          !rows.some((r) => r.resumeId === f.id),
      );
      const pending = interrupted ? null : projectId ? findPendingFor(projectId, platform, file) : null;
      const earlyError =
        file.size === 0
          ? "Esse arquivo está vazio."
          : file.size > MAX_FILE_BYTES
            ? `Esse arquivo tem ${formatSize(file.size)}; o limite é 3 GB por arquivo. Comprima o build ou divida em partes.`
            : null;
      add.push({
        localId: `${platform}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        platform,
        file,
        snap: null,
        queued: !earlyError,
        resumeId: interrupted?.id ?? pending?.uploadId ?? null,
        earlyError,
      });
    }
    if (add.length) setRows((rs) => [...rs, ...add]);
  }


  async function dismissRow(localId: string, cancel: boolean) {
    const up = uploaders.current.get(localId);
    const name = rows.find((r) => r.localId === localId)?.file.name ?? "arquivo";
    setRows((rs) => rs.filter((r) => r.localId !== localId));
    uploaders.current.delete(localId);
    if (cancel && up) {
      const uploadId = up.snapshot().uploadId;
      if (uploadId) setList((l) => (l ? { ...l, files: l.files.filter((f) => f.id !== uploadId) } : l));
      await up.cancel();
      setAnnounce(`Envio de ${name} cancelado.`);
      await refresh();
    } else up?.detach();
  }

  async function removeRemote(file: RemoteFile) {
    setBusy(file.id);
    setRowError((m) => ({ ...m, [file.id]: "" }));
    try {
      await api(`/api/envios/${file.id}`, { method: "DELETE", body: {} });
      forgetPending(file.id);
      setConfirming(null);
      setAnnounce(file.status === "pronto" ? `${file.filename} excluído.` : `Envio de ${file.filename} descartado.`);
      await refresh();
    } catch (err) {
      setRowError((m) => ({ ...m, [file.id]: err instanceof ApiError ? err.message : "Não conseguimos excluir agora." }));
    } finally {
      setBusy(null);
    }
  }

  if (!projectId) {
    return (
      <div className="dl-note" role="note">
        <CloudUpload aria-hidden />
        <p>
          <strong>Salve o rascunho para enviar arquivos.</strong> Os arquivos ficam presos ao rascunho, então ele precisa
          existir antes.
        </p>
      </div>
    );
  }

  if (list && !list.storage) {
    return (
      <div className="dl-note" role="note">
        <CloudUpload aria-hidden />
        <p>
          <strong>O envio de arquivos ainda não está ligado neste site.</strong> O rascunho guarda as plataformas
          marcadas; os arquivos entram aqui quando o armazenamento estiver configurado.
        </p>
      </div>
    );
  }

  const usedPct = list ? pct(list.used, list.quota) : 0;

  return (
    <section className="dl" aria-labelledby={`${uid}-t`}>
      <div className="dl-head">
        <h3 id={`${uid}-t`}>Arquivos para baixar</h3>
        {list ? (
          <p className="dl-quota">
            <span className="dl-quota-text">
              Espaço da conta: <span className="num">{formatSize(list.used)}</span> de{" "}
              <span className="num">{formatSize(list.quota)}</span>
            </span>
            <span
              className="dl-meter"
              role="meter"
              aria-label="Espaço usado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={usedPct}
              aria-valuetext={`${usedPct}% usado`}
              data-full={usedPct >= 90 ? "true" : undefined}
            >
              <span style={{ width: `${Math.max(usedPct, list.used > 0 ? 1 : 0)}%` }} />
            </span>
          </p>
        ) : null}
      </div>

      {loadError ? (
        <div className="dl-alert" role="alert">
          <TriangleAlert aria-hidden />
          <p>{loadError}</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void refresh()}>
            <RotateCcw aria-hidden />
            Tentar de novo
          </button>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="dl-empty">
          Marque Windows, macOS, Linux ou Android acima para enviar o arquivo de cada sistema. O build para o navegador
          entra no passo do jogável.
        </p>
      ) : null}

      <p aria-live="polite" className="visually-hidden">
        {announce}
      </p>

      {shown.map((platform) => {
        const remote = (list?.files ?? []).filter((f) => f.platform === platform);
        const ready = remote.filter((f) => f.status === "pronto");
        const interrupted = remote.filter((f) => f.status === "enviando" && !rows.some((r) => r.snap?.uploadId === f.id || r.resumeId === f.id));
        const local = rows.filter((r) => r.platform === platform);
        const count = ready.length + interrupted.length + local.length;
        return (
          <div className="dl-platform" key={platform}>
            <h4 className="dl-ph">
              <span className="code" aria-hidden>
                {PLATFORMS[platform].code}
              </span>
              {PLATFORM_NAMES[platform]}
              <span className="dl-count">
                <span className="num">{ready.length}</span> {ready.length === 1 ? "arquivo" : "arquivos"}
              </span>
            </h4>

            {count > 0 ? (
              <ol className="dl-list">
                {ready.map((f, i) => (
                  <li key={f.id} className="dl-row">
                    <span className="dl-n num" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="dl-main">
                      <span className="dl-name">{f.filename}</span>
                      <span className="dl-meta">
                        <span className="num">{formatSize(f.size)}</span>
                        <span aria-hidden> · </span>
                        enviado em <span className="num">{dateFmt.format(new Date(f.completedAt ?? f.createdAt))}</span>
                      </span>
                      {rowError[f.id] ? <span className="field-error">{rowError[f.id]}</span> : null}
                    </div>
                    <div className="dl-actions">
                      {confirming === f.id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn--sm dl-danger"
                            disabled={busy === f.id}
                            onClick={() => void removeRemote(f)}
                          >
                            <Trash2 aria-hidden />
                            {busy === f.id ? "Excluindo" : "Excluir de vez"}
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(null)}>
                            Manter
                          </button>
                        </>
                      ) : (
                        <>
                          <a className="btn btn--ghost btn--sm" href={`/baixar/${f.id}`} download>
                            <Download aria-hidden />
                            Baixar
                          </a>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Excluir ${f.filename}`}
                            onClick={() => setConfirming(f.id)}
                          >
                            <Trash2 aria-hidden />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}

                {interrupted.map((f, i) => {
                  const done = progressOf[f.id];
                  return (
                    <li key={f.id} className="dl-row dl-row--live">
                      <span className="dl-n num" aria-hidden>
                        {String(ready.length + i + 1).padStart(2, "0")}
                      </span>
                      <div className="dl-main">
                        <span className="dl-name">{f.filename}</span>
                        <Bar loaded={done ?? 0} total={f.size} state="parado" label={f.filename} />
                        <span className="dl-meta">
                          Envio interrompido
                          {done !== undefined ? (
                            <>
                              {" "}em <span className="num">{pct(done, f.size)}%</span>
                            </>
                          ) : null}
                          . Escolha o mesmo arquivo (<span className="num">{formatSize(f.size)}</span>) para continuar de onde
                          parou.
                        </span>
                        {rowError[f.id] ? <span className="field-error">{rowError[f.id]}</span> : null}
                      </div>
                      <div className="dl-actions">
                        <PickButton platform={platform} label="Escolher o arquivo" onPick={(files) => addFiles(platform, files)} />
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Descartar o envio de ${f.filename}`}
                          disabled={busy === f.id}
                          onClick={() => void removeRemote(f)}
                        >
                          <X aria-hidden />
                        </button>
                      </div>
                    </li>
                  );
                })}

                {local.map((r, i) => (
                  <LocalItem
                    key={r.localId}
                    row={r}
                    index={ready.length + interrupted.length + i + 1}
                    uploader={uploaders.current.get(r.localId) ?? null}
                    onDismiss={(cancel) => void dismissRow(r.localId, cancel)}
                  />
                ))}
              </ol>
            ) : null}

            <DropZone platform={platform} compact={count > 0} onFiles={(files) => addFiles(platform, files)} />
          </div>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Bar({ loaded, total, state, label }: { loaded: number; total: number; state: "ativo" | "parado" | "erro"; label: string }) {
  const p = pct(loaded, total);
  return (
    <span
      className="dl-bar"
      data-state={state}
      role="progressbar"
      aria-label={`Envio de ${label}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-valuetext={`${p}%, ${formatSize(loaded)} de ${formatSize(total)}`}
    >
      {p > 0 ? <span style={{ width: `${p}%` }} /> : null}
    </span>
  );
}

function LocalItem({
  row,
  index,
  uploader,
  onDismiss,
}: {
  row: LocalRow;
  index: number;
  uploader: Uploader | null;
  /** Tira a linha; com cancel=true cancela o envio no servidor antes. */
  onDismiss: (cancel: boolean) => void;
}) {
  const s = row.snap;
  const phase = row.earlyError ? "erro" : row.queued || !s ? "fila" : s.phase;
  const loaded = s?.loaded ?? 0;
  const total = row.file.size;
  const error = row.earlyError ?? s?.error ?? null;
  const canRetry = !row.earlyError && s?.errorCode ? RETRYABLE.has(s.errorCode) : false;

  if (phase === "pronto" || phase === "cancelado") return null;

  const barState = phase === "erro" ? "erro" : phase === "pausado" || phase === "fila" ? "parado" : "ativo";
  let meta: React.ReactNode;
  switch (phase) {
    case "fila":
      meta = <>Na fila · <span className="num">{formatSize(total)}</span></>;
      break;
    case "preparando":
      meta = <>Preparando o envio…</>;
      break;
    case "concluindo":
      meta = <>Conferindo o arquivo no armazenamento…</>;
      break;
    case "pausado":
      meta = (
        <>
          Pausado em <span className="num">{pct(loaded, total)}%</span> · <span className="num">{formatSize(loaded)}</span> de{" "}
          <span className="num">{formatSize(total)}</span>
        </>
      );
      break;
    case "sem-rede":
      meta = <>Sem conexão. O envio continua sozinho quando a rede voltar.</>;
      break;
    case "erro":
      meta = null;
      break;
    default:
      meta = (
        <>
          <span className="num">{formatSize(loaded)}</span> de <span className="num">{formatSize(total)}</span>
          <span aria-hidden> · </span>
          <span className="num">{formatSpeed(s?.speed ?? 0)}</span>
          <span aria-hidden> · </span>
          {s?.eta !== null && s?.eta !== undefined ? (
            <>
              faltam <span className="num">{formatEta(s.eta)}</span>
            </>
          ) : (
            "calculando o tempo"
          )}
        </>
      );
  }

  return (
    <li className="dl-row dl-row--live" data-phase={phase}>
      <span className="dl-n num" aria-hidden>
        {String(index).padStart(2, "0")}
      </span>
      <div className="dl-main">
        <span className="dl-name">{row.file.name}</span>
        {phase === "erro" && loaded === 0 ? null : <Bar loaded={loaded} total={total} state={barState} label={row.file.name} />}
        {meta ? <span className="dl-meta">{meta}</span> : null}
        {phase === "erro" && error ? (
          <span className="dl-err" role="alert">
            <TriangleAlert aria-hidden />
            {error}
          </span>
        ) : null}
      </div>
      <div className="dl-actions">
        {phase === "enviando" || phase === "sem-rede" ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => uploader?.pause()}>
            <Pause aria-hidden />
            Pausar
          </button>
        ) : null}
        {phase === "pausado" ? (
          <button type="button" className="btn btn--sm" onClick={() => uploader?.resume()}>
            <Play aria-hidden />
            Retomar
          </button>
        ) : null}
        {phase === "erro" && canRetry ? (
          <button type="button" className="btn btn--sm" onClick={() => uploader?.resume()}>
            <RotateCcw aria-hidden />
            Tentar de novo
          </button>
        ) : null}
        {phase === "erro" ? (
          <button
            type="button"
            className="icon-btn"
            aria-label={canRetry ? `Cancelar o envio de ${row.file.name}` : `Tirar ${row.file.name} da lista`}
            onClick={() => {
              onDismiss(canRetry);
            }}
          >
            <X aria-hidden />
          </button>
        ) : phase !== "concluindo" ? (
          <button
            type="button"
            className="icon-btn"
            aria-label={`Cancelar o envio de ${row.file.name}`}
            onClick={() => {
              onDismiss(true);
            }}
          >
            <X aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function DropZone({
  platform,
  compact,
  onFiles,
}: {
  platform: DownloadPlatform;
  compact: boolean;
  onFiles: (files: FileList) => void;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const id = useId();
  const name = PLATFORM_NAMES[platform];
  return (
    <label
      className="dropzone dl-drop"
      data-compact={compact ? "true" : undefined}
      data-over={over ? "true" : undefined}
      htmlFor={id}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
    >
      <CloudUpload aria-hidden />
      <strong>{compact ? `Adicionar outro arquivo de ${name}` : `Solte aqui o arquivo de ${name}`}</strong>
      <span>
        ou clique para escolher. {PLATFORM_HINTS[platform]}, até <span className="num">3</span> GB.
      </span>
      <input
        id={id}
        type="file"
        multiple
        className="visually-hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function PickButton({ platform, label, onPick }: { platform: DownloadPlatform; label: string; onPick: (files: FileList) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn btn--sm" onClick={() => ref.current?.click()}>
        <RotateCcw aria-hidden />
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        tabIndex={-1}
        aria-hidden
        className="visually-hidden"
        data-platform={platform}
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Check, Download, LoaderCircle, RotateCcw } from "lucide-react";
import { ApiError, api } from "@/lib/uploads/client";
import { FILES_CHANGED, ITCH_FILES, ITCH_PLATFORM } from "@/lib/projects/events";

/*
 * Passo 3, rascunho trazido do itch.io: os arquivos de download do jogo lá, cada
 * um com "Trazer". O servidor copia parte por parte do CDN do itch para o
 * armazenamento; o navegador só coordena e mostra o andamento.
 */

interface Row {
  id: number;
  filename: string;
  sizeLabel: string;
  platforms: string[];
  local: { id: string; status: string } | null;
}
interface ListResponse {
  fromItch: boolean;
  itchUrl?: string;
  web?: boolean;
  files: Row[];
}
const WEB_ROW = -1;
interface Started {
  file: { id: string; platform: string; size: number; partSize: number; partCount: number };
  done: number[];
}

const PULL_BATCH = 4;
const PULL_WORKERS = 3;

const KIND: Record<string, string> = { windows: "Windows", macos: "macOS", linux: "Linux", android: "Android" };

type RunState = { kind: "rodando"; loaded: number; total: number; label: string } | { kind: "erro"; message: string } | { kind: "feito"; message: string };

async function pool<T>(items: T[], workers: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

export function ItchFiles({ projectId }: { projectId: string }) {
  const uid = useId();
  const [list, setList] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [run, setRun] = useState<Record<number, RunState>>({});

  const load = useCallback(async () => {
    try {
      setList(await api<ListResponse>(`/api/itch/arquivos?projeto=${encodeURIComponent(projectId)}`, {}, 2));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Não deu para ler os arquivos do itch.io.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!list && !loadError) return null;
  if (list && !list.fromItch) return null;

  const set = (id: number, s: RunState) => setRun((r) => ({ ...r, [id]: s }));
  const busy = Object.values(run).some((s) => s.kind === "rodando");

  /** Download: o servidor copia as partes que faltam e conclui com as conferências de sempre. */
  const pullDownload = async (row: Row) => {
    set(row.id, { kind: "rodando", loaded: 0, total: 0, label: "Pedindo o arquivo ao itch.io…" });
    try {
      const s = await api<Started>("/api/itch/arquivos", { method: "POST", body: { projectId, itchUploadId: row.id } });
      window.dispatchEvent(new CustomEvent(ITCH_PLATFORM, { detail: s.file.platform }));
      const sizeOf = (n: number) => (n < s.file.partCount ? s.file.partSize : s.file.size - (s.file.partCount - 1) * s.file.partSize);
      let loaded = s.done.reduce((a, n) => a + sizeOf(n), 0);
      const pull = async (parts: number[]) => {
        const batches: number[][] = [];
        for (let i = 0; i < parts.length; i += PULL_BATCH) batches.push(parts.slice(i, i + PULL_BATCH));
        await pool(batches, PULL_WORKERS, async (b) => {
          await api(`/api/itch/arquivos/${s.file.id}/puxar`, { method: "POST", body: { parts: b } });
          loaded += b.reduce((a, n) => a + sizeOf(n), 0);
          set(row.id, { kind: "rodando", loaded, total: s.file.size, label: "Copiando do itch.io…" });
        });
      };
      const done = new Set(s.done);
      await pull(Array.from({ length: s.file.partCount }, (_, i) => i + 1).filter((n) => !done.has(n)));
      for (let tries = 0; tries < 3; tries++) {
        set(row.id, { kind: "rodando", loaded: s.file.size, total: s.file.size, label: "Conferindo…" });
        const r = await api<{ missing?: number[] }>(`/api/envios/${s.file.id}/concluir`, { method: "POST", body: {} });
        if (!r.missing?.length) break;
        await pull(r.missing);
      }
      set(row.id, { kind: "feito", message: `Pronto: está na lista de ${KIND[s.file.platform] ?? s.file.platform}.` });
      window.dispatchEvent(new Event(ITCH_FILES));
      window.dispatchEvent(new Event(FILES_CHANGED));
      void load();
    } catch (err) {
      set(row.id, { kind: "erro", message: err instanceof ApiError ? err.message : "A cópia parou. Tente de novo; continua de onde parou." });
    }
  };

  /** Versão de navegador: o servidor segue os arquivos do build no itch e cria o build daqui. */
  const pullWeb = async () => {
    set(WEB_ROW, { kind: "rodando", loaded: 0, total: 0, label: "Copiando a versão de navegador (pode levar alguns minutos)…" });
    try {
      // Uma tentativa só: repetir no meio criaria outro build.
      const r = await api<{ files: number; engine: string; notices: string[] }>("/api/itch/web", { method: "POST", body: { projectId } }, 1);
      window.dispatchEvent(new CustomEvent(ITCH_PLATFORM, { detail: "web" }));
      window.dispatchEvent(new Event(ITCH_FILES));
      window.dispatchEvent(new Event(FILES_CHANGED));
      set(WEB_ROW, {
        kind: "feito",
        message: `Pronto: ${r.files} ${r.files === 1 ? "arquivo" : "arquivos"} no painel da versão de navegador. Abra o jogo por lá para conferir.${r.notices.length ? " " + r.notices.join(" ") : ""}`,
      });
    } catch (err) {
      set(WEB_ROW, { kind: "erro", message: err instanceof ApiError ? err.message : "A cópia parou. Tente de novo." });
    }
  };

  const take = pullDownload;
  const takeable = (list?.files ?? []).filter((r) => r.platforms.length && r.local?.status !== "pronto");

  return (
    <section className="itch-files" aria-labelledby={`${uid}-h`}>
      <div className="itch-files-head">
        <h3 id={`${uid}-h`} className="field-label">
          Arquivos no itch.io
        </h3>
        {takeable.length > 1 ? (
          <button
            type="button"
            className="btn btn--sm"
            disabled={busy}
            onClick={async () => {
              for (const r of takeable) await take(r);
            }}
          >
            <Download aria-hidden size={16} /> Trazer todos
          </button>
        ) : null}
      </div>

      {loadError ? (
        <p className="bo-alert" role="alert">
          {loadError}{" "}
          <button type="button" className="linklike" onClick={() => void load()}>
            Tentar de novo
          </button>
        </p>
      ) : null}

      {list && list.files.length === 0 && !list.web ? (
        <p className="field-hint">O itch.io não mostra arquivos para baixar desse jogo (talvez seja pago). Envie os arquivos aqui embaixo.</p>
      ) : null}

      {list && (list.files.length > 0 || list.web) ? (
        <ol className="itch-list">
          {list.web ? (
            <li className="itch-row">
              <div className="itch-main">
                <span className="itch-name">Versão de navegador</span>
                <span className="itch-meta">Navegador · o jogo que roda na página do itch</span>
                {run[WEB_ROW]?.kind === "rodando" ? (
                  <span className="itch-progress" role="status">
                    <LoaderCircle aria-hidden className="bo-spin" size={16} /> {(run[WEB_ROW] as { label: string }).label}
                  </span>
                ) : run[WEB_ROW]?.kind === "erro" ? (
                  <span className="bo-alert itch-msg" role="alert">
                    {(run[WEB_ROW] as { message: string }).message}
                  </span>
                ) : run[WEB_ROW]?.kind === "feito" ? (
                  <span className="bo-ok itch-msg" role="status">
                    {(run[WEB_ROW] as { message: string }).message}
                  </span>
                ) : null}
              </div>
              <div className="itch-actions">
                {run[WEB_ROW]?.kind === "feito" ? (
                  <span className="itch-done">
                    <Check aria-hidden size={16} /> Trazido
                  </span>
                ) : (
                  <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void pullWeb()}>
                    {run[WEB_ROW]?.kind === "rodando" ? <LoaderCircle aria-hidden className="bo-spin" size={16} /> : <Download aria-hidden size={16} />}
                    {run[WEB_ROW]?.kind === "erro" ? "Tentar de novo" : "Trazer"}
                  </button>
                )}
              </div>
            </li>
          ) : null}
          {list.files.map((row) => {
            const s = run[row.id];
            const where = row.platforms.length ? row.platforms.map((p) => KIND[p] ?? p).join(", ") : "Outro tipo";
            const ready = row.local?.status === "pronto";
            return (
              <li key={row.id} className="itch-row">
                <div className="itch-main">
                  <span className="itch-name">{row.filename}</span>
                  <span className="itch-meta">
                    {where}
                    {row.sizeLabel ? ` · ${row.sizeLabel}` : ""}
                  </span>
                  {s?.kind === "rodando" ? (
                    <span className="itch-progress" role="status">
                      <progress max={s.total || 1} value={s.loaded} aria-label={`${s.label} ${row.filename}`} /> {s.label}{" "}
                      {s.total ? `${Math.floor((s.loaded / s.total) * 100)}%` : ""}
                    </span>
                  ) : s?.kind === "erro" ? (
                    <span className="bo-alert itch-msg" role="alert">
                      {s.message}
                    </span>
                  ) : s?.kind === "feito" ? (
                    <span className="bo-ok itch-msg" role="status">
                      {s.message}
                    </span>
                  ) : !row.platforms.length ? (
                    <span className="itch-meta">Esse tipo de arquivo (trilha, livro, código…) não tem lugar aqui ainda.</span>
                  ) : null}
                </div>
                <div className="itch-actions">
                  {ready ? (
                    <span className="itch-done">
                      <Check aria-hidden size={16} /> Trazido
                    </span>
                  ) : row.platforms.length ? (
                    <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void take(row)}>
                      {s?.kind === "rodando" ? (
                        <LoaderCircle aria-hidden className="bo-spin" size={16} />
                      ) : s?.kind === "erro" || row.local ? (
                        <RotateCcw aria-hidden size={16} />
                      ) : (
                        <Download aria-hidden size={16} />
                      )}
                      {s?.kind === "erro" || row.local?.status === "enviando" ? "Continuar" : "Trazer"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

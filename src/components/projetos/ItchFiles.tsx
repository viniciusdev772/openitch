"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Check, Download, LoaderCircle, RotateCcw } from "lucide-react";
import { ApiError, api, formatSize } from "@/lib/uploads/client";
import { FILES_CHANGED, ITCH_FILES, ITCH_PLATFORM, handItchWebZip } from "@/lib/projects/events";
import { ItchConnect } from "./ItchConnect";

/*
 * Passo 3, rascunho trazido do itch.io: os arquivos do jogo lá, cada um com
 * "Trazer". Downloads o servidor copia parte por parte (o navegador só coordena);
 * a versão de navegador vem em pedaços para este navegador e entra no painel de
 * builds como se o zip tivesse sido escolhido aqui.
 */

interface Row {
  id: number;
  filename: string;
  displayName: string;
  size: number;
  kind: "download" | "web" | "outro";
  platforms: string[];
  local: { id: string; status: string } | null;
}
interface ListResponse {
  connected: boolean;
  fromItch: boolean;
  username?: string;
  files: Row[];
}
interface Started {
  file: { id: string; platform: string; size: number; partSize: number; partCount: number };
  done: number[];
}

const PULL_BATCH = 4;
const PULL_WORKERS = 3;
const WEB_CHUNK = 4 * 1024 * 1024;
const WEB_WORKERS = 3;

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
    set(row.id, { kind: "rodando", loaded: 0, total: row.size, label: "Preparando…" });
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

  /** Versão de navegador: o zip vem em pedaços para este navegador e vai para o painel de builds. */
  const pullWeb = async (row: Row) => {
    set(row.id, { kind: "rodando", loaded: 0, total: row.size, label: "Baixando do itch.io…" });
    try {
      const count = Math.max(1, Math.ceil(row.size / WEB_CHUNK));
      const chunks: ArrayBuffer[] = new Array(count);
      let loaded = 0;
      await pool(
        Array.from({ length: count }, (_, n) => n),
        WEB_WORKERS,
        async (n) => {
          for (let attempt = 1; ; attempt++) {
            const res = await fetch(`/api/itch/web?projeto=${encodeURIComponent(projectId)}&upload=${row.id}&n=${n}`, { cache: "no-store" }).catch(() => null);
            if (res?.ok) {
              chunks[n] = await res.arrayBuffer();
              break;
            }
            const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
            if (attempt >= 3 || (res && res.status < 500 && res.status !== 429)) throw new ApiError(res?.status ?? 0, "itch", data.error ?? "O download parou. Tente de novo.");
            await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
          loaded += chunks[n].byteLength;
          set(row.id, { kind: "rodando", loaded, total: row.size, label: "Baixando do itch.io…" });
        },
      );
      const name = /\.zip$/i.test(row.filename) ? row.filename : `${row.filename}.zip`;
      window.dispatchEvent(new CustomEvent(ITCH_PLATFORM, { detail: "web" }));
      handItchWebZip(new File(chunks, name, { type: "application/zip" }));
      set(row.id, { kind: "feito", message: "Pronto: o zip abriu no painel da versão de navegador, logo acima. Confira a entrada e envie." });
    } catch (err) {
      set(row.id, { kind: "erro", message: err instanceof ApiError ? err.message : "O download parou. Tente de novo." });
    }
  };

  const take = (row: Row) => (row.kind === "web" ? pullWeb(row) : pullDownload(row));
  const takeable = (list?.files ?? []).filter((r) => r.kind !== "outro" && r.local?.status !== "pronto");

  return (
    <section className="itch-files" aria-labelledby={`${uid}-h`}>
      <div className="itch-files-head">
        <h3 id={`${uid}-h`} className="field-label">
          Arquivos no itch.io
        </h3>
        {list?.connected && takeable.length > 1 ? (
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

      {list && !list.connected ? <ItchConnect onDone={() => void load()} /> : null}

      {list?.connected && list.files.length === 0 ? <p className="field-hint">Esse jogo não tem arquivos no itch.io.</p> : null}

      {list?.connected && list.files.length > 0 ? (
        <ol className="itch-list">
          {list.files.map((row) => {
            const s = run[row.id];
            const where = row.kind === "web" ? "Navegador" : row.kind === "download" ? row.platforms.map((p) => KIND[p] ?? p).join(", ") : "Outro tipo";
            const ready = row.local?.status === "pronto";
            return (
              <li key={row.id} className="itch-row">
                <div className="itch-main">
                  <span className="itch-name">{row.displayName || row.filename}</span>
                  <span className="itch-meta">
                    {where} · {formatSize(row.size)}
                    {row.displayName && row.displayName !== row.filename ? ` · ${row.filename}` : ""}
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
                  ) : row.kind === "outro" ? (
                    <span className="itch-meta">Esse tipo de arquivo (trilha, livro, código…) não tem lugar aqui ainda.</span>
                  ) : null}
                </div>
                <div className="itch-actions">
                  {ready ? (
                    <span className="itch-done">
                      <Check aria-hidden size={16} /> Trazido
                    </span>
                  ) : row.kind !== "outro" ? (
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

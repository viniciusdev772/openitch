"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Maximize, Minimize, Play, RotateCcw } from "lucide-react";
import { formatBytes } from "@/lib/storage/limits";
import { BOXEDWINE, exeCandidates, type ExeToFrame, type ExeToParent } from "@/lib/builds/exe";
import { readZip, ZipError } from "@/lib/builds/zip";

/*
 * Jogo de Windows no navegador. Esta página (origem do site) baixa o arquivo
 * do jogo pela URL curta do MinIO, escolhe o .exe e o entrega por
 * postMessage à página do Boxedwine, que roda num iframe do bucket jogável
 * (outra origem, sem cookies nem acesso a esta página). O Wine (~37 MB) baixa
 * lá dentro ao mesmo tempo e fica no cache do navegador (cache imutável).
 *
 * Sandbox: allow-scripts (o emulador), allow-same-origin (a origem do MinIO,
 * para a página do Boxedwine buscar os próprios arquivos) e
 * allow-pointer-lock (jogos que prendem o mouse). Nada de formulários,
 * pop-ups, modais ou navegação do topo.
 */
const SANDBOX = "allow-scripts allow-same-origin allow-pointer-lock";
const ALLOW = "autoplay; gamepad; fullscreen";

type Phase = "portao" | "preparando" | "carregando" | "rodando" | "fim" | "erro";
type Game = { arquivo: Blob; zip: boolean; exes: string[] };
type Bar = { got: number; total: number };

export interface ExePlayerProps {
  /** A página do Boxedwine no bucket, ou null se o emulador ainda não foi instalado no servidor. */
  launcher: string | null;
  /** Com conta: pode pedir a instalação do emulador (POST /api/jogar-exe/instalar). */
  canInstall: boolean;
  title: string;
  filename: string;
  size: number;
  /** /baixar/<id>: com ?url=1 devolve a URL curta do arquivo. */
  fileHref: string;
  back: { href: string; label: string };
}

async function fetchGame(href: string, size: number, onProgress: (b: Bar) => void): Promise<Blob> {
  const meta = await fetch(`${href}?url=1`, { cache: "no-store" });
  if (!meta.ok) {
    throw new Error(
      meta.status === 404
        ? "Este arquivo não está mais no ar."
        : meta.status === 429
          ? "Muitos downloads seguidos. Espere um minuto e tente de novo."
          : "O download está fora do ar agora. Tente de novo em instantes.",
    );
  }
  const { url } = (await meta.json()) as { url: string };
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error("Não deu para baixar o jogo do armazenamento.");
  const total = Number(res.headers.get("content-length")) || size;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress({ got, total });
  }
  return new Blob(chunks as BlobPart[]);
}

export function ExePlayer(p: ExePlayerProps) {
  const [launcher, setLauncher] = useState(p.launcher);
  const origin = launcher ? new URL(launcher).origin : "";
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [phase, setPhase] = useState<Phase>("portao");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<{ text: string; detail?: string } | null>(null);
  const [gameBar, setGameBar] = useState<Bar | null>(null);
  const [wineBar, setWineBar] = useState<Bar | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [exe, setExe] = useState("");
  // Cada partida é um iframe novo (trocar de .exe ou jogar de novo).
  const [run, setRun] = useState(0);
  const [frameReady, setFrameReady] = useState(false);
  const [full, setFull] = useState(false);
  const sent = useRef(-1);

  const fail = useCallback((text: string, detail?: string) => {
    setError({ text, detail });
    setPhase("erro");
  }, []);

  // Emulador ainda não instalado no servidor: pede a instalação e espera (só na primeira vez de cada versão).
  useEffect(() => {
    if (phase !== "preparando" || !p.canInstall) return;
    let stop = false;
    let timer: number | undefined;
    const ask = async () => {
      try {
        const res = await fetch("/api/jogar-exe/instalar", { method: "POST" });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; estado?: string; launcher?: string; error?: string } | null;
        if (stop) return;
        if (!res.ok || !data?.ok) return fail(data?.error ?? "Não deu para preparar o emulador agora. Tente de novo em instantes.");
        if (data.estado === "pronto" && data.launcher) {
          setLauncher(data.launcher);
          setPhase("carregando");
        } else timer = window.setTimeout(ask, 10_000);
      } catch {
        if (!stop) timer = window.setTimeout(ask, 10_000);
      }
    };
    void ask();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [phase, p.canInstall, fail]);

  // O arquivo do jogo: baixa uma vez por visita (já durante a preparação do emulador).
  const wantGame = phase === "carregando" || phase === "preparando";
  useEffect(() => {
    if (!wantGame || game) return;
    let stop = false;
    (async () => {
      try {
        const blob = await fetchGame(p.fileHref, p.size, (b) => !stop && setGameBar(b));
        if (stop) return;
        if (!/\.zip$/i.test(p.filename)) {
          setGame({ arquivo: blob, zip: false, exes: [p.filename] });
          setExe(p.filename);
          return;
        }
        const { entries } = await readZip(blob);
        const exes = exeCandidates(entries).map((e) => e.path);
        if (stop) return;
        if (exes.length === 0) return fail("Este zip não tem nenhum .exe para abrir.");
        setGame({ arquivo: blob, zip: true, exes });
        setExe(exes[0]);
      } catch (err) {
        if (stop) return;
        if (err instanceof ZipError) fail(`Não deu para abrir o zip: ${err.message}`);
        else if (err instanceof TypeError) fail("Não deu para baixar o jogo. Confira a conexão e tente de novo.");
        else fail(err instanceof Error ? err.message : "Não deu para baixar o jogo.");
      }
    })();
    return () => {
      stop = true;
    };
  }, [wantGame, game, p.fileHref, p.size, p.filename, fail]);

  // Mensagens da página do Boxedwine.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as ExeToParent | null;
      if (!d || d.vg !== "exe") return;
      if (d.estado === "pronto") setFrameReady(true);
      else if (d.estado === "runtime") setWineBar({ got: d.carregado, total: d.total });
      else if (d.estado === "iniciando") setStatus("Ligando o Windows emulado…");
      else if (d.estado === "rodando") {
        setPhase("rodando");
        iframeRef.current?.focus();
      } else if (d.estado === "fim") setPhase("fim");
      else if (d.estado === "erro") fail(d.mensagem, d.detalhe);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, fail]);

  // Iframe pronto e jogo baixado: entrega o jogo (uma vez por partida).
  useEffect(() => {
    if (!frameReady || !game || !exe || sent.current === run) return;
    sent.current = run;
    const msg: ExeToFrame = { vg: "exe", arquivo: game.arquivo, zip: game.zip, exe };
    iframeRef.current?.contentWindow?.postMessage(msg, origin);
  }, [frameReady, game, exe, run, origin]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frameRef.current?.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // Sem tela cheia (iPhone): segue na página.
    }
    iframeRef.current?.focus();
  }, []);

  const start = (nextExe?: string) => {
    if (nextExe) setExe(nextExe);
    setError(null);
    setStatus("");
    setFrameReady(false);
    setRun((r) => r + 1);
    setPhase(launcher ? "carregando" : "preparando");
  };

  const pct = (b: Bar | null) => (b && b.total ? Math.min(100, Math.round((b.got / b.total) * 100)) : 0);
  const playing = phase !== "portao";

  return (
    <div className="play-layout" style={{ "--arw": 4, "--arh": 3 } as React.CSSProperties}>
      <div className="play-frame exe-frame" ref={frameRef} data-full={full}>
        {launcher && playing && phase !== "erro" && phase !== "preparando" && (
          <iframe
            key={run}
            ref={iframeRef}
            src={launcher}
            title={`${p.title}, jogo para Windows`}
            sandbox={SANDBOX}
            allow={ALLOW}
            referrerPolicy="no-referrer"
            data-hidden={phase !== "rodando" || undefined}
          />
        )}
        {phase === "portao" && (
          <div className="play-gate">
            <p className="play-gate-size">
              <span className="num">{formatBytes(p.size)}</span>
            </p>
            <p>
              Experimental: um Windows emulado roda o jogo aqui no seu computador. Na primeira vez, o emulador baixa uns
              40 MB a mais.
            </p>
            <button type="button" className="btn btn--lime" onClick={() => start()}>
              <Play aria-hidden />
              Jogar no navegador
            </button>
          </div>
        )}
        {phase === "preparando" && (
          <div className="play-gate" role="status" aria-live="polite">
            {p.canInstall ? (
              <p>Preparando o emulador de Windows (só na primeira vez, cerca de 1 minuto)…</p>
            ) : (
              <>
                <p>O emulador de Windows está sendo preparado neste servidor. Volte em alguns minutos.</p>
                <button type="button" className="btn btn--lime" onClick={() => window.location.reload()}>
                  <RotateCcw aria-hidden />
                  Tentar de novo
                </button>
              </>
            )}
          </div>
        )}
        {phase === "carregando" && (
          <div className="play-gate exe-load" role="status" aria-live="polite">
            <div className="exe-step">
              <span>Jogo</span>
              <div className="exe-bar" aria-hidden>
                <span style={{ width: `${game ? 100 : pct(gameBar)}%` }} />
              </div>
              <span className="num">{game ? "pronto" : gameBar ? `${pct(gameBar)}%` : "…"}</span>
            </div>
            <div className="exe-step">
              <span>Emulador</span>
              <div className="exe-bar" aria-hidden>
                <span style={{ width: `${pct(wineBar)}%` }} />
              </div>
              <span className="num">{wineBar ? `${pct(wineBar)}%` : "…"}</span>
            </div>
            <p>{status || (game ? "Baixando o emulador…" : "Baixando o jogo…")}</p>
          </div>
        )}
        {phase === "fim" && (
          <div className="play-gate">
            <p>O jogo fechou.</p>
            <button type="button" className="btn btn--lime" onClick={() => start()}>
              <RotateCcw aria-hidden />
              Jogar de novo
            </button>
          </div>
        )}
        {phase === "erro" && error && (
          <div className="play-gate" role="alert">
            <p>{error.text}</p>
            {error.detail && (
              <details className="exe-detail">
                <summary>O que o emulador disse</summary>
                <pre>{error.detail}</pre>
              </details>
            )}
            <button type="button" className="btn btn--lime" onClick={() => start()}>
              <RotateCcw aria-hidden />
              Tentar de novo
            </button>
          </div>
        )}
      </div>

      <aside className="play-margin" aria-label="Sobre este jogo">
        <h1>{p.title}</h1>
        <p className="play-private">
          Experimental. Rodam bem jogos antigos e leves de 32 bits (GDI, DirectDraw, RPG Maker 2000/2003, GameMaker 8).
          Direct3D e OpenGL não rodam, e o progresso some ao fechar a página.
        </p>
        <dl className="play-facts">
          <div>
            <dt>Arquivo</dt>
            <dd className="exe-file">{p.filename}</dd>
          </div>
          <div>
            <dt>Tamanho</dt>
            <dd className="num">{formatBytes(p.size)}</dd>
          </div>
          <div>
            <dt>Emulador</dt>
            <dd>
              <a href={BOXEDWINE.source} target="_blank" rel="noopener noreferrer">
                Boxedwine {BOXEDWINE.version}
              </a>
            </dd>
          </div>
        </dl>
        {game && game.exes.length > 1 && (
          <div className="wb-field">
            <label className="field-label" htmlFor="exe-pick">
              Programa
            </label>
            <select id="exe-pick" className="wb-select" value={exe} onChange={(e) => start(e.target.value)}>
              {game.exes.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="play-actions">
          <button type="button" className="btn" onClick={toggleFull} disabled={phase !== "rodando"}>
            {full ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
            {full ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          <a className="btn btn--ghost" href={p.fileHref} rel="nofollow">
            <Download aria-hidden />
            Baixar o arquivo
          </a>
          <Link className="play-back" href={p.back.href}>
            <ArrowLeft aria-hidden />
            {p.back.label}
          </Link>
        </div>
      </aside>
    </div>
  );
}

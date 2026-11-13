"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Maximize, Minimize, Play } from "lucide-react";
import { formatBytes } from "@/lib/storage/limits";

/*
 * O jogo num iframe do bucket jogável (outra origem). O sandbox libera só
 * o que jogos usam:
 * - allow-scripts: o jogo é JavaScript/WebAssembly;
 * - allow-same-origin: dá ao jogo a origem DO MINIO (não a do site), sem a
 *   qual não há IndexedDB/localStorage (saves do Unity e do Godot), service
 *   worker (isolamento) nem fetch dos próprios arquivos. Como a origem é
 *   outra, isso não abre acesso ao site, aos cookies nem a esta página;
 * - allow-pointer-lock: câmera com o mouse;
 * - allow-forms, allow-modals: jogos HTML5 com campos e alert/prompt
 *   (o GameMaker usa prompt para get_string);
 * - allow-popups e allow-popups-to-escape-sandbox: links "visite meu site"
 *   abrem numa aba normal;
 * - allow-orientation-lock: travar paisagem no celular em tela cheia.
 * Fica de fora allow-top-navigation (o jogo não troca esta página por
 * outra) e allow-downloads (nada baixa sem pedir).
 */
const SANDBOX = [
  "allow-scripts",
  "allow-same-origin",
  "allow-pointer-lock",
  "allow-forms",
  "allow-modals",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-orientation-lock",
].join(" ");
const ALLOW = "fullscreen; gamepad; autoplay; cross-origin-isolated; accelerometer; gyroscope; xr-spatial-tracking";

type Coi = "preparando" | "isolado" | "sem-suporte" | "falhou" | null;

export interface PlayerProps {
  src: string;
  origin: string;
  title: string;
  engine: string;
  version: string | null;
  fileCount: number;
  totalSize: number;
  width: number | null;
  height: number | null;
  needsIsolation: boolean;
  isolatedMode: boolean;
  heavy: boolean;
  draftHref: string;
  buildId: string;
}

export function Player(p: PlayerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Pesado: espera o clique (o clique também libera o áudio). No modo
  // isolado a página acabou de recarregar por causa do jogo: já começa.
  const [started, setStarted] = useState(!p.heavy || p.isolatedMode);
  const [full, setFull] = useState(false);
  const [coi, setCoiState] = useState<Coi>(p.needsIsolation ? "preparando" : null);
  const coiRef = useRef<Coi>(coi);
  const setCoi = useCallback((c: Coi) => {
    coiRef.current = c;
    setCoiState(c);
  }, []);

  const w = p.width ?? 16;
  const h = p.height ?? 9;

  useEffect(() => {
    if (!p.needsIsolation || !started) return;
    const recoverKey = `vg-coi-recuperar:${p.buildId}`;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== p.origin || e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { vg?: string; estado?: string } | null;
      if (!data || data.vg !== "coi") return;
      if (data.estado === "isolado") {
        setCoi("isolado");
        try {
          sessionStorage.removeItem(recoverKey);
        } catch {}
      } else if (data.estado === "sem-suporte") {
        setCoi("sem-suporte");
      } else if (data.estado === "pronto") {
        if (p.isolatedMode) {
          setCoi("falhou");
        } else {
          // O service worker do build está ativo: recarrega com COEP (next.config.ts).
          const url = new URL(window.location.href);
          url.searchParams.set("isolado", "1");
          window.location.replace(url.toString());
        }
      }
    };
    window.addEventListener("message", onMessage);
    // No modo isolado, um iframe bloqueado (service worker apagado pelo
    // navegador) não manda mensagem nenhuma: volta uma vez para preparar.
    let timer: number | undefined;
    if (p.isolatedMode) {
      timer = window.setTimeout(() => {
        if (coiRef.current !== "preparando") return;
        let tried = false;
        try {
          tried = sessionStorage.getItem(recoverKey) === "1";
          sessionStorage.setItem(recoverKey, "1");
        } catch {}
        setCoi("falhou");
        if (!tried) {
          const url = new URL(window.location.href);
          url.searchParams.delete("isolado");
          window.location.replace(url.toString());
        }
      }, 9000);
    }
    return () => {
      window.removeEventListener("message", onMessage);
      if (timer) window.clearTimeout(timer);
    };
  }, [p.needsIsolation, p.isolatedMode, p.origin, p.buildId, started, setCoi]);

  // O iframe só nasce depois que o ouvinte de mensagens está pronto (o
  // script de isolamento do jogo pode responder antes da hidratação).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = useCallback(async () => {
    const el = frameRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // Sem tela cheia (iPhone): segue na página.
    }
    iframeRef.current?.focus();
  }, []);

  const start = () => {
    setStarted(true);
    requestAnimationFrame(() => iframeRef.current?.focus());
  };

  const sizeText = formatBytes(p.totalSize);

  return (
    <div className="play-layout" style={{ "--arw": w, "--arh": h } as React.CSSProperties}>
      <div className="play-frame" ref={frameRef} data-full={full}>
        {started && mounted ? (
          <iframe
            ref={iframeRef}
            src={p.src}
            title={`${p.title}, prévia jogável`}
            sandbox={SANDBOX}
            allow={ALLOW}
            referrerPolicy="no-referrer"
            onLoad={() => iframeRef.current?.focus()}
          />
        ) : !started ? (
          <div className="play-gate">
            <p className="play-gate-size">
              <span className="num">{sizeText}</span>
            </p>
            <p>
              Este jogo baixa {sizeText} ao abrir. No celular, prefira o Wi-Fi.
            </p>
            <button type="button" className="btn btn--lime" onClick={start}>
              <Play aria-hidden />
              Jogar
            </button>
          </div>
        ) : null}
      </div>

      <aside className="play-margin" aria-label="Sobre esta prévia">
        <h1>{p.title}</h1>
        <p className="play-private">Prévia do rascunho: esta página só abre para você. Os arquivos do jogo ficam num endereço longo e impossível de adivinhar, mas quem receber o link de “Abrir em aba própria” consegue jogar.</p>
        <dl className="play-facts">
          <div>
            <dt>Motor</dt>
            <dd>
              {p.engine}
              {p.version ? ` ${p.version}` : ""}
            </dd>
          </div>
          <div>
            <dt>Arquivos</dt>
            <dd className="num">{p.fileCount.toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt>Tamanho</dt>
            <dd className="num">{sizeText}</dd>
          </div>
          <div>
            <dt>Tela</dt>
            <dd className="num">{p.width && p.height ? `${p.width} × ${p.height}` : "Livre, 16:9"}</dd>
          </div>
          {p.needsIsolation && (
            <div>
              <dt>Threads</dt>
              <dd className="play-coi" data-state={coi ?? undefined} aria-live="polite">
                {coi === "isolado"
                  ? "Isolamento ligado"
                  : coi === "sem-suporte"
                    ? "Este navegador não liga o isolamento"
                    : coi === "falhou"
                      ? "O isolamento não ligou aqui"
                      : started
                        ? "Preparando o isolamento…"
                        : "Liga ao começar"}
              </dd>
            </div>
          )}
        </dl>
        {(coi === "falhou" || coi === "sem-suporte") && (
          <p className="play-help">
            Abra o jogo em aba própria: lá o isolamento recarrega a página uma vez e costuma funcionar. Se nem assim, o
            navegador não oferece SharedArrayBuffer.
          </p>
        )}
        <div className="play-actions">
          <button type="button" className="btn" onClick={toggleFull} disabled={!started}>
            {full ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
            {full ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          <a className="btn btn--ghost" href={p.src} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            Abrir em aba própria
          </a>
          <Link className="play-back" href={p.draftHref}>
            <ArrowLeft aria-hidden />
            Voltar ao rascunho
          </Link>
        </div>
      </aside>
    </div>
  );
}

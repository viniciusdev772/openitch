/*
 * Motor de envio no navegador, sem bibliotecas: arquivo de até 3 GB direto
 * para o MinIO com URLs pré-assinadas, em partes paralelas, retomável.
 *
 * Como fica rápido e robusto (fontes no relatório da frente "upload"):
 * - Partes de 5 MiB (Blob.slice: nada de carregar o arquivo na memória; o
 *   navegador lê do disco enquanto envia). Pequenas de propósito: o proxy do
 *   MinIO corta requisições com mais de 60 s (ver UPLOAD_PART_SIZE).
 * - Várias partes ao mesmo tempo ("escalar conexões na horizontal", guia de
 *   desempenho do S3). Começa com 2 e ajusta pela vazão medida: sobe enquanto
 *   a vazão melhora, cai pela metade quando a rede dá erro, e nunca passa do
 *   número que deixa cada parte terminar em ~20 s na velocidade medida.
 * - Repetição com espera exponencial e variação aleatória em erro de rede,
 *   5xx, 408 e 429; parte travada sem progresso é abortada e repetida.
 * - URLs assinadas em lote (12 por pedido), renovadas antes de vencer.
 * - SHA-256 de cada parte (Web Crypto), assinado na URL: o MinIO confere os
 *   bytes e recusa parte corrompida. Calculado uma parte por vez, antes de
 *   pedir a URL, para não segurar várias partes na memória.
 * - Progresso por bytes com XMLHttpRequest (upload.onprogress; fetch não dá
 *   progresso de envio), velocidade média móvel e tempo restante.
 * - Pausar, retomar, cancelar; depois de recarregar a página, o mesmo
 *   arquivo (nome, tamanho, data de modificação) continua de onde parou: o
 *   servidor lista as partes que o MinIO já tem.
 */

import { fingerprint, partCountFor, partSizeFor, REQUEST_BUDGET_S, SIGN_BATCH, type DownloadPlatform } from "./rules";

export type UploadPhase =
  | "preparando"
  | "enviando"
  | "sem-rede"
  | "pausado"
  | "concluindo"
  | "pronto"
  | "erro"
  | "cancelado";

/** O mesmo formato que o servidor devolve (FileView em server.ts). */
export interface RemoteFile {
  id: string;
  platform: DownloadPlatform;
  filename: string;
  size: number;
  status: "enviando" | "pronto" | "cancelado";
  mode: "single" | "multipart";
  partSize: number;
  partCount: number;
  checksum: boolean;
  lastModified: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface UploadSnapshot {
  localId: string;
  uploadId: string | null;
  name: string;
  size: number;
  platform: DownloadPlatform;
  phase: UploadPhase;
  /** Bytes já no MinIO (partes concluídas + partes em andamento). */
  loaded: number;
  /** Bytes por segundo (média móvel). */
  speed: number;
  /** Segundos restantes, ou null enquanto não dá para estimar. */
  eta: number | null;
  error: string | null;
  /** Código do erro (do servidor ou do motor), para a tela oferecer a saída certa. */
  errorCode: string | null;
  concurrency: number;
  file: RemoteFile | null;
}

interface SignedPart {
  n: number;
  url: string;
  headers: Record<string, string>;
}

interface Part {
  n: number;
  start: number;
  end: number;
  done: boolean;
  inflight: boolean;
  loaded: number;
  sha256: string | null;
  url: string | null;
  headers: Record<string, string>;
  urlExpires: number;
  attempts: number;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class PartError extends Error {
  kind: "retry" | "resign" | "rehash" | "fatal" | "aborted";
  status: number;
  constructor(kind: PartError["kind"], status: number, message: string) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const MIN_CONCURRENCY = 1;
/** Começa devagar: a velocidade real ainda não é conhecida. */
const START_CONCURRENCY = 2;
const MAX_CONCURRENCY_H1 = 6;
const MAX_CONCURRENCY_H2 = 10;
const MAX_ATTEMPTS = 10;
const STALL_MS = 45_000;
const CONNECT_MS = 120_000;
const URL_MARGIN_MS = 2 * 60_000;
const TICK_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1)) * (0.5 + Math.random() / 2);

/* ------------------------------------------------------------------ */
/* Pedidos ao site                                                     */
/* ------------------------------------------------------------------ */

const NETWORK = "Sem conexão com o site. Confira a internet; o envio continua quando a rede voltar.";

/** JSON para as rotas /api/envios, com repetição em falha passageira. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}, tries = 4): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    let res: Response;
    try {
      res = await fetch(path, {
        method: init.method ?? "GET",
        headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch (err) {
      last = new ApiError(0, "rede", NETWORK);
      void err;
      if (attempt < tries) await sleep(backoff(attempt));
      continue;
    }
    let data: { ok?: boolean; error?: string; code?: string } & Record<string, unknown> = {};
    try {
      data = await res.json();
    } catch {
      /* corpo vazio */
    }
    if (res.ok && data.ok !== false) return data as T;
    const err = new ApiError(res.status, data.code ?? "servidor", data.error ?? "O servidor não respondeu como esperado.");
    if ((res.status >= 500 || res.status === 408) && attempt < tries) {
      last = err;
      await sleep(backoff(attempt));
      continue;
    }
    throw err;
  }
  throw last instanceof Error ? last : new ApiError(0, "rede", NETWORK);
}

/* ------------------------------------------------------------------ */
/* Memória local para retomar depois de recarregar                    */
/* ------------------------------------------------------------------ */

const STORE = "vibegames:envios:v1";

export interface PendingRecord {
  uploadId: string;
  projectId: string;
  platform: DownloadPlatform;
  name: string;
  size: number;
  lastModified: number;
  at: number;
}

export function readPending(): PendingRecord[] {
  try {
    const raw = localStorage.getItem(STORE);
    const list = raw ? (JSON.parse(raw) as PendingRecord[]) : [];
    const week = Date.now() - 7 * 24 * 3600 * 1000;
    return Array.isArray(list) ? list.filter((r) => r && typeof r.uploadId === "string" && r.at > week) : [];
  } catch {
    return [];
  }
}

function writePending(list: PendingRecord[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list.slice(-50)));
  } catch {
    /* modo privado ou cota cheia: retomar ainda funciona pelo servidor */
  }
}

function rememberPending(r: PendingRecord) {
  writePending([...readPending().filter((x) => x.uploadId !== r.uploadId), r]);
}

export function forgetPending(uploadId: string) {
  writePending(readPending().filter((x) => x.uploadId !== uploadId));
}

/** Envio aberto que corresponde a este arquivo, se a página foi recarregada no meio. */
export function findPendingFor(projectId: string, platform: DownloadPlatform, file: File): PendingRecord | null {
  const fp = fingerprint(file);
  return readPending().find((r) => r.projectId === projectId && r.platform === platform && fingerprint(r) === fp) ?? null;
}

/* ------------------------------------------------------------------ */
/* Soma de verificação                                                 */
/* ------------------------------------------------------------------ */

export function checksumSupported(): boolean {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle) && typeof crypto.subtle.digest === "function";
}

async function sha256Base64(blob: Blob): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  let bin = "";
  for (let i = 0; i < digest.length; i++) bin += String.fromCharCode(digest[i]);
  return btoa(bin);
}

/** Protocolo da conexão com o MinIO (h2 permite mais partes em paralelo). */
function protocolOf(url: string): string {
  try {
    const host = new URL(url).host;
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].name.includes(host) && entries[i].nextHopProtocol) return entries[i].nextHopProtocol;
    }
  } catch {
    /* sem Resource Timing */
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* O envio                                                             */
/* ------------------------------------------------------------------ */

let localSeq = 0;

export interface UploaderOptions {
  projectId: string;
  platform: DownloadPlatform;
  file: File;
  onChange: (s: UploadSnapshot) => void;
  /** Envio aberto a retomar (depois de recarregar a página). */
  resumeId?: string | null;
}

export class Uploader {
  readonly localId: string;
  private opts: UploaderOptions;
  private file: File;
  private uploadId: string | null = null;
  private remote: RemoteFile | null = null;
  private parts: Part[] = [];
  private checksum = false;
  private phase: UploadPhase = "preparando";
  private error: string | null = null;
  private errorCode: string | null = null;
  private target = START_CONCURRENCY;
  private maxConcurrency = MAX_CONCURRENCY_H1;
  private inflight = new Map<number, XMLHttpRequest>();
  private signing: Promise<void> | null = null;
  private completedBytes = 0;
  private sentTotal = 0;
  private speed = 0;
  private lastSample = { t: 0, sent: 0 };
  private tuning = { t: 0, sent: 0, rate: 0 };
  private ticker: ReturnType<typeof setInterval> | null = null;
  private finishing = false;
  private completeRounds = 0;
  private onlineWait: Promise<void> | null = null;
  /** Parado de propósito (pausa, cancelamento, erro): XHR abortado não é repetido. */
  private stopped = false;

  constructor(opts: UploaderOptions) {
    this.opts = opts;
    this.file = opts.file;
    this.localId = `envio-${Date.now().toString(36)}-${++localSeq}`;
  }

  snapshot(): UploadSnapshot {
    const inflightLoaded = this.parts.reduce((sum, p) => sum + (p.inflight && !p.done ? p.loaded : 0), 0);
    const loaded = Math.min(this.file.size, this.completedBytes + inflightLoaded);
    const remaining = this.file.size - loaded;
    return {
      localId: this.localId,
      uploadId: this.uploadId,
      name: this.file.name,
      size: this.file.size,
      platform: this.opts.platform,
      phase: this.phase,
      loaded: this.phase === "pronto" ? this.file.size : loaded,
      speed: this.phase === "enviando" ? this.speed : 0,
      eta: this.phase === "enviando" && this.speed > 1024 ? Math.ceil(remaining / this.speed) : null,
      error: this.error,
      errorCode: this.errorCode,
      concurrency: this.target,
      file: this.remote,
    };
  }

  private emit() {
    this.opts.onChange(this.snapshot());
  }

  private setPhase(phase: UploadPhase, error: string | null = null, code: string | null = null) {
    this.phase = phase;
    this.error = error;
    this.errorCode = code;
    if (phase === "enviando") this.startTicker();
    else if (phase !== "sem-rede") this.stopTicker();
    this.emit();
  }

  private startTicker() {
    if (this.ticker) return;
    const now = performance.now();
    this.lastSample = { t: now, sent: this.sentTotal };
    this.tuning = { t: now, sent: this.sentTotal, rate: 0 };
    this.ticker = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  private tick() {
    const now = performance.now();
    const dt = (now - this.lastSample.t) / 1000;
    if (dt > 0) {
      const inst = (this.sentTotal - this.lastSample.sent) / dt;
      // Média móvel exponencial (~5 s): estável sem demorar a reagir.
      this.speed = this.speed ? this.speed * 0.9 + inst * 0.1 : inst;
      this.lastSample = { t: now, sent: this.sentTotal };
    }
    this.tune(now);
    this.emit();
  }

  /** Sobe uma parte em paralelo enquanto a vazão melhora; desce se piorar. */
  private tune(now: number) {
    const elapsed = now - this.tuning.t;
    if (elapsed < 6000) return;
    const rate = ((this.sentTotal - this.tuning.sent) / elapsed) * 1000;
    const prev = this.tuning.rate;
    if (prev === 0 || rate > prev * 1.08) {
      if (this.target < this.maxConcurrency) this.target++;
    } else if (rate < prev * 0.8 && this.target > MIN_CONCURRENCY) {
      this.target--;
    }
    // Teto pela velocidade: com N partes dividindo a banda, cada uma leva
    // N × tamanho / velocidade. Isso tem de caber em REQUEST_BUDGET_S, senão o
    // proxy corta a requisição aos 60 s e a parte recomeça do zero.
    if (rate > 0 && this.remote) {
      const cap = Math.max(MIN_CONCURRENCY, Math.floor((rate * REQUEST_BUDGET_S) / this.remote.partSize));
      if (this.target > cap) this.target = cap;
    }
    this.tuning = { t: now, sent: this.sentTotal, rate };
    this.pump();
  }

  /* -------------------------------------------------------------- */

  async start(): Promise<void> {
    this.stopped = false;
    try {
      this.setPhase("preparando");
      this.checksum = checksumSupported();
      const size = this.file.size;
      const partSize = partSizeFor(size);
      const count = partCountFor(size, partSize);

      let state: { file: RemoteFile; parts: { n: number; size: number }[]; urls?: SignedPart[] } | null = null;
      if (this.opts.resumeId) {
        try {
          state = await api(`/api/envios/${encodeURIComponent(this.opts.resumeId)}`);
          if (!state || state.file.status !== "enviando" || state.file.size !== size || state.file.filename !== this.file.name) state = null;
        } catch {
          state = null;
        }
        if (!state) forgetPending(this.opts.resumeId);
        else this.checksum = state.file.checksum && checksumSupported();
      }
      if (!state) {
        const wholeSha = count === 1 && this.checksum ? await sha256Base64(this.file) : undefined;
        state = await api("/api/envios", {
          method: "POST",
          body: {
            projectId: this.opts.projectId,
            platform: this.opts.platform,
            filename: this.file.name,
            size,
            lastModified: this.file.lastModified,
            checksum: this.checksum,
            sha256: wholeSha,
          },
        });
        if (!state) throw new ApiError(500, "servidor", "Resposta vazia do servidor.");
        if (state.file.checksum && !this.checksum) throw new ApiError(400, "checksum", "Este navegador não calcula a soma de verificação.");
        this.checksum = state.file.checksum;
        if (count === 1 && wholeSha) this.wholeSha = wholeSha;
      }

      const remote = state.file;
      this.remote = remote;
      this.uploadId = remote.id;
      rememberPending({
        uploadId: remote.id,
        projectId: this.opts.projectId,
        platform: this.opts.platform,
        name: this.file.name,
        size,
        lastModified: this.file.lastModified,
        at: Date.now(),
      });

      const done = new Set(state.parts.map((p) => p.n));
      this.parts = [];
      for (let n = 1; n <= remote.partCount; n++) {
        const start = (n - 1) * remote.partSize;
        const end = Math.min(size, start + remote.partSize);
        this.parts.push({ n, start, end, done: done.has(n), inflight: false, loaded: 0, sha256: null, url: null, headers: {}, urlExpires: 0, attempts: 0 });
      }
      this.completedBytes = this.parts.reduce((s, p) => s + (p.done ? p.end - p.start : 0), 0);
      if (state.urls?.length) this.applyUrls(state.urls, Date.now() + 55 * 60_000);
      if (this.wholeSha && this.parts[0]) this.parts[0].sha256 = this.wholeSha;

      this.setPhase("enviando");
      this.pump();
    } catch (err) {
      this.fail(err);
    }
  }

  private wholeSha: string | null = null;

  pause() {
    if (this.phase !== "enviando" && this.phase !== "sem-rede") return;
    this.stopped = true;
    this.setPhase("pausado");
    for (const xhr of this.inflight.values()) xhr.abort();
  }

  resume() {
    if (this.phase === "pausado") {
      this.stopped = false;
      this.setPhase("enviando");
      this.pump();
    } else if (this.phase === "erro") {
      this.error = null;
      if (!this.uploadId) {
        void this.start();
        return;
      }
      for (const p of this.parts) p.attempts = 0;
      this.stopped = false;
      this.setPhase("enviando");
      this.pump();
    }
  }

  async cancel() {
    const prev = this.phase;
    this.stopped = true;
    this.setPhase("cancelado");
    for (const xhr of this.inflight.values()) xhr.abort();
    if (this.uploadId && prev !== "pronto") {
      forgetPending(this.uploadId);
      try {
        await api(`/api/envios/${encodeURIComponent(this.uploadId)}`, { method: "DELETE", body: {} });
      } catch {
        /* o servidor descarta envios parados em 24 h; o MinIO também */
      }
    }
  }

  /** Para tudo sem avisar o servidor (o componente saiu da tela). */
  detach() {
    this.stopped = true;
    this.stopTicker();
    for (const xhr of this.inflight.values()) xhr.abort();
    this.opts.onChange = () => undefined;
  }

  get active() {
    return this.phase === "preparando" || this.phase === "enviando" || this.phase === "sem-rede" || this.phase === "concluindo";
  }

  /* -------------------------------------------------------------- */

  private fail(err: unknown) {
    this.stopped = true;
    for (const xhr of this.inflight.values()) xhr.abort();
    if (err instanceof ApiError) {
      this.setPhase("erro", err.message, err.code);
      if (["cota", "tamanho", "estado", "nao_encontrado", "plataforma", "nome", "limite"].includes(err.code) && this.uploadId) {
        forgetPending(this.uploadId);
      }
    } else if (err instanceof PartError) {
      this.setPhase("erro", err.message, err.kind === "fatal" && err.status === 404 ? "expirado" : "envio");
    } else {
      this.setPhase("erro", "Algo deu errado no envio. Tente retomar.", "envio");
      console.error(err);
    }
  }

  private pump() {
    if (this.phase !== "enviando") return;
    while (this.inflight.size < this.target) {
      const next = this.parts.find((p) => !p.done && !p.inflight);
      if (!next) break;
      void this.runPart(next);
    }
    if (!this.finishing && this.parts.length && this.parts.every((p) => p.done)) void this.finish();
  }

  private async runPart(part: Part) {
    part.inflight = true;
    const placeholder = new XMLHttpRequest();
    this.inflight.set(part.n, placeholder);
    try {
      for (;;) {
        if (this.stopped) throw new PartError("aborted", 0, "parado");
        try {
          await this.ensureUrl(part);
          this.prefetchUrls();
          await this.sendPart(part);
          part.done = true;
          part.loaded = 0;
          this.completedBytes += part.end - part.start;
          part.attempts = 0;
          return;
        } catch (err) {
          if (!(err instanceof PartError)) throw err;
          if (err.kind === "aborted") throw err;
          if (err.kind === "fatal") throw err;
          part.loaded = 0;
          if (err.kind === "resign") {
            part.url = null;
            if (++part.attempts > MAX_ATTEMPTS) throw err;
            continue;
          }
          if (err.kind === "rehash") {
            part.sha256 = null;
            part.url = null;
            if (++part.attempts > 3) throw new PartError("fatal", err.status, "O arquivo mudou no disco durante o envio. Escolha o arquivo de novo.");
            continue;
          }
          // retry: rede, 5xx, 408, 429, parte travada.
          this.target = Math.max(MIN_CONCURRENCY, Math.floor(this.target / 2));
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            await this.waitOnline();
            continue;
          }
          if (++part.attempts > MAX_ATTEMPTS) throw err;
          await sleep(backoff(part.attempts));
        }
      }
    } catch (err) {
      part.loaded = 0;
      if (err instanceof PartError && err.kind === "aborted") return;
      if (this.phase === "enviando" || this.phase === "sem-rede") this.fail(err);
    } finally {
      part.inflight = false;
      this.inflight.delete(part.n);
      this.pump();
    }
  }

  private waitOnline(): Promise<void> {
    if (!this.onlineWait) {
      this.setPhase("sem-rede", NETWORK, "rede");
      this.onlineWait = new Promise<void>((resolve) => {
        const done = () => {
          window.removeEventListener("online", done);
          this.onlineWait = null;
          if (this.phase === "sem-rede") this.setPhase("enviando");
          resolve();
          this.pump();
        };
        window.addEventListener("online", done);
      });
    }
    return this.onlineWait;
  }

  private applyUrls(urls: SignedPart[], expires: number) {
    for (const u of urls) {
      const p = this.parts[u.n - 1];
      if (!p) continue;
      p.url = u.url;
      p.headers = u.headers ?? {};
      p.urlExpires = expires;
    }
  }

  private urlValid(p: Part) {
    return Boolean(p.url) && p.urlExpires - Date.now() > URL_MARGIN_MS;
  }

  private async ensureUrl(part: Part) {
    while (!this.urlValid(part)) {
      if (this.stopped) throw new PartError("aborted", 0, "parado");
      if (!this.signing) this.signing = this.signBatch(part).finally(() => (this.signing = null));
      await this.signing;
    }
  }

  /** Assina com antecedência quando restam poucas URLs válidas. */
  private prefetchUrls() {
    if (this.signing) return;
    const ready = this.parts.filter((p) => !p.done && !p.inflight && this.urlValid(p)).length;
    if (ready >= this.target) return;
    const next = this.parts.find((p) => !p.done && !p.inflight && !this.urlValid(p));
    if (!next) return;
    this.signing = this.signBatch(next)
      .catch(() => undefined)
      .finally(() => (this.signing = null));
  }

  private async signBatch(first: Part) {
    const batch: Part[] = [first];
    const limit = this.parts.some((p) => p.done || p.url) ? SIGN_BATCH : Math.max(this.target, 4);
    for (const p of this.parts) {
      if (batch.length >= limit) break;
      if (p !== first && !p.done && !this.urlValid(p)) batch.push(p);
    }
    if (this.checksum) {
      for (const p of batch) {
        if (!p.sha256) p.sha256 = await sha256Base64(this.file.slice(p.start, p.end));
      }
    }
    if (this.stopped) throw new PartError("aborted", 0, "parado");
    const res = await api<{ urls: SignedPart[]; expiresAt: string }>(`/api/envios/${encodeURIComponent(this.uploadId as string)}/partes`, {
      method: "POST",
      body: { parts: batch.map((p) => (this.checksum ? { n: p.n, sha256: p.sha256 } : { n: p.n })) },
    }).catch((err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 0 || err.status >= 500) throw new PartError("retry", err.status, err.message);
        throw err;
      }
      throw err;
    });
    // Margem para relógio adiantado/atrasado: confia no prazo do servidor menos 5 min.
    const exp = Math.min(Date.parse(res.expiresAt) || 0, Date.now() + 60 * 60_000) - 5 * 60_000;
    this.applyUrls(res.urls, Math.max(exp, Date.now() + URL_MARGIN_MS + 60_000));
  }

  private sendPart(part: Part): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.stopped) {
        reject(new PartError("aborted", 0, "parado"));
        return;
      }
      const xhr = new XMLHttpRequest();
      this.inflight.set(part.n, xhr);
      let lastProgress = 0;
      let started = false;
      const opened = performance.now();
      const watchdog = setInterval(() => {
        const now = performance.now();
        if ((started && now - lastProgress > STALL_MS) || (!started && now - opened > CONNECT_MS)) xhr.abort();
      }, 5000);
      let aborted = false;
      const cleanup = () => clearInterval(watchdog);

      xhr.open("PUT", part.url as string, true);
      for (const [k, v] of Object.entries(part.headers)) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => {
        started = true;
        lastProgress = performance.now();
        const delta = e.loaded - part.loaded;
        if (delta > 0) this.sentTotal += delta;
        part.loaded = e.loaded;
      };
      xhr.onabort = () => {
        aborted = true;
        cleanup();
        reject(this.stopped ? new PartError("aborted", 0, "parado") : new PartError("retry", 0, "Parte travada; repetindo."));
      };
      xhr.onerror = () => {
        cleanup();
        reject(new PartError("retry", 0, NETWORK));
      };
      xhr.onload = () => {
        cleanup();
        if (aborted) return;
        const s = xhr.status;
        if (s >= 200 && s < 300) {
          if (!this.maxConcurrencyKnown) this.detectProtocol(part.url as string);
          resolve();
          return;
        }
        const body = xhr.responseText || "";
        const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1] ?? "";
        if (s === 403 && /expired|AccessDenied|RequestTimeTooSkewed|SignatureDoesNotMatch/i.test(code + body)) {
          reject(new PartError("resign", s, "URL vencida; renovando."));
        } else if (s === 400 && /Checksum|BadDigest|InvalidDigest/i.test(code)) {
          reject(new PartError("rehash", s, "Soma de verificação não conferiu; repetindo."));
        } else if (s === 404 && /NoSuchUpload/i.test(code)) {
          reject(new PartError("fatal", 404, "Esse envio expirou no armazenamento. Comece de novo."));
        } else if (s >= 500 || s === 408 || s === 429) {
          reject(new PartError("retry", s, "O armazenamento está ocupado; repetindo."));
        } else {
          reject(new PartError("fatal", s, `O armazenamento recusou a parte (${s}${code ? " " + code : ""}).`));
        }
      };
      xhr.send(this.file.slice(part.start, part.end));
    });
  }

  private maxConcurrencyKnown = false;
  private detectProtocol(url: string) {
    const proto = protocolOf(url);
    if (!proto) return;
    this.maxConcurrencyKnown = true;
    this.maxConcurrency = /^h[23]/.test(proto) ? MAX_CONCURRENCY_H2 : MAX_CONCURRENCY_H1;
  }

  private async finish() {
    this.finishing = true;
    this.setPhase("concluindo");
    try {
      const res = await api<{ file?: RemoteFile; missing?: number[] }>(`/api/envios/${encodeURIComponent(this.uploadId as string)}/concluir`, {
        method: "POST",
        body: {},
      });
      if (res.missing?.length && ++this.completeRounds <= 3) {
        for (const n of res.missing) {
          const p = this.parts[n - 1];
          if (p && p.done) {
            p.done = false;
            p.url = null;
            this.completedBytes -= p.end - p.start;
          }
        }
        this.finishing = false;
        this.setPhase("enviando");
        this.pump();
        return;
      }
      if (!res.file) throw new ApiError(409, "incompleto", "O armazenamento não confirmou todas as partes. Tente retomar.");
      this.remote = res.file;
      forgetPending(res.file.id);
      this.setPhase("pronto");
    } catch (err) {
      this.finishing = false;
      this.fail(err);
    }
  }
}

/** "1,2 GB", "350 MB", "12 KB" */
export function formatSize(n: number): string {
  const GiB = 1024 ** 3;
  const MiB = 1024 ** 2;
  if (n <= 0) return "0 MB";
  if (n >= GiB) return `${(n / GiB).toFixed(2).replace(".", ",")} GB`;
  if (n >= MiB) return `${(n / MiB).toFixed(n >= 100 * MiB ? 0 : 1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** "12,4 MB/s" */
export function formatSpeed(bps: number): string {
  if (!bps || !Number.isFinite(bps)) return "—";
  return `${formatSize(bps)}/s`;
}

/** "3 min 20 s", "45 s", "1 h 05 min" */
export function formatEta(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return "calculando";
  if (s < 60) return `${Math.max(1, s)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
}

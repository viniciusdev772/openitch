/*
 * Envio de um build de navegador, todo no NAVEGADOR: lê o zip (ou a pasta),
 * reconhece o motor, prepara os arquivos e manda cada um direto para o MinIO
 * por URLs pré-assinadas pelo servidor. A Vercel só recebe pedidos pequenos
 * (JSON com caminhos e tamanhos); nenhum byte do jogo passa por ela.
 *
 * - Arquivos pequenos: PUT único, vários ao mesmo tempo (FILE_CONCURRENCY),
 *   URLs assinadas em lotes pouco antes de usar.
 * - Arquivos grandes (> BUILD_SINGLE_MAX): multipart em partes de
 *   BUILD_PART_SIZE, várias partes ao mesmo tempo; do zip, o arquivo é
 *   descompactado em fluxo e cortado em partes, sem ficar inteiro na memória.
 * - Um teto de bytes em trânsito (MAX_BYTES_IN_FLIGHT) segura a memória.
 * - Progresso por bytes (XMLHttpRequest dá o progresso do envio), cancelar
 *   (aborta tudo e apaga o que já subiu) e refazer só o que falhou.
 */

import { commonRoot, cleanBuildPath, COI_FILE, dirOf, isJunk } from "./paths";
import { detectBuild, ruffleHtml, sniffTargets, wasmUsesSharedMemory, type BuildEngine, type Detection, type Sniffed } from "./detect";
import { injectCoiScript, COI_SCRIPT } from "./coi";
import { sniffUnityweb } from "./mime";
import { readZip, entryBlob, entryHead, openEntry, readHead, chunkStream, ZipError, type ZipEntry } from "./zip";
import { MAX_WEB_BUILD_BYTES, MAX_WEB_BUILD_FILES, formatBytes } from "@/lib/storage/limits";
import { BUILD_PART_CONCURRENCY, BUILD_PART_SIZE, BUILD_SINGLE_MAX, FILE_CONCURRENCY, MAX_BYTES_IN_FLIGHT, SIGN_BATCH } from "./config";

/* ------------------------------------------------------------------ */
/* Fontes de arquivo                                                   */
/* ------------------------------------------------------------------ */

export interface SourceFile {
  path: string;
  size: number;
  /** O arquivo inteiro como Blob (para os pequenos; os do zip com deflate são descompactados na memória). */
  blob(): Promise<Blob>;
  /** Blob recortável sem cópia (pasta, zip sem compressão, gerados) ou fluxo descompactado. */
  open(): Promise<Blob | ReadableStream<Uint8Array>>;
  /** Primeiros bytes descompactados. */
  head(max: number): Promise<Uint8Array>;
}

export class IngestError extends Error {}

function fromBlob(path: string, blob: Blob): SourceFile {
  return {
    path,
    size: blob.size,
    blob: async () => blob,
    open: async () => blob,
    head: async (max) => new Uint8Array(await blob.slice(0, max).arrayBuffer()),
  };
}

function fromZipEntry(zip: Blob, entry: ZipEntry, path: string): SourceFile {
  return {
    path,
    size: entry.size,
    blob: () => entryBlob(zip, entry),
    open: async () => (entry.method === 0 ? entryBlob(zip, entry) : openEntry(zip, entry)),
    head: (max) => entryHead(zip, entry, max),
  };
}

function stripRoot<T extends { path: string }>(items: T[]): T[] {
  const root = commonRoot(items.map((i) => i.path));
  return root ? items.map((i) => ({ ...i, path: i.path.slice(root.length) })) : items;
}

/** Abre um .zip escolhido ou solto pelo criador. */
export async function ingestZip(file: File): Promise<SourceFile[]> {
  try {
    const { entries } = await readZip(file);
    if (entries.length === 0) throw new IngestError("O zip está vazio.");
    const root = commonRoot(entries.map((e) => e.path));
    return entries.map((e) => fromZipEntry(file, e, e.path.slice(root.length)));
  } catch (err) {
    if (err instanceof ZipError) throw new IngestError(err.message);
    throw err;
  }
}

/** Arquivos de uma pasta (input webkitdirectory ou pasta solta), com o caminho relativo. */
export function ingestFiles(items: { path: string; file: File }[]): SourceFile[] {
  const out: { path: string; file: File }[] = [];
  let total = 0;
  for (const item of items) {
    const clean = cleanBuildPath(item.path);
    if (!clean) throw new IngestError(`Caminho recusado: ${JSON.stringify(item.path.slice(0, 120))}.`);
    if (isJunk(clean)) continue;
    total += item.file.size;
    out.push({ path: clean, file: item.file });
  }
  if (out.length === 0) throw new IngestError("A pasta está vazia.");
  if (out.length > MAX_WEB_BUILD_FILES) throw new IngestError(`A pasta tem mais de ${MAX_WEB_BUILD_FILES.toLocaleString("pt-BR")} arquivos, o máximo aceito.`);
  if (total > MAX_WEB_BUILD_BYTES) throw new IngestError(`A pasta passa do limite de ${formatBytes(MAX_WEB_BUILD_BYTES)}.`);
  return stripRoot(out).map((i) => fromBlob(i.path, i.file));
}

/** Arquivos de um <input type="file" webkitdirectory>. */
export function ingestDirectoryInput(list: ArrayLike<File>): SourceFile[] {
  return ingestFiles(Array.from(list).map((file) => ({ path: file.webkitRelativePath || file.name, file })));
}

/** O que foi solto na área de envio: um .zip ou uma pasta (DataTransferItem.webkitGetAsEntry). */
export async function ingestDrop(dt: DataTransfer): Promise<SourceFile[]> {
  const entries = [...dt.items]
    .filter((i) => i.kind === "file")
    .map((i) => i.webkitGetAsEntry?.() ?? null)
    .filter((e): e is FileSystemEntry => e !== null);
  if (entries.length === 1 && entries[0].isFile && /\.zip$/i.test(entries[0].name)) {
    const file = dt.files[0];
    if (file) return ingestZip(file);
  }
  if (entries.length === 0) {
    const file = dt.files[0];
    if (file && /\.zip$/i.test(file.name)) return ingestZip(file);
    throw new IngestError("Solte um .zip ou uma pasta com o build.");
  }
  const files: { path: string; file: File }[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (files.length > MAX_WEB_BUILD_FILES) throw new IngestError(`A pasta tem mais de ${MAX_WEB_BUILD_FILES.toLocaleString("pt-BR")} arquivos.`);
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      files.push({ path: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (batch.length === 0) break;
        for (const child of batch) await walk(child, prefix + entry.name + "/");
      }
    }
  };
  for (const e of entries) await walk(e, "");
  return ingestFiles(files);
}

/* ------------------------------------------------------------------ */
/* Reconhecimento                                                      */
/* ------------------------------------------------------------------ */

const TEXT_HEAD = 512 * 1024;
const WASM_HEAD = 2 * 1024 * 1024;

async function decompressHead(src: SourceFile, format: string): Promise<Uint8Array | null> {
  let ds: DecompressionStream;
  try {
    ds = new DecompressionStream(format as CompressionFormat);
  } catch {
    return null; // "brotli" ainda não existe em todos os navegadores
  }
  const raw = await src.open();
  const stream = raw instanceof Blob ? (raw.stream() as ReadableStream<Uint8Array>) : raw;
  try {
    return await readHead(stream.pipeThrough(ds as unknown as TransformStream<Uint8Array, Uint8Array>), WASM_HEAD);
  } catch {
    return null;
  }
}

export interface Analysis {
  files: SourceFile[];
  sniffed: Sniffed;
  unityweb: Record<string, "br" | "gzip" | null>;
  detection: Detection;
  totalBytes: number;
}

/** Lê os poucos bytes necessários e reconhece o build. */
export async function analyze(files: SourceFile[], chosenEntry?: string | null): Promise<Analysis> {
  const infos = files.map((f) => ({ path: f.path, size: f.size }));
  const byPath = new Map(files.map((f) => [f.path, f]));
  const targets = sniffTargets(infos);
  const texts: Record<string, string> = {};
  for (const p of targets.text) {
    const head = await byPath.get(p)!.head(TEXT_HEAD);
    texts[p] = new TextDecoder("utf-8").decode(head);
  }
  if (chosenEntry && !texts[chosenEntry] && byPath.has(chosenEntry)) {
    texts[chosenEntry] = new TextDecoder("utf-8").decode(await byPath.get(chosenEntry)!.head(TEXT_HEAD));
  }
  const unityweb: Record<string, "br" | "gzip" | null> = {};
  for (const f of files) if (/\.unityweb$/i.test(f.path)) unityweb[f.path] = sniffUnityweb(await f.head(128));

  const wasmShared: Record<string, boolean | null> = {};
  for (const p of targets.wasm) {
    const src = byPath.get(p)!;
    let bytes: Uint8Array | null = null;
    let complete = false;
    if (/\.wasm$/i.test(p)) {
      bytes = await src.head(WASM_HEAD);
      complete = src.size <= WASM_HEAD;
    } else if (/\.wasm\.gz$|\.wasmgz$/i.test(p) || unityweb[p] === "gzip") {
      bytes = await decompressHead(src, "gzip");
    } else if (/\.wasm\.br$/i.test(p) || unityweb[p] === "br") {
      bytes = await decompressHead(src, "brotli");
    } else {
      bytes = await src.head(WASM_HEAD);
    }
    wasmShared[p] = bytes ? wasmUsesSharedMemory(bytes, complete) : null;
  }
  const sniffed = { texts, wasmShared };
  return {
    files,
    sniffed,
    unityweb,
    detection: detectBuild(infos, sniffed, chosenEntry),
    totalBytes: infos.reduce((n, f) => n + f.size, 0),
  };
}

/**
 * Lista final do envio: os arquivos do build mais o que a plataforma
 * acrescenta (script de isolamento injetado no HTML de entrada; index.html
 * do Ruffle para um .swf solto).
 */
export async function prepareFiles(a: Analysis, entry: string, isolation: boolean): Promise<SourceFile[]> {
  let files = a.files;
  if (a.detection.generateRuffleEntry) {
    files = [...files.filter((f) => f.path !== "index.html"), fromBlob("index.html", new Blob([ruffleHtml(a.detection.generateRuffleEntry)], { type: "text/html" }))];
  }
  if (isolation) {
    const coiPath = dirOf(entry) + COI_FILE;
    const page = files.find((f) => f.path === entry);
    if (!page) throw new IngestError("A página de entrada sumiu da lista.");
    if (page.size > 8 * 1024 * 1024) throw new IngestError("A página de entrada passa de 8 MB; não dá para acrescentar o isolamento.");
    const html = new Uint8Array(await (await page.blob()).arrayBuffer());
    const injected = new Blob([injectCoiScript(html) as BlobPart], { type: "text/html" });
    files = [
      ...files.filter((f) => f.path !== entry && f.path !== coiPath),
      fromBlob(entry, injected),
      fromBlob(coiPath, new Blob([COI_SCRIPT], { type: "text/javascript" })),
    ];
  }
  return files;
}

/* ------------------------------------------------------------------ */
/* Envio                                                               */
/* ------------------------------------------------------------------ */

export interface CreateMeta {
  projectId: string;
  entry: string;
  engine: BuildEngine;
  engineVersion: string | null;
  isolation: boolean;
  width: number | null;
  height: number | null;
  unityweb: Record<string, "br" | "gzip" | null>;
}

export type FileState = "fila" | "enviando" | "pronto" | "falhou";

export interface Progress {
  phase: "criando" | "enviando" | "concluindo" | "pronto" | "falhas" | "cancelado" | "erro";
  sentBytes: number;
  totalBytes: number;
  doneFiles: number;
  totalFiles: number;
  failed: { path: string; error: string }[];
  bytesPerSecond: number;
  buildId: string | null;
  error: string | null;
}

class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

class Cancelled extends Error {}

async function api<T>(url: string, init: { method: string; body?: unknown }, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: init.method,
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new HttpError(res.status, typeof data.error === "string" ? data.error : `Erro ${res.status}.`, data);
  return data as T;
}

/** Semáforo por bytes: segura a memória somando o que está em trânsito. */
class ByteGate {
  private used = 0;
  private waiters: { n: number; go: () => void }[] = [];
  constructor(private max: number) {}
  async take(n: number) {
    const need = Math.min(n, this.max);
    if (this.used + need <= this.max && this.waiters.length === 0) {
      this.used += need;
      return need;
    }
    await new Promise<void>((go) => this.waiters.push({ n: need, go }));
    return need;
  }
  give(n: number) {
    this.used -= n;
    while (this.waiters.length && this.used + this.waiters[0].n <= this.max) {
      const w = this.waiters.shift()!;
      this.used += w.n;
      w.go();
    }
  }
}

/** PUT com progresso (XMLHttpRequest) e cancelamento. */
function put(url: string, body: Blob, headers: Record<string, string>, signal: AbortSignal, onBytes: (n: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Cancelled());
    const xhr = new XMLHttpRequest();
    let reported = 0;
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      onBytes(e.loaded - reported);
      reported = e.loaded;
    };
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onload = () => {
      signal.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        onBytes(body.size - reported);
        resolve();
      } else {
        onBytes(-reported);
        const code = /<Code>([^<]+)<\/Code>/.exec(xhr.responseText ?? "")?.[1] ?? "";
        reject(new HttpError(xhr.status, `O armazenamento recusou o envio (${xhr.status}${code ? " " + code : ""}).`));
      }
    };
    xhr.onerror = () => {
      signal.removeEventListener("abort", abort);
      onBytes(-reported);
      reject(new HttpError(0, "A conexão caiu durante o envio."));
    };
    xhr.onabort = () => {
      signal.removeEventListener("abort", abort);
      onBytes(-reported);
      reject(new Cancelled());
    };
    xhr.send(body);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Signed {
  url: string;
  headers: Record<string, string>;
  at: number;
}

export class BuildUpload {
  private ctrl = new AbortController();
  private gate = new ByteGate(MAX_BYTES_IN_FLIGHT);
  private state = new Map<string, FileState>();
  private errors = new Map<string, string>();
  private signed = new Map<string, Signed>();
  private signing: Promise<void> | null = null;
  private sent = 0;
  private samples: { t: number; b: number }[] = [];
  private last = 0;
  private phase: Progress["phase"] = "criando";
  private fatal: string | null = null;
  buildId: string | null = null;

  constructor(
    private files: SourceFile[],
    private meta: CreateMeta,
    private onProgress: (p: Progress) => void,
  ) {
    for (const f of files) this.state.set(f.path, "fila");
  }

  get totalBytes() {
    return this.files.reduce((n, f) => n + f.size, 0);
  }

  snapshot(): Progress {
    const now = performance.now();
    this.samples = this.samples.filter((s) => now - s.t < 4000);
    const first = this.samples[0];
    const rate = first && now - first.t > 500 ? ((this.sent - first.b) * 1000) / (now - first.t) : 0;
    let done = 0;
    for (const s of this.state.values()) if (s === "pronto") done++;
    return {
      phase: this.phase,
      sentBytes: Math.max(0, Math.min(this.sent, this.totalBytes)),
      totalBytes: this.totalBytes,
      doneFiles: done,
      totalFiles: this.files.length,
      failed: [...this.errors].map(([path, error]) => ({ path, error })),
      bytesPerSecond: Math.max(0, rate),
      buildId: this.buildId,
      error: this.fatal,
    };
  }

  private emit(force = false) {
    const now = performance.now();
    if (!force && now - this.last < 150) return;
    this.last = now;
    this.samples.push({ t: now, b: this.sent });
    this.onProgress(this.snapshot());
  }

  private perFile = new Map<string, number>();

  /** Contador de bytes de um arquivo (para descontar tudo se ele falhar e for refeito). */
  private counter(path: string) {
    return (n: number) => {
      this.perFile.set(path, (this.perFile.get(path) ?? 0) + n);
      this.sent += n;
      this.emit();
    };
  }

  /** Cria o registro no servidor e envia tudo. */
  async start() {
    try {
      const created = await api<{ id: string }>(
        "/api/builds",
        {
          method: "POST",
          body: {
            projeto: this.meta.projectId,
            entrada: this.meta.entry,
            motor: this.meta.engine,
            versao: this.meta.engineVersion,
            isolamento: this.meta.isolation,
            largura: this.meta.width,
            altura: this.meta.height,
            arquivos: this.files.map((f) => {
              const e = this.meta.unityweb[f.path];
              return e ? [f.path, f.size, e] : [f.path, f.size];
            }),
          },
        },
        this.ctrl.signal,
      );
      this.buildId = created.id;
      await this.run();
    } catch (err) {
      this.handleFatal(err);
    }
  }

  /** Refaz só os arquivos que falharam. */
  async retryFailed() {
    if (!this.buildId) return this.start();
    for (const [p, s] of this.state) if (s === "falhou") this.state.set(p, "fila");
    this.errors.clear();
    this.fatal = null;
    try {
      await this.run();
    } catch (err) {
      this.handleFatal(err);
    }
  }

  /** Aborta os envios em andamento e apaga o que já subiu. */
  async cancel() {
    this.ctrl.abort();
    this.phase = "cancelado";
    this.emit(true);
    if (this.buildId) {
      await fetch(`/api/builds/${this.buildId}`, { method: "DELETE", credentials: "same-origin" }).catch(() => {});
    }
  }

  private handleFatal(err: unknown) {
    if (err instanceof Cancelled || this.ctrl.signal.aborted) {
      this.phase = "cancelado";
    } else {
      this.phase = "erro";
      this.fatal = err instanceof Error ? err.message : "Falha inesperada no envio.";
    }
    this.emit(true);
  }

  private async run() {
    this.phase = "enviando";
    this.emit(true);
    const queue = this.files.filter((f) => this.state.get(f.path) === "fila");
    // Os grandes primeiro: começam cedo e as partes correm junto com os pequenos.
    queue.sort((a, b) => b.size - a.size);
    // Um erro fatal para todos os trabalhadores: a fila esvazia, cada um termina o arquivo em curso e
    // só então run() falha. Assim "Tentar de novo" nunca corre junto de trabalhadores antigos.
    let fatal: unknown = null;
    const workers = Array.from({ length: Math.min(FILE_CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        if (this.ctrl.signal.aborted) throw new Cancelled();
        if (fatal) return;
        const f = queue.shift();
        if (!f) return;
        this.state.set(f.path, "enviando");
        try {
          if (f.size > BUILD_SINGLE_MAX) await this.sendBig(f);
          else await this.sendSmall(f, queue);
          this.state.set(f.path, "pronto");
        } catch (err) {
          if (err instanceof Cancelled || this.ctrl.signal.aborted) throw new Cancelled();
          this.state.set(f.path, "falhou");
          this.errors.set(f.path, err instanceof Error ? err.message : "Falha no envio.");
          this.sent -= this.perFile.get(f.path) ?? 0;
          this.perFile.delete(f.path);
          if (err instanceof HttpError && (err.status === 401 || err.status === 404 || (err.status === 409 && !err.body.faltam))) {
            fatal ??= err;
            queue.length = 0;
            return;
          }
        }
        this.emit();
      }
    });
    await Promise.all(workers);
    if (fatal) throw fatal;
    if (this.errors.size) {
      this.phase = "falhas";
      this.emit(true);
      return;
    }
    this.phase = "concluindo";
    this.emit(true);
    try {
      await api(`/api/builds/${this.buildId}/concluir`, { method: "POST" }, this.ctrl.signal);
    } catch (err) {
      if (err instanceof HttpError && Array.isArray(err.body.faltam)) {
        for (const p of err.body.faltam as string[]) {
          if (this.state.has(p)) {
            this.state.set(p, "falhou");
            this.errors.set(p, "Não chegou ao armazenamento.");
            this.sent -= this.perFile.get(p) ?? 0;
            this.perFile.delete(p);
          }
        }
        this.phase = "falhas";
        this.emit(true);
        return;
      }
      throw err;
    }
    this.phase = "pronto";
    this.emit(true);
  }

  /** Assina em lote o arquivo pedido e os próximos da fila. */
  private async sign(f: SourceFile, queue: SourceFile[]) {
    const fresh = (s?: Signed) => s && Date.now() - s.at < 20 * 60 * 1000;
    while (!fresh(this.signed.get(f.path))) {
      if (this.signing) {
        await this.signing;
        continue;
      }
      const batch = [f.path];
      for (const q of queue) {
        if (batch.length >= SIGN_BATCH) break;
        if (q.size <= BUILD_SINGLE_MAX && !fresh(this.signed.get(q.path))) batch.push(q.path);
      }
      this.signing = (async () => {
        const res = await api<{ urls: { caminho: string; url: string; cabecalhos: Record<string, string> }[] }>(
          `/api/builds/${this.buildId}/assinar`,
          { method: "POST", body: { arquivos: batch } },
          this.ctrl.signal,
        );
        const at = Date.now();
        for (const u of res.urls) this.signed.set(u.caminho, { url: u.url, headers: u.cabecalhos, at });
      })();
      try {
        await this.signing;
      } finally {
        this.signing = null;
      }
    }
    return this.signed.get(f.path)!;
  }

  private async sendSmall(f: SourceFile, queue: SourceFile[]) {
    for (let attempt = 0; ; attempt++) {
      const s = await this.sign(f, queue);
      const held = await this.gate.take(f.size);
      try {
        const body = await f.blob();
        await put(s.url, body, s.headers, this.ctrl.signal, this.counter(f.path));
        this.signed.delete(f.path);
        return;
      } catch (err) {
        if (err instanceof Cancelled || err instanceof ZipError) throw err;
        // 403: assinatura vencida ou recusada; assina de novo.
        if (err instanceof HttpError && err.status === 403) this.signed.delete(f.path);
        if (attempt >= 3) throw err;
        await sleep(600 * 2 ** attempt);
      } finally {
        this.gate.give(held);
      }
    }
  }

  private async sendBig(f: SourceFile) {
    type Plan = { tamanhoParte: number; total: number; feitas: number[]; partes: { n: number; tamanho: number; url: string }[] };
    const plan = await api<Plan>(`/api/builds/${this.buildId}/partes`, { method: "POST", body: { caminho: f.path } }, this.ctrl.signal);
    if (plan.tamanhoParte !== BUILD_PART_SIZE) throw new Error("Tamanho de parte inesperado.");
    const urls = new Map(plan.partes.map((p) => [p.n, p]));
    const count = this.counter(f.path);
    // Partes que já tinham subido (retomada) contam como enviadas.
    for (const n of plan.feitas) count(n === plan.total ? f.size - BUILD_PART_SIZE * (plan.total - 1) : BUILD_PART_SIZE);

    const source = await f.open();
    const inFlight = new Set<Promise<void>>();
    let failure: unknown = null;
    const sendPart = async (n: number, body: Blob, held: number) => {
      try {
        const p = urls.get(n)!;
        for (let attempt = 0; ; attempt++) {
          try {
            await put(p.url, body, {}, this.ctrl.signal, count);
            return;
          } catch (err) {
            if (err instanceof Cancelled || attempt >= 3) throw err;
            await sleep(800 * 2 ** attempt);
          }
        }
      } finally {
        this.gate.give(held);
      }
    };
    const schedule = async (n: number, body: Blob | (() => Blob), size: number) => {
      while (inFlight.size >= BUILD_PART_CONCURRENCY) await Promise.race(inFlight);
      if (failure) throw failure;
      const held = await this.gate.take(size);
      const task = sendPart(n, typeof body === "function" ? body() : body, held).catch((err) => {
        failure ??= err;
      });
      inFlight.add(task);
      task.finally(() => inFlight.delete(task));
    };

    if (source instanceof Blob) {
      for (const p of plan.partes) {
        const start = (p.n - 1) * BUILD_PART_SIZE;
        await schedule(p.n, () => source.slice(start, start + p.tamanho), p.tamanho);
      }
    } else {
      let n = 0;
      for await (const chunk of chunkStream(source, BUILD_PART_SIZE)) {
        n++;
        if (!urls.has(n)) continue; // já estava no armazenamento
        await schedule(n, chunk, chunk.size);
      }
    }
    await Promise.all(inFlight);
    if (failure) throw failure;
    await api(`/api/builds/${this.buildId}/partes/concluir`, { method: "POST", body: { caminho: f.path } }, this.ctrl.signal);
  }
}

import "server-only";
import type { ObjectId } from "mongodb";
import { db } from "@/lib/auth/db";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { toObjectId } from "@/lib/auth/session";
import { canEdit } from "@/lib/projects/access";
import { s3Fetch, S3Error } from "@/lib/storage/s3";
import { UploadError } from "@/lib/uploads/server";
import { BuildError, createBuild, finishBuild, purge } from "@/lib/builds/server";
import { detectBuild, sniffTargets, wasmUsesSharedMemory } from "@/lib/builds/detect";
import { COI_SCRIPT, injectCoiScript } from "@/lib/builds/coi";
import { headersFor } from "@/lib/builds/mime";
import { cleanBuildPath, COI_FILE, dirOf } from "@/lib/builds/paths";
import type { WebEngine } from "@/lib/auth/db";
import { ItchError } from "./fetch";
import { publicPageHtml } from "./public";
import { candidatesFor, isTextLike, refsOf, webEntryOf } from "./webcrawl";

/*
 * "Trazer" a versão de navegador de um jogo do itch.io: o servidor segue as
 * referências a partir da página de entrada em html(-classic).itch.zone/html/<id>/
 * (ver webcrawl.ts), reconhece o build com a mesma detecção do envio pelo
 * navegador (detect.ts), registra com createBuild, grava cada arquivo no bucket
 * jogável e conclui com finishBuild (que confere cada tamanho e a cota).
 *
 * ponytail: tudo numa função (até MAX_BYTES e MAX_FILES, ~4 min). Builds maiores
 * pedem o envio do zip pelo painel de builds; se aparecer muito disso, divida a
 * cópia em lotes como os downloads.
 */

const UA = "Mozilla/5.0 (compatible; PortalDosGames-Import/1.0)";
const MAX_FILES = 2000;
const MAX_REQUESTS = 4000;
const MAX_BYTES = 400 * 1024 * 1024;
const FILE_MAX = 200 * 1024 * 1024;
const TIME_BUDGET_MS = 230_000;
const WORKERS = 8;

/** null só quando o arquivo não existe (404 e afins); falha de rede tenta de novo e, persistindo, para tudo (nada some em silêncio). */
async function fetchFile(url: string): Promise<Uint8Array | null> {
  let res: Response | null = null;
  for (let attempt = 1; !res; attempt++) {
    try {
      res = await fetch(url, { headers: { "user-agent": UA }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(60_000) });
      if (res.status >= 500 && attempt < 3) {
        await res.body?.cancel().catch(() => undefined);
        res = null;
      }
    } catch {
      if (attempt >= 3) throw new ItchError("indisponivel", "O itch.io parou de responder no meio da cópia. Tente de novo.");
    }
    if (!res) await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  if (res.status === 429) throw new ItchError("limite", "O itch.io pediu para esperar um pouco. Tente de novo em alguns minutos.");
  if (res.status >= 500) throw new ItchError("indisponivel", "O itch.io não entregou um arquivo da versão de navegador. Tente de novo.");
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  if (Number(res.headers.get("content-length")) > FILE_MAX) {
    await res.body?.cancel().catch(() => undefined);
    throw new ItchError("indisponivel", "Um arquivo da versão de navegador é grande demais para trazer por aqui. Envie o zip pelo painel de builds.");
  }
  const b = new Uint8Array(await res.arrayBuffer());
  if (b.byteLength > FILE_MAX) throw new ItchError("indisponivel", "Um arquivo da versão de navegador é grande demais para trazer por aqui. Envie o zip pelo painel de builds.");
  return b;
}

/** Os arquivos do build, seguindo referências a partir da entrada. */
async function crawl(root: string, entry: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  const tried = new Set<string>();
  const queue: { path: string; required: boolean }[] = [{ path: entry, required: true }];
  const started = Date.now();
  let bytes = 0;
  let requests = 0;

  const visit = async (path: string, required: boolean) => {
    if (tried.has(path)) return;
    tried.add(path);
    if (++requests > MAX_REQUESTS || files.size >= MAX_FILES) throw new ItchError("indisponivel", "A versão de navegador tem arquivos demais para trazer por aqui. Envie o zip pelo painel de builds.");
    if (Date.now() - started > TIME_BUDGET_MS) throw new ItchError("indisponivel", "A versão de navegador demorou demais para vir. Tente de novo ou envie o zip pelo painel de builds.");
    const body = await fetchFile(root + path.split("/").map(encodeURIComponent).join("/"));
    if (!body) {
      if (required) throw new ItchError("nao_encontrado", "O itch.io não entregou a página do jogo de navegador.");
      return;
    }
    bytes += body.byteLength;
    if (bytes > MAX_BYTES) throw new ItchError("indisponivel", "A versão de navegador é grande demais para trazer por aqui. Envie o zip pelo painel de builds.");
    files.set(path, body);
    if (isTextLike(path)) {
      const text = new TextDecoder("utf-8").decode(body);
      for (const ref of refsOf(path, text)) {
        const cands = candidatesFor(path, ref);
        queue.push(...cands.map((c) => ({ path: c, required: false })));
      }
    }
  };

  // Fila com alguns pedidos ao mesmo tempo.
  const running = new Set<Promise<void>>();
  while (queue.length || running.size) {
    while (queue.length && running.size < WORKERS) {
      const { path, required } = queue.shift()!;
      if (tried.has(path)) continue;
      const p = visit(path, required).finally(() => running.delete(p));
      running.add(p);
    }
    if (running.size) await Promise.race(running);
  }
  return files;
}

export async function importItchWeb(userId: ObjectId, body: { projectId?: unknown }) {
  try {
    const l = await hit(`itch:web:${userId.toHexString()}`, 10, 60 * 60 * 1000);
    if (!l.allowed) throw new UploadError(429, "taxa", `Muitos pedidos seguidos. Espere ${waitText(l.retryAfterMs)} e tente de novo.`);
    const id = typeof body.projectId === "string" ? toObjectId(body.projectId) : null;
    const { projects } = await db();
    const project = id ? await projects.findOne({ _id: id, userId, status: { $ne: "excluindo" } }) : null;
    if (!project || !canEdit({ _id: userId }, project)) throw new UploadError(404, "nao_encontrado", "Esse rascunho não existe ou não é da sua conta.");
    const itchUrl = project.source?.itchUrl;
    if (!itchUrl) throw new UploadError(400, "itch", "Esse rascunho não veio do itch.io.");

    const where = webEntryOf(await publicPageHtml(itchUrl));
    if (!where) throw new UploadError(404, "itch_sem_web", "Esse jogo não tem versão de navegador no itch.io.");

    const raw = await crawl(where.root, where.entry);

    // Só caminhos que o envio aceita (os mesmos limites do navegador).
    const files = new Map<string, Uint8Array>();
    for (const [p, b] of raw) {
      const clean = cleanBuildPath(p);
      if (clean === p) files.set(p, b);
    }
    const infos = [...files].map(([path, b]) => ({ path, size: b.byteLength }));
    const targets = sniffTargets(infos);
    const texts: Record<string, string> = {};
    for (const p of [...targets.text, where.entry]) if (files.has(p)) texts[p] = new TextDecoder("utf-8").decode(files.get(p)!.subarray(0, 512 * 1024));
    const wasmShared: Record<string, boolean | null> = {};
    for (const p of targets.wasm) wasmShared[p] = /\.wasm$/i.test(p) ? wasmUsesSharedMemory(files.get(p)!, true) : null;
    const d = detectBuild(infos, { texts, wasmShared }, where.entry);
    if (d.blocked || !d.entry) {
      throw new UploadError(422, "itch_web", d.notices.find((n) => n.level === "erro")?.text ?? "Não reconhecemos a versão de navegador desse jogo. Envie o zip pelo painel de builds.");
    }
    const entry = d.entry;
    if (d.needsIsolation) {
      files.set(entry, injectCoiScript(files.get(entry)!));
      files.set(dirOf(entry) + COI_FILE, new TextEncoder().encode(COI_SCRIPT));
    }

    // A plataforma Web entra no rascunho se ainda não estiver marcada.
    if (!project.platforms.includes("web")) {
      await projects.updateOne({ _id: project._id, userId }, { $addToSet: { platforms: "web" }, $set: { updatedAt: new Date() } });
    }

    const { id: publicId } = await createBuild(userId, {
      projectId: project._id,
      entry,
      engine: d.engine as WebEngine,
      engineVersion: d.version,
      needsIsolation: d.needsIsolation,
      width: d.width,
      height: d.height,
      files: [...files].map(([p, b]) => ({ p, s: b.byteLength })),
    });
    const { builds } = await db();
    const build = await builds.findOne({ publicId, userId }, { projection: { _id: 1, bucket: 1, prefix: 1 } });
    if (!build) throw new BuildError(500, "O build sumiu durante a cópia.");
    try {
      const list = [...files];
      let i = 0;
      await Promise.all(
        Array.from({ length: WORKERS }, async () => {
          while (i < list.length) {
            const [p, b] = list[i++];
            const h = headersFor(p, null);
            const headers: Record<string, string> = { "content-type": h.contentType, "cache-control": h.cacheControl };
            if (h.contentEncoding) headers["content-encoding"] = h.contentEncoding;
            const res = await s3Fetch("PUT", build.bucket, build.prefix + p, { headers, body: b });
            if (!res.ok) throw new S3Error(res.status, "PutObject", await res.text().catch(() => ""));
          }
        }),
      );
      const done = await finishBuild(userId, publicId);
      return { build: done, files: files.size, engine: d.engine, notices: d.notices.filter((n) => n.level !== "info").map((n) => n.text) };
    } catch (err) {
      await purge(build).catch(() => undefined);
      await builds.deleteOne({ _id: build._id, userId }).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    if (err instanceof ItchError) {
      const status = { nao_encontrado: 404, limite: 429 }[err.code as string] ?? 502;
      throw new UploadError(status, `itch_${err.code}`, err.message);
    }
    if (err instanceof BuildError) throw new UploadError(err.status, "build", err.message);
    throw err;
  }
}

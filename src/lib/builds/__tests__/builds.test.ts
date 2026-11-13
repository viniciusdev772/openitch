import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { cleanBuildPath, commonRoot, COI_FILE } from "../paths";
import { headersFor, sniffUnityweb, CACHE_IMMUTABLE, CACHE_REVALIDATE } from "../mime";
import { canvasSize, detectBuild, missingReferences, pickEntry, wasmUsesSharedMemory, type BuildFileInfo } from "../detect";
import { crc32Update, entryBlob, openEntry, readZip, ZipError } from "../zip";
import { injectCoiScript } from "../coi";

/* ------------------------------------------------------------------ */
/* Um gerador de zip mínimo, só para os testes.                        */
/* ------------------------------------------------------------------ */

interface FakeEntry {
  name: string;
  data?: Uint8Array;
  method?: 0 | 8;
  unixMode?: number;
  flags?: number;
  /** Mente sobre o tamanho descompactado. */
  declaredSize?: number;
  /** Reaproveita o offset de outra entrada (bomba sobreposta). */
  reuseOffsetOf?: number;
}

function makeZip(entries: FakeEntry[], opts: { zip64?: boolean } = {}): Blob {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = e.data ?? new Uint8Array();
    const method = e.method ?? 8;
    const comp = method === 8 ? new Uint8Array(deflateRawSync(data)) : data;
    const crc = crc32Update(0, data);
    const size = e.declaredSize ?? data.length;
    const local = new Uint8Array(30 + name.length + comp.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, (e.flags ?? 0) | 0x0800, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, comp.length, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(comp, 30 + name.length);
    const myOffset = e.reuseOffsetOf !== undefined ? offsets[e.reuseOffsetOf] : offset;
    offsets.push(myOffset);
    if (e.reuseOffsetOf === undefined) {
      locals.push(local);
      offset += local.length;
    }
    const extra = opts.zip64 ? 28 : 0;
    const c = new Uint8Array(46 + name.length + extra);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, e.unixMode !== undefined ? (3 << 8) | 20 : 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, (e.flags ?? 0) | 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, opts.zip64 ? 0xffffffff : comp.length, true);
    cv.setUint32(24, opts.zip64 ? 0xffffffff : size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, extra, true);
    cv.setUint32(38, e.unixMode !== undefined ? (e.unixMode << 16) >>> 0 : 0, true);
    cv.setUint32(42, opts.zip64 ? 0xffffffff : myOffset, true);
    c.set(name, 46);
    if (opts.zip64) {
      const x = 46 + name.length;
      cv.setUint16(x, 0x0001, true);
      cv.setUint16(x + 2, 24, true);
      cv.setBigUint64(x + 4, BigInt(size), true);
      cv.setBigUint64(x + 12, BigInt(comp.length), true);
      cv.setBigUint64(x + 20, BigInt(myOffset), true);
    }
    central.push(c);
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const cdOffset = offset;
  const tail: Uint8Array[] = [];
  if (opts.zip64) {
    const rec = new Uint8Array(56);
    const rv = new DataView(rec.buffer);
    rv.setUint32(0, 0x06064b50, true);
    rv.setBigUint64(4, 44n, true);
    rv.setBigUint64(24, BigInt(entries.length), true);
    rv.setBigUint64(32, BigInt(entries.length), true);
    rv.setBigUint64(40, BigInt(cdSize), true);
    rv.setBigUint64(48, BigInt(cdOffset), true);
    const loc = new Uint8Array(20);
    const lv = new DataView(loc.buffer);
    lv.setUint32(0, 0x07064b50, true);
    lv.setBigUint64(8, BigInt(cdOffset + cdSize), true);
    lv.setUint32(16, 1, true);
    tail.push(rec, loc);
  }
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, opts.zip64 ? 0xffff : entries.length, true);
  ev.setUint16(10, opts.zip64 ? 0xffff : entries.length, true);
  ev.setUint32(12, opts.zip64 ? 0xffffffff : cdSize, true);
  ev.setUint32(16, opts.zip64 ? 0xffffffff : cdOffset, true);
  return new Blob([...locals, ...central, ...tail, eocd] as BlobPart[]);
}

const text = (s: string) => new TextEncoder().encode(s);
async function readAll(stream: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ------------------------------------------------------------------ */

test("caminhos: recusa travessia, absolutos, controle; aceita normais", () => {
  assert.equal(cleanBuildPath("Build/jogo.wasm"), "Build/jogo.wasm");
  assert.equal(cleanBuildPath("./index.html"), "index.html");
  assert.equal(cleanBuildPath("pasta\\arq.png"), "pasta/arq.png");
  assert.equal(cleanBuildPath("ação/música.ogg"), "ação/música.ogg");
  for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:/x", "c:\\x", "a//b", "a/./b", "a\u0000b", "", " a/b", "a/b "]) {
    assert.equal(cleanBuildPath(bad), null, bad);
  }
  assert.equal(cleanBuildPath("a".repeat(301)), null);
});

test("pasta comum por fora do zip", () => {
  assert.equal(commonRoot(["Jogo/index.html", "Jogo/Build/a.js"]), "Jogo/");
  assert.equal(commonRoot(["A/B/index.html", "A/B/x.js"]), "A/B/");
  assert.equal(commonRoot(["index.html", "Build/a.js"]), "");
  assert.equal(commonRoot(["A/index.html", "B/x.js"]), "");
});

test("cabeçalhos: Unity, Godot, Unreal e genéricos", () => {
  assert.deepEqual(headersFor("Build/g.wasm.br"), { contentType: "application/wasm", contentEncoding: "br", cacheControl: CACHE_IMMUTABLE });
  assert.equal(headersFor("Build/g.framework.js.br").contentType, "text/javascript; charset=utf-8");
  assert.equal(headersFor("Build/g.framework.js.br").contentEncoding, "br");
  assert.deepEqual(headersFor("Build/g.data.br"), { contentType: "application/octet-stream", contentEncoding: "br", cacheControl: CACHE_IMMUTABLE });
  assert.equal(headersFor("Build/g.data.gz").contentType, "application/gzip");
  assert.equal(headersFor("Build/g.data.gz").contentEncoding, "gzip");
  assert.equal(headersFor("Build/g.wasm.gz").contentType, "application/wasm");
  assert.equal(headersFor("Build/g.symbols.json.br").contentType, "application/octet-stream");
  assert.equal(headersFor("Build/g.wasm").contentEncoding, null);
  assert.equal(headersFor("Build/g.wasm.unityweb", "br").contentEncoding, "br");
  assert.equal(headersFor("Build/g.data.unityweb").contentEncoding, null);
  assert.equal(headersFor("index.pck").contentType, "application/octet-stream");
  assert.equal(headersFor("Jogo.UE4.js.gz").contentEncoding, "gzip");
  assert.equal(headersFor("Jogo-HTML5-Shipping.wasmgz").contentType, "application/wasm");
  assert.equal(headersFor("Jogo-HTML5-Shipping.wasmgz").contentEncoding, "gzip");
  assert.equal(headersFor("fase.tar.gz").contentEncoding, null);
  assert.equal(headersFor("fase.tar.gz").contentType, "application/gzip");
  assert.equal(headersFor("index.html").cacheControl, CACHE_REVALIDATE);
  assert.equal(headersFor(`sub/${COI_FILE}`).cacheControl, CACHE_REVALIDATE);
  const expected: Record<string, string> = {
    "a.mem": "application/octet-stream",
    "a.symbols": "application/octet-stream",
    "a.json": "application/json",
    "a.ogg": "audio/ogg",
    "a.mp3": "audio/mpeg",
    "a.wav": "audio/wav",
    "a.webm": "video/webm",
    "a.mp4": "video/mp4",
    "a.glb": "model/gltf-binary",
    "a.gltf": "model/gltf+json",
    "a.ktx2": "image/ktx2",
    "a.basis": "application/octet-stream",
    "a.woff2": "font/woff2",
    "a.ttf": "font/ttf",
    "a.svg": "image/svg+xml",
    "a.ico": "image/x-icon",
    "a.txt": "text/plain; charset=utf-8",
    "A.PNG": "image/png",
    "sem-extensao": "application/octet-stream",
  };
  for (const [p, t] of Object.entries(expected)) assert.equal(headersFor(p).contentType, t, p);
});

test("unityweb: reconhece gzip e o brotli do Unity", () => {
  assert.equal(sniffUnityweb(new Uint8Array([0x1f, 0x8b, 8, 0])), "gzip");
  const br = new Uint8Array(64);
  br.set(text("UnityWeb Compressed Content (brotli)"), 3);
  assert.equal(sniffUnityweb(br), "br");
  assert.equal(sniffUnityweb(text("plain bytes")), null);
});

function wasm(memFlags: number, viaImport = true) {
  const head = [0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0];
  const type = [1, 4, 1, 0x60, 0, 0];
  if (viaImport) {
    const imp = [1, 3, ...text("env"), 6, ...text("memory"), 2, memFlags, 1, ...(memFlags & 1 ? [1] : [])];
    return new Uint8Array([...head, ...type, 2, imp.length, ...imp]);
  }
  const mem = [1, memFlags, 1, ...(memFlags & 1 ? [1] : [])];
  return new Uint8Array([...head, ...type, 5, mem.length, ...mem]);
}

test("wasm: detecta memória compartilhada (threads)", () => {
  assert.equal(wasmUsesSharedMemory(wasm(0x03)), true);
  assert.equal(wasmUsesSharedMemory(wasm(0x00), true), false);
  assert.equal(wasmUsesSharedMemory(wasm(0x00)), null);
  assert.equal(wasmUsesSharedMemory(wasm(0x03, false)), true);
  assert.equal(wasmUsesSharedMemory(wasm(0x01, false), true), false);
  assert.equal(wasmUsesSharedMemory(text("not wasm")), null);
  assert.equal(wasmUsesSharedMemory(wasm(0x03).subarray(0, 14)), null);
});

const files = (...paths: string[]): BuildFileInfo[] => paths.map((path) => ({ path, size: 10 }));

test("detecta Unity com Brotli", () => {
  const f = files("index.html", "Build/g.loader.js", "Build/g.framework.js.br", "Build/g.data.br", "Build/g.wasm.br", "TemplateData/style.css");
  const html = `<canvas id="unity-canvas" width=960 height=600 tabindex="-1"></canvas><script>createUnityInstance()</script>`;
  const d = detectBuild(f, { texts: { "index.html": html }, wasmShared: { "Build/g.wasm.br": null } });
  assert.equal(d.engine, "unity");
  assert.equal(d.entry, "index.html");
  assert.equal(d.width, 960);
  assert.equal(d.height, 600);
  assert.equal(d.needsIsolation, false);
  assert.equal(d.isolationUncertain, true);
  assert.ok(d.notices.some((n) => n.text.includes("Brotli")));
});

test("detecta Godot 4.3 com e sem threads, Godot 4.0 e Godot 3", () => {
  const f = files("index.html", "index.js", "index.wasm", "index.pck", "index.audio.worklet.js");
  const on = `<script>const GODOT_CONFIG = {"executable":"index","ensureCrossOriginIsolationHeaders":true}; const GODOT_THREADS_ENABLED = true;</script>`;
  const off = on.replace("= true;", "= false;");
  assert.equal(detectBuild(f, { texts: { "index.html": on }, wasmShared: {} }).needsIsolation, true);
  const d = detectBuild(f, { texts: { "index.html": off }, wasmShared: { "index.wasm": false } });
  assert.equal(d.engine, "godot");
  assert.equal(d.version, "4.3+");
  assert.equal(d.needsIsolation, false);
  const g40 = `<script>const GODOT_CONFIG = {"gdextensionLibs":[],"ensureCrossOriginIsolationHeaders":true};</script>`;
  assert.equal(detectBuild(f, { texts: { "index.html": g40 }, wasmShared: {} }).needsIsolation, true);
  const g3 = `<script>const GODOT_CONFIG = {"gdnativeLibs":[]}; var engine = new Engine(GODOT_CONFIG);</script>`;
  const d3 = detectBuild(f, { texts: { "index.html": g3 }, wasmShared: {} });
  assert.equal(d3.version, "3.x");
  assert.equal(d3.needsIsolation, false);
  // wasm com memória compartilhada liga o isolamento em qualquer motor.
  assert.equal(detectBuild(f, { texts: { "index.html": g3 }, wasmShared: { "index.wasm": true } }).needsIsolation, true);
});

test("detecta outros motores", () => {
  const cases: [string[], string, string][] = [
    [["index.html", "scripts/c3runtime.js", "data.json", "sw.js"], "", "construct"],
    [["index.html", "html5game/Jogo.js"], "", "gamemaker"],
    [["index.html", "dmloader.js", "archive/archive_files.json", "jogo.wasm"], "", "defold"],
    [["jogo.html", "jogo.js"], "<script>var pico8_buttons = [0];</script>", "pico8"],
    [["index.html", "jogo_bg.wasm", "jogo.js"], "", "bevy"],
    [["Jogo.html", "Jogo.UE4.js", "Jogo.data", "Jogo.wasm", "Utility.js"], "", "unreal-html5"],
    [["index.html", "main.js"], "<canvas></canvas>", "html5"],
  ];
  for (const [paths, html, engine] of cases) {
    const entry = pickEntry(paths)!;
    assert.equal(detectBuild(files(...paths), { texts: { [entry]: html }, wasmShared: {} }).engine, engine, engine);
  }
});

test("Flash sem HTML gera entrada com Ruffle; desktop é recusado", () => {
  const d = detectBuild(files("jogo.swf"), { texts: {}, wasmShared: {} });
  assert.equal(d.engine, "ruffle");
  assert.equal(d.generateRuffleEntry, "jogo.swf");
  assert.equal(d.blocked, false);
  const ue = detectBuild(files("Jogo.exe", "Jogo/Content/Paks/Jogo-WindowsNoEditor.pak", "Engine/Binaries/x.dll"), { texts: {}, wasmShared: {} });
  assert.equal(ue.blocked, true);
  assert.ok(ue.notices[0].text.includes("Unreal 5 não exporta para navegador"));
  const exe = detectBuild(files("Jogo.exe", "Jogo.pck"), { texts: {}, wasmShared: {} });
  assert.equal(exe.blocked, true);
});

test("entrada: index.html, único .html, ou ambíguo", () => {
  assert.equal(pickEntry(["index.html", "outra.html"]), "index.html");
  assert.equal(pickEntry(["jogo.html", "a.js"]), "jogo.html");
  assert.equal(pickEntry(["a.html", "b.html"]), null);
  assert.equal(pickEntry(["web/index.html", "web/a.js"]), "web/index.html");
});

test("referências quebradas e diferença de maiúsculas", () => {
  const r = missingReferences("index.html", `<script src="Build/Loader.js"></script><img src="falta.png"><a href="https://x.y">`, ["index.html", "Build/loader.js"]);
  assert.deepEqual(r.caseOnly, ["Build/Loader.js"]);
  assert.deepEqual(r.missing, ["falta.png"]);
});

test("tamanho do canvas", () => {
  assert.deepEqual(canvasSize(`<canvas width="320" height="240">`), { width: 320, height: 240 });
  assert.equal(canvasSize(`<canvas id="c">`), null);
});

test("injeção do script de isolamento", () => {
  const out = new TextDecoder().decode(injectCoiScript(text(`<!doctype html><html><head><meta charset="utf-8"></head><body>é</body></html>`)));
  assert.ok(out.startsWith(`<!doctype html><html><head><script src="${COI_FILE}"></script><meta`));
  assert.ok(out.includes("é"));
  const twice = injectCoiScript(text(out));
  assert.equal(new TextDecoder().decode(twice), out);
  const noHead = new TextDecoder().decode(injectCoiScript(text(`<!DOCTYPE html><canvas></canvas>`)));
  assert.ok(noHead.startsWith(`<!DOCTYPE html><script`));
});

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

test("zip: lê deflate e stored, nomes UTF-8, ignora lixo de sistema", async () => {
  const big = text("x".repeat(5000));
  const blob = makeZip([
    { name: "Jogo/index.html", data: text("<html></html>") },
    { name: "Jogo/ação.txt", data: text("olá"), method: 0 },
    { name: "Jogo/big.txt", data: big },
    { name: "__MACOSX/Jogo/._index.html", data: text("x") },
  ]);
  const { entries, skipped } = await readZip(blob);
  assert.equal(skipped, 1);
  assert.deepEqual(entries.map((e) => e.path), ["Jogo/index.html", "Jogo/ação.txt", "Jogo/big.txt"]);
  const got = await readAll(await openEntry(blob, entries[2]));
  assert.equal(got.length, 5000);
  const stored = await entryBlob(blob, entries[1]);
  assert.equal(await stored.text(), "olá");
});

test("zip64: lê tamanhos e offsets de 64 bits", async () => {
  const blob = makeZip([{ name: "index.html", data: text("<p>oi</p>") }, { name: "a.bin", data: new Uint8Array(100), method: 0 }], { zip64: true });
  const { entries } = await readZip(blob);
  assert.equal(entries.length, 2);
  assert.equal(entries[1].size, 100);
  assert.equal((await readAll(await openEntry(blob, entries[0]))).length, 9);
});

test("zip: recusa travessia, absoluto, link simbólico, senha", async () => {
  for (const name of ["../fora.txt", "a/../../fora.txt", "/etc/passwd", "C:\\Windows\\x.dll"]) {
    await assert.rejects(readZip(makeZip([{ name, data: text("x") }])), ZipError, name);
  }
  await assert.rejects(readZip(makeZip([{ name: "link", data: text("/etc/passwd"), unixMode: 0o120777 }])), /link simbólico/);
  await assert.rejects(readZip(makeZip([{ name: "x.txt", data: text("x"), flags: 1 }])), /senha/);
});

test("zip: recusa bombas (razão, total, sobreposição, tamanho mentiroso)", async () => {
  const zeros = new Uint8Array(4 * 1024 * 1024);
  await assert.rejects(readZip(makeZip([{ name: "zeros.bin", data: zeros }])), /bomba de compressão/);
  await assert.rejects(
    readZip(makeZip([{ name: "a.bin", data: new Uint8Array(2000) }, { name: "b.bin", data: new Uint8Array(2000) }]), { maxFiles: 10, maxTotalBytes: 3000, maxRatio: 400 }),
    /passa do limite/,
  );
  await assert.rejects(readZip(makeZip([{ name: "a.txt", data: text("abc") }, { name: "b.txt", data: text("abc"), reuseOffsetOf: 0 }])), /sobrepostas/);
  await assert.rejects(
    readZip(makeZip([{ name: "1.txt", data: text("1") }, { name: "2.txt", data: text("2") }]), { maxFiles: 1, maxTotalBytes: 1e9, maxRatio: 400 }),
    /mais de 1 arquivos/,
  );
  // Declara 10 bytes, mas descompacta 5000: para no byte 11.
  const liar = makeZip([{ name: "mente.txt", data: text("y".repeat(5000)), declaredSize: 10 }]);
  const { entries } = await readZip(liar, { maxFiles: 10, maxTotalBytes: 1e9, maxRatio: 1e9 });
  await assert.rejects(readAll(await openEntry(liar, entries[0])), /maior do que o zip declara/);
});

test("zip: CRC errado é detectado", async () => {
  const blob = makeZip([{ name: "a.txt", data: text("conteúdo") }]);
  const { entries } = await readZip(blob);
  entries[0].crc32 ^= 1;
  await assert.rejects(readAll(await openEntry(blob, entries[0])), /CRC/);
});

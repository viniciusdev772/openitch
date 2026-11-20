import { test } from "node:test";
import assert from "node:assert/strict";
import { canPlayExe, canTryExe, exeBlockReason, exeCandidates, EXE_MAX_BYTES, peMachine, rangeBlob, RangeUnsupported } from "../exe";

test("exeCandidates: o maior .exe da raiz, sem instaladores, com a pasta de fora ignorada", () => {
  const list = exeCandidates([
    { path: "Jogo/setup.exe", size: 90_000_000 },
    { path: "Jogo/unins000.exe", size: 800_000 },
    { path: "Jogo/Launcher.EXE", size: 300_000 },
    { path: "Jogo/RPG_RT.exe", size: 1_200_000 },
    { path: "Jogo/redist/vcredist_x86.exe", size: 5_000_000 },
    { path: "Jogo/tools/editor.exe", size: 9_000_000 },
    { path: "Jogo/Data/map.lmu", size: 50_000 },
    { path: "__MACOSX/Jogo/._RPG_RT.exe", size: 4_000 },
  ]).map((e) => e.path);
  assert.deepEqual(list, [
    "Jogo/RPG_RT.exe",
    "Jogo/Launcher.EXE",
    "Jogo/tools/editor.exe",
    "Jogo/setup.exe",
    "Jogo/unins000.exe",
    "Jogo/redist/vcredist_x86.exe",
  ]);
  assert.deepEqual(exeCandidates([{ path: "leia-me.txt", size: 10 }]), []);
  assert.equal(exeCandidates([{ path: "game.exe", size: 10 }])[0].path, "game.exe");
});

test("peMachine: lê Machine do cabeçalho PE", () => {
  const pe = (machine: number) => {
    const b = new Uint8Array(0x100);
    const v = new DataView(b.buffer);
    b[0] = 0x4d;
    b[1] = 0x5a;
    v.setUint32(0x3c, 0x80, true);
    v.setUint32(0x80, 0x00004550, true);
    v.setUint16(0x84, machine, true);
    return b;
  };
  assert.equal(peMachine(pe(0x14c)), "x86");
  assert.equal(peMachine(pe(0x8664)), "x64");
  assert.equal(peMachine(pe(0xaa64)), "arm64");
  assert.equal(peMachine(pe(0x1c0)), "outro");
  assert.equal(peMachine(new Uint8Array(0x100)), null);
  assert.equal(peMachine(pe(0x8664).subarray(0, 0x82)), null);
});

test("rangeBlob: cada leitura é um GET com Range; sem 206, RangeUnsupported", async () => {
  const data = new Uint8Array(1000).map((_, i) => i % 251);
  const seen: string[] = [];
  const real = globalThis.fetch;
  let honour = true;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const range = new Headers(init?.headers).get("range")!;
    seen.push(range);
    const [a, b] = range.slice(6).split("-").map(Number);
    return honour ? new Response(data.slice(a, b + 1), { status: 206 }) : new Response(data, { status: 200 });
  }) as typeof fetch;
  try {
    const blob = rangeBlob("https://minio.test/x", data.length);
    assert.equal(blob.size, 1000);
    const part = blob.slice(990);
    assert.deepEqual(new Uint8Array(await part.arrayBuffer()), data.slice(990));
    const chunks: number[] = [];
    const reader = blob.slice(10, 20).stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(...value);
    }
    assert.deepEqual(chunks, [...data.slice(10, 20)]);
    assert.deepEqual(seen, ["bytes=990-999", "bytes=10-19"]);
    honour = false;
    await assert.rejects(blob.slice(0, 4).arrayBuffer(), RangeUnsupported);
  } finally {
    globalThis.fetch = real;
  }
});

test("exeBlockReason e canTryExe: botão desligado com motivo para Windows fora dos filtros", () => {
  assert.equal(exeBlockReason({ platform: "windows", filename: "jogo.zip", size: 10 }), null);
  assert.match(exeBlockReason({ platform: "windows", filename: "jogo.7z", size: 10 })!, /\.exe ou \.zip/);
  assert.match(exeBlockReason({ platform: "windows", filename: "FantasticChess-win64.zip", size: 878_351_434 })!, /limite de 512 MB/);
  assert.equal(canTryExe({ platform: "windows", filename: "jogo.7z", size: 10 }), true);
  assert.equal(canTryExe({ platform: "linux", filename: "jogo.zip", size: 10 }), false);
});

test("canPlayExe: só Windows, .exe ou .zip, até o teto", () => {
  assert.equal(canPlayExe({ platform: "windows", filename: "Jogo.EXE", size: 1000 }), true);
  assert.equal(canPlayExe({ platform: "windows", filename: "jogo-win.zip", size: 1000 }), true);
  assert.equal(canPlayExe({ platform: "windows", filename: "jogo.msi", size: 1000 }), false);
  assert.equal(canPlayExe({ platform: "windows", filename: "jogo.7z", size: 1000 }), false);
  assert.equal(canPlayExe({ platform: "linux", filename: "jogo.zip", size: 1000 }), false);
  assert.equal(canPlayExe({ platform: "macos", filename: "jogo.exe", size: 1000 }), false);
  assert.equal(canPlayExe({ platform: "windows", filename: "jogo.zip", size: EXE_MAX_BYTES + 1 }), false);
  assert.equal(canPlayExe({ platform: "windows", filename: "jogo.zip", size: 0 }), false);
});

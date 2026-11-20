import { test } from "node:test";
import assert from "node:assert/strict";
import { canPlayExe, exeCandidates, EXE_MAX_BYTES } from "../exe";

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

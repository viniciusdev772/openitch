import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTO_JS, isUnrealBuild, pageFrom, play64Url, windowsPath } from "../exe64";

test("caminho Windows do .exe no motor de 64 bits", () => {
  assert.equal(windowsPath("FantasticChess/FantasticChess.exe", true), "Z:\\FantasticChess\\FantasticChess.exe");
  assert.equal(windowsPath("Meu Jogo/jogo.exe", true), '"Z:\\Meu Jogo\\jogo.exe"');
  assert.equal(windowsPath("jogo.exe", false), "Z:\\__vg_jogo\\jogo.exe");
});

test("endereço que abre o jogo: zip extra e .exe na query, URL curta só no hash", () => {
  const u = new URL(play64Url("https://minio.x/vibegames-play/b/__vg_exe/boxedwine64-1/jogar.html", "a/b.exe", true, "https://minio.x/f/jogo.zip?X-Amz-Signature=abc"));
  assert.equal(u.searchParams.get("extrazip"), "__vg_game.zip");
  assert.equal(u.searchParams.get("p"), "Z:\\a\\b.exe");
  assert.ok(!u.search.includes("Signature"));
  const h = new URLSearchParams(u.hash.slice(1));
  assert.equal(h.get("u"), "https://minio.x/f/jogo.zip?X-Amz-Signature=abc");
  assert.equal(h.get("z"), "1");
});

test("reconhece um Unreal Engine empacotado", () => {
  assert.equal(isUnrealBuild(["FantasticChess/FantasticChess/Binaries/Win64/FantasticChess-Win64-Shipping.exe"]), true);
  assert.equal(isUnrealBuild(["Jogo/Engine/Binaries/ThirdParty/x.dll", "Jogo/Jogo.exe"]), true);
  assert.equal(isUnrealBuild(["Jogo/Jogo.exe", "Jogo/data.win"]), false);
});

test("a página ganha o nosso script antes do launcher, e o script é JavaScript válido", () => {
  const html = pageFrom('<body>\n<script src="wine64-launcher.js"></script>\n</body>');
  assert.ok(html.indexOf("__vg_auto.js") < html.indexOf("wine64-launcher.js"));
  assert.throws(() => pageFrom("<body></body>"));
  assert.doesNotThrow(() => new Function(AUTO_JS));
  assert.ok(AUTO_JS.includes("/(^|\\/)__vg_game\\.zip(\\?|$)/"));
});

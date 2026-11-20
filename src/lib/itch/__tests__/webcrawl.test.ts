import { test } from "node:test";
import assert from "node:assert/strict";
import { candidatesFor, refsOf, webEntryOf } from "../webcrawl";

// Rodar: node --experimental-strip-types --import ./src/lib/builds/__tests__/register.mjs --test src/lib/itch/__tests__/*.test.ts

test("acha a entrada do jogo de navegador na página do itch", () => {
  const page = `<div class="iframe_placeholder" data-iframe="&lt;iframe frameborder=&quot;0&quot; src=&quot;https://html-classic.itch.zone/html/20648713/index.html?v=1795041120&quot; allowfullscreen&gt;&lt;/iframe&gt;"></div>`;
  assert.deepEqual(webEntryOf(page), { root: "https://html-classic.itch.zone/html/20648713/", entry: "index.html" });
  assert.equal(webEntryOf(page.replace("html-classic.itch.zone", "evil.com")), null);
  assert.equal(webEntryOf("<p>sem jogo</p>"), null);
});

test("referências em HTML, CSS e JS", () => {
  const html = `<script type="module" src="./assets/index-BEb91eVT.js"></script><link href="./assets/a.css"><a href="https://x.y/z.js">x</a><img src="data:image/png;base64,AA">`;
  assert.deepEqual(refsOf("index.html", html).sort(), ["./assets/a.css", "./assets/index-BEb91eVT.js"]);
  assert.deepEqual(refsOf("assets/a.css", `@font-face{src:url(./f.woff2) format("woff2")} @import "b.css";`).sort(), ["./f.woff2", "b.css"]);
  const js = `const u=new URL("fundo.png",import.meta.url);fetch("/dados/fase1.json");const x="nada";loader("Build/WebGL.data.unityweb?v=2")`;
  assert.deepEqual(refsOf("assets/m.js", js).sort(), ["/dados/fase1.json", "Build/WebGL.data.unityweb", "fundo.png"]);
});

test("onde procurar cada referência, sem sair da raiz", () => {
  assert.deepEqual(candidatesFor("assets/m.js", "fundo.png"), ["assets/fundo.png", "fundo.png"]);
  assert.deepEqual(candidatesFor("assets/m.js", "/dados/x.json"), ["dados/x.json"]);
  assert.deepEqual(candidatesFor("index.html", "./assets/a%20b.css"), ["assets/a b.css"]);
  assert.deepEqual(candidatesFor("a/b.js", "../../../etc/passwd.txt"), []);
});

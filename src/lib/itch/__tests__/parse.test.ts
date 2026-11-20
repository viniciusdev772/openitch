import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImageUrl, parseItch, parseItchUrl } from "../parse";

// Rodar: node --conditions=react-server --experimental-strip-types --import ./src/lib/builds/__tests__/register.mjs --test src/lib/itch/__tests__/*.test.ts

const HTML = `<html><head>
<meta property="og:description" content="Xadrez com peças &amp; regras estranhas">
<meta property="og:image" content="https://img.itch.zone/aW1n/cover.png">
<style>.view_game_page .game_info_panel_widget{background:red}</style>
</head><body>
<div class="formatted_description user_formatted"><p>Primeiro <b>parágrafo</b> com <a href="https://exemplo.com/x">link</a>.</p>
<div>aninhado</div><ul><li>Um</li><li>Dois</li></ul>
<p>&lt;script&gt;alert(1)&lt;/script&gt;</p><script>evil()</script><img src=x onerror=evil()><table><tr><td>Peão</td><td>Cavaleiro</td></tr></table></div>
<div class="game_info_panel_widget"><table>
<tr><td>Status</td><td>Released</td></tr>
<tr><td>Platforms</td><td><a>Windows</a>, <a>Linux</a></td></tr>
<tr><td>Genre</td><td>Puzzle</td></tr>
<tr><td>Tags</td><td><a>3D</a>, <a>Unreal Engine</a></td></tr>
<tr><td>Made with</td><td><a>Unreal Engine</a></td></tr>
<tr><td>AI Disclosure</td><td><a>AI Assisted</a>, <a>Code</a></td></tr>
</table></div>
<div class="screenshot_list"><a href="https://img.itch.zone/a/original/x.jpg"><img srcset="https://img.itch.zone/a/347x500/s.jpg 1x, https://img.itch.zone/a/794x1000/m.jpg 2x" src="https://img.itch.zone/a/347x500/s.jpg"></a><a><img src="https://evil.com/x.jpg"></a></div>
<a class="buy_btn">Download Now Name your own price</a>
</body></html>`;
const JSON_ = { id: 42, title: "Fantastic Chess", price: "$0.00", authors: [{ name: "Bruno" }], tags: ["3d", "unreal-engine"], links: { self: "https://vaula.itch.io/fantastic-chess" } };

test("mapeia plataformas, preço, etiquetas e capa", () => {
  const r = parseItch(HTML, JSON_, "https://vaula.itch.io/fantastic-chess/", ["3D"])!;
  assert.deepEqual(r.platforms, ["windows", "linux"]);
  assert.deepEqual(r.price, { kind: "pwyw", minimumCents: 0 });
  assert.deepEqual(r.tags, ["3D", "unreal engine"]);
  assert.equal(r.track, "puzzle");
  assert.equal(r.tagline, "Xadrez com peças & regras estranhas");
  assert.equal(r.coverUrl, "https://img.itch.zone/aW1n/cover.png");
  assert.equal(r.itchUrl, "https://vaula.itch.io/fantastic-chess");
  assert.deepEqual(r.screenshots, ["https://img.itch.zone/a/794x1000/m.jpg"]);
  assert.deepEqual(r.credits, [
    { role: "Criação", name: "Bruno" },
    { role: "Feito com", name: "Unreal Engine" },
  ]);
  assert.deepEqual(r.contentNotes, ["Uso de IA declarado: AI Assisted, Code"]);
  assert.equal(parseItch(HTML.replace("Name your own price", "Buy"), { ...JSON_, price: "$5.00" }, JSON_.links.self)!.reviewPrice, true);
});

test("descrição vira texto sem HTML cru", () => {
  const d = parseItch(HTML, JSON_, JSON_.links.self)!.description;
  assert.equal(
    d,
    "Primeiro parágrafo com link (https://exemplo.com/x).\n\naninhado\n\n• Um\n• Dois\n\n<script>alert(1)</script>\n\nPeão — Cavaleiro",
  );
  assert.ok(!d.includes("evil()") && !d.includes("onerror"));
});

test("valida o host: só https em itch.io, sem porta nem credenciais", () => {
  for (const ok of ["https://itch.io/games", "https://vaula.itch.io/x"]) assert.ok(parseItchUrl(ok), ok);
  for (const bad of [
    "https://evil.com/x",
    "https://itch.io.evil.com/x",
    "https://evilitch.io/x",
    "http://vaula.itch.io/x",
    "https://u:p@vaula.itch.io/x",
    "https://vaula.itch.io:8443/x",
    "not a url",
  ]) {
    assert.equal(parseItchUrl(bad), null, bad);
  }
  assert.ok(parseImageUrl("https://img.itch.zone/a.png"));
  assert.equal(parseImageUrl("https://img.itch.zone.evil.com/a.png"), null);
  assert.equal(parseImageUrl("http://img.itch.zone/a.png"), null);
});

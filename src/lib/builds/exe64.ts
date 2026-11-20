/*
 * Motor de 64 bits para "Jogar no navegador": Boxedwine64 (wine64 + CPU x86-64
 * interpretada em WebAssembly, GPL-2.0, https://github.com/andrewnakas/Boxedwine64).
 * Roda .exe de 64 bits leves (GDI, OpenGL simples) no PC de quem joga. Precisa de
 * SharedArrayBuffer, então abre em aba própria, isolada pelo service worker do
 * próprio projeto (coi-serviceworker.js), servida do bucket jogável.
 *
 * Os arquivos vêm do site publicado do projeto (a mesma build da demo), com tamanho
 * e SHA-256 fixados aqui: o servidor confere cada um ao instalar (exe64-install.ts).
 * O wine64.zip (~196 MB) fica em três partes com manifest, como no GitHub Pages; o
 * launcher o monta sob demanda por HTTP Range (~55 MB por partida).
 *
 * O jogo entra sem mudar o launcher: a página abre com ?extrazip=__vg_game.zip e
 * ?p=<caminho Windows do .exe>, e __vg_auto.js responde ao pedido desse zip com o
 * arquivo do jogo (URL curta do MinIO no hash da página).
 *
 * Funções puras: rodam no navegador e no servidor.
 */

const BASE = "https://andrewnakas.github.io/Boxedwine64/";

export const BOXEDWINE64 = {
  version: "20261120",
  dir: "b/__vg_exe/boxedwine64-20261120/",
  source: "https://github.com/andrewnakas/Boxedwine64",
  /** Página que abrimos (o wine64.html original com __vg_auto.js antes do launcher). */
  page: "jogar.html",
  files: [
    { name: "wine64.html", size: 13_356, sha256: "e1e35865f8f38c1144fac5f63b6d896e14d3456532a92227f3f1bf96b1e9e35a" },
    { name: "wine64-launcher.js", size: 92_924, sha256: "f51eb16572f88e798f209c6ff12b87ee4ded42f002609a0aeb335a3be0c66499" },
    { name: "coi-serviceworker.js", size: 6_906, sha256: "35e88c10cc612c5189c8c302365d3a608abd796594c4c80c37c927ae9141dd9c" },
    { name: "boxedwine.css", size: 3_853, sha256: "fd7782e90131d31d1bb90fce4cc7188c27dadb41f67b1f36a1005d80d759b3c6" },
    { name: "boxedwine64.js", size: 409_887, sha256: "483f5dc91f41d9e82eb11e8c17ef402716946b8e5e982c213c41d6b2bf34a2d8" },
    { name: "boxedwine64.wasm", size: 3_026_963, sha256: "d0d080c3f77fee1473a610ce3beaa9794ef03269e0116a8a470d66e289c5d93c" },
    { name: "glibc-rootfs64.zip", size: 9_940_241, sha256: "1b3280c9868e39bc391141980c677b0e18b0b65c862896eefe313cb93918dd8f" },
    { name: "prefix64.zip", size: 21_030_176, sha256: "edcad905f6c1b55b739b36bbcb532bc0612d97b77cef209511499284f955e119" },
    { name: "wine64.zip.manifest.json", size: 153, sha256: "af35d61ed9ef1a779c0a1fa3b3a7048dffbbf6eb9386ddadb44a4109374a17e4" },
    { name: "wine64.zip.part000", size: 94_371_840, sha256: "51d85632de7e249759bd51fb852494c3025b7c3e1707c3c9c538197d03ef1107" },
    { name: "wine64.zip.part001", size: 94_371_840, sha256: "b5830180a7aa03e1548e8e34786774f524b6706dfc95c565d432fcf42448fb15" },
    { name: "wine64.zip.part002", size: 16_802_859, sha256: "98ffc8b0e78ab41082bb2a1e73769856cc0109948455df9e38e38bb89e31d9bf" },
  ],
} as const;

export const urlOf64 = (name: string) => BASE + name;

/** O wine64.html com o nosso script antes do launcher (e o título da página). */
export function pageFrom(original: string): string {
  const tag = '<script src="wine64-launcher.js"></script>';
  if (!original.includes(tag)) throw new Error("O wine64.html do Boxedwine64 mudou: o launcher não está onde esperado.");
  return original.replace(tag, `<script src="__vg_auto.js"></script>\n    ${tag}`);
}

/** Caminho Windows do .exe para ?p= (o zip do jogo é montado na raiz do Wine, que é o drive Z:). */
export function windowsPath(exe: string, zip: boolean): string {
  const rel = (zip ? exe : `__vg_jogo/${safeName(exe)}`).replace(/\//g, "\\");
  const p = `Z:\\${rel}`;
  return /\s/.test(p) ? `"${p}"` : p;
}

export const safeName = (name: string) => name.split("/").pop()!.replace(/[\\/:*?"<>|]/g, "_");

/** Endereço que abre o jogo: a página no bucket, o zip extra, o .exe e, no hash, a URL curta do arquivo. */
export function play64Url(page: string, exe: string, zip: boolean, fileUrl: string): string {
  const q = new URLSearchParams({ extrazip: "__vg_game.zip", p: windowsPath(exe, zip) });
  const h = new URLSearchParams({ u: fileUrl, z: zip ? "1" : "0", n: safeName(exe) });
  return `${page}?${q}#${h}`;
}

/**
 * O jogo é um Unreal Engine empacotado? (o .exe "-Win64-Shipping" ou a pasta
 * Engine/Binaries ao lado). Esses precisam de DirectX 11/12, que nenhum emulador
 * de navegador roda; o caminho é a versão web exportada pelo criador.
 */
export function isUnrealBuild(paths: readonly string[]): boolean {
  return paths.some((p) => /-(Win64|WinGDK)-Shipping\.exe$/i.test(p) || /(^|\/)Engine\/Binaries\//i.test(p));
}

/*
 * __vg_auto.js: entrega o jogo ao launcher. Quando ele pede __vg_game.zip, responde
 * com o zip do jogo como veio (em fluxo) ou com o .exe solto embrulhado num zip sem
 * compressão em __vg_jogo/<nome>. Esconde a barra de apps da demo.
 */
export const AUTO_JS = `(function () {
  var h = new URLSearchParams(location.hash.slice(1));
  var url = h.get("u"), isZip = h.get("z") === "1";
  var name = (h.get("n") || "jogo.exe").replace(/[\\\\/:*?"<>|]/g, "_");
  var st = document.createElement("style");
  st.textContent = "#apps,#myAppsRow,#exeChooser{display:none!important}";
  document.head.appendChild(st);
  document.title = "Portal dos Games · Windows 64 bits (experimental)";
  if (!url) return;
  var T = new Uint32Array(256);
  for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function storedZip(path, d) {
    var nb = new TextEncoder().encode(path), crc = crc32(d), L = nb.length;
    var out = new Uint8Array(30 + L + d.length + 46 + L + 22), v = new DataView(out.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x800, true);
    v.setUint32(14, crc, true); v.setUint32(18, d.length, true); v.setUint32(22, d.length, true); v.setUint16(26, L, true);
    out.set(nb, 30); out.set(d, 30 + L);
    var cd = 30 + L + d.length;
    v.setUint32(cd, 0x02014b50, true); v.setUint16(cd + 4, 20, true); v.setUint16(cd + 6, 20, true); v.setUint16(cd + 8, 0x800, true);
    v.setUint32(cd + 16, crc, true); v.setUint32(cd + 20, d.length, true); v.setUint32(cd + 24, d.length, true); v.setUint16(cd + 28, L, true);
    out.set(nb, cd + 46);
    var e = cd + 46 + L;
    v.setUint32(e, 0x06054b50, true); v.setUint16(e + 8, 1, true); v.setUint16(e + 10, 1, true);
    v.setUint32(e + 12, 46 + L, true); v.setUint32(e + 16, cd, true);
    return out;
  }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var u = typeof input === "string" ? input : (input && input.url) || "";
    if (!/(^|\\/)__vg_game\\.zip(\\?|$)/.test(u)) return realFetch(input, init);
    return realFetch(url).then(function (res) {
      if (!res.ok) throw new Error("O arquivo do jogo não veio (HTTP " + res.status + "). Volte ao Portal dos Games e abra de novo.");
      if (isZip) return res;
      return res.arrayBuffer().then(function (b) {
        var z = storedZip("__vg_jogo/" + name, new Uint8Array(b));
        return new Response(z, { status: 200, headers: { "Content-Length": String(z.length), "Content-Type": "application/zip" } });
      });
    });
  };
})();
`;

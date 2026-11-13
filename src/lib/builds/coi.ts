import { COI_FILE } from "./paths";

/*
 * Isolamento entre origens (crossOriginIsolated) sem poder definir cabeçalhos
 * no servidor.
 *
 * Godot 4 com threads, Unity com "Native C/C++ Multithreading" e qualquer
 * wasm com pthreads precisam de SharedArrayBuffer, que o navegador só libera
 * quando o documento chega com:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 * O MinIO não deixa gravar esses cabeçalhos num objeto (só Content-Type,
 * Content-Encoding, Cache-Control, Content-Disposition, Content-Language e
 * Expires). A saída é um service worker na pasta do build que acrescenta os
 * cabeçalhos às respostas, como faz o projeto coi-serviceworker (MIT, Guido
 * Zuidhof, https://github.com/gzuidhof/coi-serviceworker) a partir do texto
 * de stefnotch (https://dev.to/stefnotch/enabling-coop-coep-without-touching-the-server-2d3n).
 * O código abaixo foi escrito do zero para a VibeGames; nenhum trecho foi copiado.
 *
 * O mesmo arquivo roda em dois papéis:
 * - como service worker: repassa cada pedido e devolve a resposta com
 *   COOP/COEP/CORP;
 * - como <script> no topo do index.html: se a página ainda não está isolada,
 *   para o carregamento do jogo (window.stop), registra o worker e então
 *   recarrega (aba própria) ou avisa a página da VibeGames que o embute
 *   (iframe), que se recarrega com COEP para que o iframe também fique isolado.
 *
 * Mensagens para a página que embute (postMessage, sem dados sensíveis):
 *   { vg: "coi", estado: "pronto" }     worker ativo; pode recarregar isolado
 *   { vg: "coi", estado: "isolado" }    o jogo está isolado e vai começar
 *   { vg: "coi", estado: "sem-suporte" } navegador sem service worker ou sem contexto seguro
 */

export const COI_SCRIPT = `/* VibeGames: isolamento entre origens por service worker (código próprio; ideia do coi-serviceworker, MIT). */
(function () {
  "use strict";
  if (typeof window === "undefined") {
    self.addEventListener("install", function () { self.skipWaiting(); });
    self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });
    self.addEventListener("fetch", function (event) {
      var req = event.request;
      if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
      event.respondWith(fetch(req).then(function (res) {
        if (res.status === 0) return res;
        var headers = new Headers(res.headers);
        headers.set("Cross-Origin-Embedder-Policy", "require-corp");
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
        headers.set("Cross-Origin-Resource-Policy", "cross-origin");
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers: headers });
      }));
    });
    return;
  }
  var framed = window.top !== window.self;
  function tell(estado) {
    if (framed) { try { window.parent.postMessage({ vg: "coi", estado: estado }, "*"); } catch (e) {} }
  }
  if (window.crossOriginIsolated) {
    try { sessionStorage.removeItem("vg-coi-tentativa"); } catch (e) {}
    tell("isolado");
    return;
  }
  if (!window.isSecureContext || !("serviceWorker" in navigator)) { tell("sem-suporte"); return; }
  var sw = navigator.serviceWorker;
  var src = document.currentScript && document.currentScript.src;
  if (!src) { tell("sem-suporte"); return; }
  if (!framed) {
    var KEY = "vg-coi-tentativa";
    var tries = 0;
    try { tries = Number(sessionStorage.getItem(KEY) || 0); } catch (e) {}
    if (tries >= 1) { try { sessionStorage.removeItem(KEY); } catch (e) {} return; }
    try { sessionStorage.setItem(KEY, String(tries + 1)); } catch (e) {}
  }
  if (sw.controller && framed) { window.stop(); tell("pronto"); return; }
  window.stop();
  sw.register(src).then(function (reg) {
    var worker = reg.installing || reg.waiting || reg.active;
    function done() { if (framed) tell("pronto"); else window.location.reload(); }
    if (!worker || worker.state === "activated") return done();
    worker.addEventListener("statechange", function () { if (worker.state === "activated") done(); });
  }, function () { tell("sem-suporte"); });
})();
`;

const enc = new TextEncoder();

/**
 * Acrescenta <script src="__vg_coi.js"></script> logo depois de <head>
 * (ou de <html>, ou do doctype), trabalhando nos bytes para não estragar
 * HTML que não esteja em UTF-8.
 */
export function injectCoiScript(html: Uint8Array): Uint8Array {
  // latin1 mapeia cada byte para um caractere: os índices continuam os mesmos.
  const text = new TextDecoder("latin1").decode(html);
  const tag = enc.encode(`<script src="${COI_FILE}"></script>`);
  let at = -1;
  for (const re of [/<head(\s[^>]*)?>/i, /<html(\s[^>]*)?>/i, /<!doctype[^>]*>/i]) {
    const m = re.exec(text);
    if (m) {
      at = m.index + m[0].length;
      break;
    }
  }
  if (at < 0) at = 0;
  // Já injetado (envio repetido): não duplica.
  if (text.includes(`src="${COI_FILE}"`)) return html;
  const out = new Uint8Array(html.length + tag.length);
  out.set(html.subarray(0, at), 0);
  out.set(tag, at);
  out.set(html.subarray(at), at + tag.length);
  return out;
}

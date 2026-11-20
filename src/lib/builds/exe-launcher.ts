/*
 * A página que roda um jogo de Windows no Boxedwine. Fica no bucket jogável,
 * na pasta do Boxedwine (os arquivos dele são pedidos por caminho relativo),
 * e abre num iframe com sandbox na página /jogar/exe/<id>: a origem é a do
 * MinIO, nunca a do site.
 *
 * O boxedwine-shell.js oficial monta o sistema de arquivos e os argumentos do
 * emulador a partir de um objeto Config e de funções globais. Em vez de
 * copiar e editar o shell, este script troca quatro delas depois que ele
 * carrega:
 * - setConfiguration: o .exe e a pasta de trabalho vêm da página do Portal,
 *   não da URL; tudo em memória (nada de IndexedDB compartilhado entre jogos);
 * - buildAppFileSystem: grava o zip do jogo (montado em C:\files) ou o .exe
 *   sozinho (em D:\) direto no sistema de arquivos do Emscripten;
 * - loadFile: o boxedwine.zip (o Wine, ~37 MB) começa a baixar assim que a
 *   página abre, com progresso, em paralelo com o jogo;
 * - startEmulator: avisa a página do Portal que o jogo começou.
 * Os elementos escondidos existem porque o shell os procura pelo id.
 *
 * Conversa com a página do Portal por postMessage (tipos em exe.ts).
 */

export const EXE_LAUNCHER_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Jogo para Windows</title>
<style>
html,body{margin:0;width:100%;height:100%;background:#12131b;overflow:hidden}
#dropzone{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
#canvas{display:block;outline:none;image-rendering:pixelated;cursor:default}
.vg-off{display:none}
</style>
</head>
<body>
<div class="vg-off" aria-hidden="true">
<figure id="spinner"></figure><div id="status"></div><progress id="progress"></progress>
<button id="startbtn"></button><button id="uploadbtn"></button><input id="upload" type="file"><button id="downloadbtn"></button>
<a id="modalLink"></a><a id="modalLinkExe"></a><a id="openModalExeClick"></a>
<span id="sound-checkbox"><input type="checkbox" id="soundToggle" checked></span>
<input type="checkbox" id="pointerLock"><input type="checkbox" id="showConsole"><input type="checkbox" id="resize">
<textarea id="output"></textarea><input id="selectedItem"><div id="tree"></div><h3 id="loadStatus"></h3>
<div id="message"></div><div id="items"></div>
</div>
<div id="dropzone"><canvas id="canvas" tabindex="0" oncontextmenu="event.preventDefault()"></canvas></div>
<script src="boxedwine-shell.js"></script>
<script>
(function () {
  "use strict";
  var up = window.parent !== window ? window.parent : null;
  var ended = false;
  function tell(m) { m.vg = "exe"; if (up) up.postMessage(m, "*"); }
  var lines = [];
  function remember() {
    var t = Array.prototype.join.call(arguments, " ");
    lines.push(t);
    if (lines.length > 30) lines.shift();
    // Erros do Wine que encerram o jogo sem derrubar o emulador.
    var dll = /err:module:import_dll Library (\\S+)[^\\n]* not found/.exec(t);
    if (dll) fail("O jogo precisa de " + dll[1] + ", que o Wine do navegador não tem.");
    else if (game && /err:module:process_init .* not found/.test(t) && t.toLowerCase().indexOf(Config.Program.toLowerCase()) >= 0) {
      fail("O Wine não achou " + Config.Program + " dentro do arquivo.");
    }
  }
  function fail(msg) {
    if (ended) return;
    ended = true;
    tell({ estado: "erro", mensagem: msg, detalhe: lines.slice(-12).join("\\n") });
  }

  Config.storageMode = STORAGE_MEMORY;
  Config.persist_d_drive = false;
  Config.urlParams = "sound=true";
  Module.print = remember;
  Module.printErr = remember;
  Module.onAbort = function (what) { fail("O emulador parou com um erro" + (what ? ": " + what : ".")); };
  Module.onExit = function () { if (!ended) { ended = true; tell({ estado: "fim" }); } };
  window.addEventListener("error", function (e) { fail("O emulador parou com um erro" + (e && e.message ? ": " + e.message : ".")); });

  var canvas = document.getElementById("canvas");
  function fit() {
    var w = canvas.width || 640, h = canvas.height || 480;
    var s = Math.min(window.innerWidth / w, window.innerHeight / h) || 1;
    var cw = Math.floor(w * s) + "px", ch = Math.floor(h * s) + "px";
    if (canvas.style.width !== cw) canvas.style.width = cw;
    if (canvas.style.height !== ch) canvas.style.height = ch;
  }
  new MutationObserver(fit).observe(canvas, { attributes: true, attributeFilter: ["width", "height", "style"] });
  window.addEventListener("resize", fit);
  fit();
  function resumeAudio() {
    try {
      var c = Module.SDL2 && Module.SDL2.audioContext;
      if (c && c.state === "suspended") c.resume();
    } catch (e) {}
  }
  window.addEventListener("pointerdown", function () { canvas.focus(); resumeAudio(); }, true);
  window.addEventListener("keydown", resumeAudio, true);

  var root = fetch("boxedwine.zip").then(function (res) {
    if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
    var total = Number(res.headers.get("content-length")) || 0, got = 0, parts = [], last = 0;
    var reader = res.body.getReader();
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          var out = new Uint8Array(got), at = 0;
          for (var i = 0; i < parts.length; i++) { out.set(parts[i], at); at += parts[i].length; }
          tell({ estado: "runtime", carregado: got, total: got });
          return out;
        }
        parts.push(r.value);
        got += r.value.length;
        var now = Date.now();
        if (now - last > 200) { last = now; tell({ estado: "runtime", carregado: got, total: total }); }
        return pump();
      });
    }
    return pump();
  });
  root.catch(function () {});

  var game = null;
  var shellLoadFile = loadFile;
  loadFile = function (prefix, name, cb) {
    if (name !== Config.rootZipFile) return shellLoadFile(prefix, name, cb);
    root.then(cb, function () { fail("Não deu para baixar o Wine (boxedwine.zip). Confira a conexão e recarregue a página."); });
  };
  var shellSetConfiguration = setConfiguration;
  setConfiguration = function () {
    shellSetConfiguration();
    var slash = game.exe.lastIndexOf("/");
    Config.isAutoRunSet = true;
    Config.loadDesktop = false;
    Config.isSoundEnabled = true;
    Config.Program = game.exe.slice(slash + 1);
    if (game.zip) {
      Config.appZipFile = "app.zip";
      Config.WorkingDir = DEFAULT_APP_DIRECTORY + (slash > 0 ? "/" + game.exe.slice(0, slash) : "");
    } else {
      Config.appZipFile = "";
      Config.WorkingDir = "/home/username/.wine/dosdevices/d:";
    }
  };
  buildAppFileSystem = function (cb) {
    if (game.zip) createFile("/", "app.zip", game.bytes);
    else createFile(Config.d_drive, Config.Program, game.bytes);
    game.bytes = null;
    cb();
  };
  var shellStartEmulator = startEmulator;
  startEmulator = function () {
    tell({ estado: "rodando" });
    shellStartEmulator();
    canvas.focus();
    resumeAudio();
  };

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (e.source !== up || game || !d || d.vg !== "exe" || !(d.arquivo instanceof Blob) || typeof d.exe !== "string" || !d.exe) return;
    game = { zip: Boolean(d.zip), exe: d.exe, bytes: null };
    tell({ estado: "iniciando" });
    d.arquivo.arrayBuffer().then(function (buf) {
      game.bytes = new Uint8Array(buf);
      var s = document.createElement("script");
      s.src = "boxedwine.js";
      s.onerror = function () { fail("Não deu para baixar o emulador (boxedwine.js). Recarregue a página."); };
      document.body.appendChild(s);
    }, function () { fail("Não deu para ler o arquivo do jogo."); });
  });
  tell({ estado: "pronto" });
})();
</script>
</body>
</html>
`;

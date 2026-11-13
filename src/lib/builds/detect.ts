import { baseOf, dirOf, isJunk } from "./paths";

/*
 * Reconhecimento de builds de navegador: motor, HTML de entrada, tamanho da
 * tela, necessidade de isolamento entre origens (SharedArrayBuffer) e avisos.
 * Tudo puro: recebe a lista de arquivos e os textos/bytes que o chamador já
 * leu (sniffTargets diz quais), devolve um relatório. Roda no navegador antes
 * do envio e nos testes.
 */

export type BuildEngine =
  | "unity"
  | "godot"
  | "unreal-html5"
  | "construct"
  | "gamemaker"
  | "defold"
  | "pico8"
  | "bevy"
  | "ruffle"
  | "html5";

export const ENGINE_LABEL: Record<BuildEngine, string> = {
  unity: "Unity (WebGL / Web)",
  godot: "Godot",
  "unreal-html5": "Unreal 4 (HTML5)",
  construct: "Construct",
  gamemaker: "GameMaker (HTML5)",
  defold: "Defold",
  pico8: "PICO-8",
  bevy: "Rust / Bevy (wasm-bindgen)",
  ruffle: "Flash (Ruffle)",
  html5: "HTML5",
};

export const ENGINES = Object.keys(ENGINE_LABEL) as BuildEngine[];

export interface BuildFileInfo {
  path: string;
  size: number;
}

export interface Notice {
  level: "erro" | "aviso" | "info";
  text: string;
}

export interface Sniffed {
  /** Texto (UTF-8, cortado) dos arquivos pedidos em sniffTargets().text. */
  texts: Record<string, string>;
  /** Para cada .wasm lido: true se importa ou declara memória compartilhada; null se não deu para ler. */
  wasmShared: Record<string, boolean | null>;
}

export interface Detection {
  engine: BuildEngine;
  /** Versão aproximada, quando dá para saber (ex.: "4.3+", "3.x"). */
  version: string | null;
  /** HTML de entrada escolhido, ou null se há mais de um e é preciso escolher. */
  entry: string | null;
  /** Todos os HTML que podem ser a entrada, do mais provável ao menos. */
  entryCandidates: string[];
  needsIsolation: boolean;
  /** Por que o isolamento foi ligado (ou por que não dá para saber). */
  isolationReason: string | null;
  /** Ao menos um .wasm não pôde ser lido (Brotli): a detecção de threads é incerta. */
  isolationUncertain: boolean;
  width: number | null;
  height: number | null;
  /** Para Flash: HTML gerado pela plataforma (não havia HTML no zip). */
  generateRuffleEntry: string | null;
  notices: Notice[];
  /** Algo impede o envio como build de navegador. */
  blocked: boolean;
}

/* ------------------------------------------------------------------ */

const lowerExt = (p: string) => {
  const b = baseOf(p).toLowerCase();
  const i = b.lastIndexOf(".");
  return i < 0 ? "" : b.slice(i + 1);
};
const isHtml = (p: string) => /\.html?$/i.test(p);

/** Quais arquivos o chamador precisa ler para detectar o motor. */
export function sniffTargets(files: BuildFileInfo[]): { text: string[]; wasm: string[] } {
  const paths = files.map((f) => f.path);
  const htmls = entryCandidates(paths).slice(0, 4);
  const wasm = files
    .filter((f) => /\.wasm(\.gz|\.br)?$/i.test(f.path) || /\.wasmgz$/i.test(f.path) || (/\.unityweb$/i.test(f.path) && /wasm/i.test(f.path)))
    .sort((a, b) => b.size - a.size)
    .slice(0, 3)
    .map((f) => f.path);
  return { text: htmls, wasm };
}

/**
 * HTML que podem ser a entrada: index.html na raiz primeiro, depois outros
 * HTML na raiz, depois index.html na pasta mais rasa.
 */
export function entryCandidates(paths: string[]): string[] {
  const htmls = paths.filter((p) => isHtml(p) && !isJunk(p));
  const depth = (p: string) => p.split("/").length;
  const score = (p: string) => {
    const base = baseOf(p).toLowerCase();
    return depth(p) * 10 + (base === "index.html" || base === "index.htm" ? 0 : 5);
  };
  return [...htmls].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

/** Escolhe a entrada sem ambiguidade, ou null. */
export function pickEntry(paths: string[]): string | null {
  const c = entryCandidates(paths);
  if (c.length === 0) return null;
  const rootIndex = c.find((p) => /^index\.html?$/i.test(p));
  if (rootIndex) return rootIndex;
  const root = c.filter((p) => !p.includes("/"));
  if (root.length === 1) return root[0];
  if (root.length > 1) return null;
  // Nenhum HTML na raiz: só aceita se houver exatamente um na pasta mais rasa.
  const minDepth = Math.min(...c.map((p) => p.split("/").length));
  const shallow = c.filter((p) => p.split("/").length === minDepth);
  const idx = shallow.filter((p) => /\/index\.html?$/i.test(p));
  if (idx.length === 1) return idx[0];
  return shallow.length === 1 ? shallow[0] : null;
}

/** Largura e altura do <canvas> do HTML, se declaradas. */
export function canvasSize(html: string): { width: number; height: number } | null {
  const canvas = html.match(/<canvas\b[^>]*>/i)?.[0];
  if (canvas) {
    const w = canvas.match(/\bwidth\s*=\s*["']?(\d{2,5})/i);
    const h = canvas.match(/\bheight\s*=\s*["']?(\d{2,5})/i);
    if (w && h) return sane(Number(w[1]), Number(h[1]));
    const style = canvas.match(/style\s*=\s*["'][^"']*width:\s*(\d{2,5})px[^"']*height:\s*(\d{2,5})px/i);
    if (style) return sane(Number(style[1]), Number(style[2]));
  }
  // Modelo padrão do Unity: #unity-container / canvas com width/height em CSS.
  const css = html.match(/#unity-canvas\s*\{[^}]*width:\s*(\d{2,5})px;[^}]*height:\s*(\d{2,5})px/i);
  if (css) return sane(Number(css[1]), Number(css[2]));
  return null;
}

function sane(w: number, h: number) {
  if (w < 64 || h < 64 || w > 8192 || h > 8192) return null;
  return { width: w, height: h };
}

/**
 * true se o módulo WebAssembly importa ou declara memória compartilhada
 * (threads: exige SharedArrayBuffer, logo isolamento entre origens).
 * Lê só o começo do arquivo: seções de tipos, importações e memória.
 * Devolve null se os bytes não bastam ou não são WebAssembly. `complete`
 * diz se `bytes` é o arquivo inteiro (aí, sem memória compartilhada = false).
 */
export function wasmUsesSharedMemory(bytes: Uint8Array, complete = false): boolean | null {
  if (bytes.length < 8 || bytes[0] !== 0 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) return null;
  let pos = 8;
  const u32 = (): number => {
    let result = 0;
    let shift = 0;
    for (let i = 0; i < 5; i++) {
      if (pos >= bytes.length) throw new RangeError("eof");
      const b = bytes[pos++];
      result += (b & 0x7f) * 2 ** shift;
      if (!(b & 0x80)) return result;
      shift += 7;
    }
    throw new RangeError("leb");
  };
  const skip = (n: number) => {
    pos += n;
    if (pos > bytes.length) throw new RangeError("eof");
  };
  const limitsShared = (): boolean => {
    const flags = u32();
    u32(); // mínimo
    if (flags & 0x01) u32(); // máximo
    return (flags & 0x02) !== 0;
  };
  try {
    while (pos < bytes.length) {
      const id = bytes[pos++];
      const size = u32();
      const end = pos + size;
      if (id === 2) {
        const count = u32();
        for (let i = 0; i < count; i++) {
          skip(u32()); // módulo
          skip(u32()); // nome
          const kind = bytes[pos++];
          if (kind === 0) u32();
          else if (kind === 1) {
            pos++; // tipo de referência
            limitsShared();
          } else if (kind === 2) {
            if (limitsShared()) return true;
          } else if (kind === 3) skip(2);
          else if (kind === 4) {
            pos++;
            u32();
          } else return null;
        }
      } else if (id === 5) {
        const count = u32();
        for (let i = 0; i < count; i++) if (limitsShared()) return true;
        return false;
      } else if (id > 5 && id !== 0 && id !== 12 && id !== 13) {
        // Passou da seção de memória sem achar memória compartilhada.
        return false;
      }
      // Uma seção anterior à de memória não coube nos bytes lidos: inconclusivo.
      if (end > bytes.length) return null;
      pos = end;
    }
    // Acabaram os bytes antes da seção de memória: só é "não" se o arquivo veio inteiro.
    return complete ? false : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Detecção                                                            */
/* ------------------------------------------------------------------ */

interface EngineGuess {
  engine: BuildEngine;
  version: string | null;
}

function guessEngine(paths: string[], html: string): EngineGuess {
  const lower = paths.map((p) => p.toLowerCase());
  const has = (re: RegExp) => lower.some((p) => re.test(p));

  if (has(/\.loader\.js$/) && has(/\.(framework\.js|wasm|data)(\.br|\.gz|\.unityweb)?$|\.unityweb$/))
    return { engine: "unity", version: "2020+" };
  if (has(/(^|\/)unityloader\.js$/)) return { engine: "unity", version: "2019 ou anterior" };
  if (/createUnityInstance|unityFramework|UnityLoader/.test(html)) return { engine: "unity", version: null };

  if (/GODOT_CONFIG|new Engine\(/.test(html) || (has(/\.pck$/) && has(/\.wasm$/))) {
    if (/GODOT_THREADS_ENABLED/.test(html)) return { engine: "godot", version: "4.3+" };
    if (/gdextensionLibs|ensureCrossOriginIsolationHeaders/.test(html)) return { engine: "godot", version: "4.0–4.2" };
    if (/gdnativeLibs|GODOT_CONFIG/.test(html)) return { engine: "godot", version: "3.x" };
    return { engine: "godot", version: null };
  }

  if (has(/\.ue4\.js(\.gz)?$|-html5-shipping\.js$|-html5-shipping\.jsgz$/) || /UE4\.js|Module\['UE4_/.test(html))
    return { engine: "unreal-html5", version: "4.x" };

  if (has(/(^|\/)(scripts\/)?c3runtime\.js$|(^|\/)scripts\/c3main\.js$/)) return { engine: "construct", version: "3" };
  if (has(/(^|\/)c2runtime\.js$/)) return { engine: "construct", version: "2" };

  if (has(/(^|\/)dmloader\.js$/) || has(/(^|\/)archive\/archive_files\.json$/)) return { engine: "defold", version: null };

  if (has(/^html5game\//) || /GameMaker|GM_RUNNER|html5game\//.test(html)) return { engine: "gamemaker", version: "HTML5" };
  if (has(/(^|\/)runner\.wasm$/) && has(/(^|\/)game\.(unx|droid)$|runner\.data$/)) return { engine: "gamemaker", version: "GX / WASM" };

  if (/pico8_|_cartdat|PICO-8/.test(html)) return { engine: "pico8", version: null };

  if (has(/_bg\.wasm$/) || /__wbindgen|wasm_bindgen/.test(html)) return { engine: "bevy", version: null };

  if (has(/\.swf$/) && (!paths.some(isHtml) || /ruffle/i.test(html))) return { engine: "ruffle", version: null };

  return { engine: "html5", version: null };
}

/** Builds de computador mandados por engano: o que é e o que fazer. */
function desktopBuild(paths: string[]): string | null {
  const lower = paths.map((p) => p.toLowerCase());
  const has = (re: RegExp) => lower.some((p) => re.test(p));
  if (has(/\.pak$/) && (has(/(^|\/)engine\/binaries\//) || has(/content\/paks\//))) {
    return "Isto é um build de computador do Unreal. O Unreal 5 não exporta para navegador (a exportação HTML5 saiu do motor na versão 4.24) e o Pixel Streaming exige um servidor com placa de vídeo rodando o jogo para cada jogador, o que esta plataforma não oferece. Envie o zip em Downloads, como build de Windows, macOS ou Linux.";
  }
  if (has(/(^|\/)unityplayer\.dll$|_data\/globalgamemanagers$|unityplayer\.so$/)) {
    return "Isto é um build de computador do Unity. Para jogar no navegador, exporte para Web (WebGL) no Unity; este zip vai em Downloads.";
  }
  if (has(/\.apk$|\.aab$/)) return "Isto é um aplicativo Android. Envie em Downloads, na plataforma Android.";
  if (has(/\.app\/contents\//)) return "Isto é um aplicativo de macOS. Envie em Downloads, na plataforma macOS.";
  if (has(/\.exe$/)) return "Isto é um build de Windows. Envie em Downloads, na plataforma Windows; aqui só entram builds que rodam no navegador.";
  if (has(/\.x86_64$|\.x86$/)) return "Isto é um build de Linux. Envie em Downloads, na plataforma Linux.";
  return null;
}

/** Referências do HTML de entrada que não existem no build (ou existem com outra caixa). */
export function missingReferences(entry: string, html: string, paths: string[]): { missing: string[]; caseOnly: string[] } {
  const set = new Set(paths);
  const lowerMap = new Map(paths.map((p) => [p.toLowerCase(), p]));
  const dir = dirOf(entry);
  const missing: string[] = [];
  const caseOnly: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'<>]+)["']/gi)) {
    const ref = m[1].trim();
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(ref) || ref.includes("${") || ref.includes("{{")) continue;
    let rel = ref.split(/[?#]/)[0];
    try {
      rel = decodeURIComponent(rel);
    } catch {
      continue;
    }
    const resolved = resolve(dir, rel);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    if (set.has(resolved)) continue;
    if (lowerMap.has(resolved.toLowerCase())) caseOnly.push(resolved);
    else missing.push(resolved);
  }
  return { missing, caseOnly };
}

function resolve(dir: string, rel: string): string | null {
  const out = dir.split("/").filter(Boolean);
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(seg);
  }
  return out.join("/") || null;
}

const GiB = 1024 ** 3;

export function detectBuild(files: BuildFileInfo[], sniffed: Sniffed, chosenEntry?: string | null): Detection {
  const paths = files.map((f) => f.path);
  const notices: Notice[] = [];
  const candidates = entryCandidates(paths);
  let entry = chosenEntry && candidates.includes(chosenEntry) ? chosenEntry : pickEntry(paths);
  const html = (entry && sniffed.texts[entry]) || (candidates[0] && sniffed.texts[candidates[0]]) || "";
  const guess = guessEngine(paths, html);
  let blocked = false;
  let generateRuffleEntry: string | null = null;

  const desktop = candidates.length === 0 ? desktopBuild(paths) : null;
  if (desktop) {
    notices.push({ level: "erro", text: desktop });
    blocked = true;
  } else if (candidates.length === 0) {
    if (guess.engine === "ruffle") {
      const swfs = paths.filter((p) => /\.swf$/i.test(p));
      if (swfs.length === 1) {
        generateRuffleEntry = swfs[0];
        entry = "index.html";
        notices.push({
          level: "info",
          text: "Só há um .swf: a plataforma cria um index.html que roda o Flash com o Ruffle (emulador de código aberto), carregado do unpkg.com. Recursos de Flash que o Ruffle ainda não cobre podem não funcionar.",
        });
      } else {
        notices.push({ level: "erro", text: "Há mais de um .swf e nenhum HTML. Inclua um index.html que carregue o .swf principal com o Ruffle." });
        blocked = true;
      }
    } else {
      notices.push({ level: "erro", text: "Não há nenhum arquivo .html. Um build de navegador precisa de uma página de entrada, normalmente index.html." });
      blocked = true;
    }
  } else if (!entry) {
    notices.push({ level: "aviso", text: "Há mais de uma página HTML e nenhuma se chama index.html. Escolha qual abre o jogo." });
  }

  // Isolamento entre origens.
  let needsIsolation = false;
  let isolationReason: string | null = null;
  const wasmEntries = Object.entries(sniffed.wasmShared);
  const sharedWasm = wasmEntries.find(([, v]) => v === true);
  const isolationUncertain = wasmEntries.some(([, v]) => v === null);
  if (sharedWasm) {
    needsIsolation = true;
    isolationReason = `${baseOf(sharedWasm[0])} usa memória compartilhada (threads), que exige SharedArrayBuffer.`;
  } else if (guess.engine === "godot") {
    const threadsFlag = html.match(/GODOT_THREADS_ENABLED\s*=\s*(true|false)/);
    if (threadsFlag?.[1] === "true") {
      needsIsolation = true;
      isolationReason = "O build do Godot foi exportado com suporte a threads.";
    } else if (!threadsFlag && guess.version === "4.0–4.2") {
      needsIsolation = true;
      isolationReason = "Godot 4.0 a 4.2 sempre usa threads no navegador.";
    } else if (paths.some((p) => /\.worker\.js$/i.test(p)) && guess.version !== "4.3+") {
      needsIsolation = true;
      isolationReason = "O build traz um .worker.js de threads.";
    }
  } else if (paths.some((p) => /\.worker\.js$/i.test(p)) && (guess.engine === "unity" || guess.engine === "unreal-html5")) {
    needsIsolation = true;
    isolationReason = "O build traz um .worker.js de threads (pthreads do Emscripten).";
  }

  if (needsIsolation) {
    notices.push({
      level: "info",
      text: "Este build usa threads e precisa de isolamento entre origens (SharedArrayBuffer). A plataforma acrescenta um service worker que liga o isolamento; na primeira vez a página do jogo recarrega uma vez.",
    });
  } else if (isolationUncertain) {
    notices.push({
      level: "aviso",
      text: "Não deu para ler o .wasm comprimido em Brotli neste navegador, então não sabemos se o build usa threads. Se você ligou threads no motor (no Unity, “Enable Native C/C++ Multithreading”), marque “Precisa de isolamento”.",
    });
  }

  // Avisos por motor.
  const lowerPaths = paths.map((p) => p.toLowerCase());
  if (guess.engine === "unity") {
    if (lowerPaths.some((p) => p.endsWith(".br"))) {
      notices.push({ level: "info", text: "Compressão Brotli: cada .br é servido com Content-Encoding: br e o tipo certo (.wasm.br como application/wasm). O navegador só descomprime Brotli em HTTPS." });
    }
    if (lowerPaths.some((p) => p.endsWith(".gz"))) {
      notices.push({ level: "info", text: "Compressão Gzip: cada .gz é servido com Content-Encoding: gzip e o tipo certo." });
    }
    if (lowerPaths.some((p) => p.endsWith(".unityweb"))) {
      notices.push({ level: "aviso", text: "Build com “Decompression Fallback” (.unityweb): funciona, mas o descompressor embutido deixa o carregamento mais lento. Como aqui os cabeçalhos ficam certos, prefira exportar com Brotli e sem o fallback." });
    }
  }
  if (guess.engine === "godot" && /"serviceWorker"\s*:\s*"[^"]+"/.test(html) && needsIsolation) {
    notices.push({ level: "info", text: "O build do Godot traz o próprio service worker (PWA). O isolamento da plataforma roda antes dele, então o do Godot só entra se o nosso falhar." });
  }
  if (guess.engine === "unreal-html5") {
    notices.push({ level: "info", text: "Unreal 4 com HTML5 (exportação oficial até 4.23, plugin da comunidade até 4.24/4.27). Os .gz são servidos com Content-Encoding: gzip. O Unreal 5 não exporta para navegador." });
  }
  if (guess.engine === "construct" && lowerPaths.includes("sw.js")) {
    notices.push({ level: "info", text: "O Construct traz um service worker (sw.js) para jogar sem internet. Ele funciona aqui, preso à pasta deste build." });
  }

  const big = files.find((f) => f.size > 2 * GiB);
  if (big) {
    notices.push({ level: "aviso", text: `${baseOf(big.path)} passa de 2 GB. Muitos navegadores não conseguem carregar um arquivo desse tamanho na memória; teste antes de publicar.` });
  }

  if (entry && html) {
    const refs = missingReferences(entry, html, paths);
    if (refs.caseOnly.length) {
      notices.push({
        level: "aviso",
        text: `A página pede ${refs.caseOnly.slice(0, 3).join(", ")} com maiúsculas e minúsculas diferentes do arquivo. Aqui os nomes diferenciam maiúsculas: ajuste o HTML ou o nome do arquivo.`,
      });
    }
    if (refs.missing.length) {
      notices.push({ level: "aviso", text: `A página pede arquivos que não estão no build: ${refs.missing.slice(0, 3).join(", ")}${refs.missing.length > 3 ? "…" : ""}.` });
    }
  }

  const size = html ? canvasSize(html) : null;
  let width = size?.width ?? null;
  let height = size?.height ?? null;
  if (!size && guess.engine === "pico8") {
    width = 512;
    height = 512;
  }

  return {
    engine: guess.engine,
    version: guess.version,
    entry,
    entryCandidates: candidates,
    needsIsolation,
    isolationReason,
    isolationUncertain: isolationUncertain && !needsIsolation,
    width,
    height,
    generateRuffleEntry,
    notices,
    blocked,
  };
}

/** HTML mínimo que roda um .swf com o Ruffle (MIT/Apache-2.0), versão fixa no unpkg. */
export const RUFFLE_VERSION = "0.7.1";
export function ruffleHtml(swf: string): string {
  const safe = swf.replace(/[^\w./ -]/g, "");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flash</title>
<style>html,body{margin:0;height:100%;background:#000}ruffle-player,ruffle-embed{width:100%;height:100%;display:block}</style>
<script src="https://unpkg.com/@ruffle-rs/ruffle@${RUFFLE_VERSION}/ruffle.js"></script>
</head>
<body>
<div id="jogo" style="width:100%;height:100%"></div>
<script>
window.RufflePlayer = window.RufflePlayer || {};
window.addEventListener("load", function () {
  var player = window.RufflePlayer.newest().createPlayer();
  document.getElementById("jogo").appendChild(player);
  (player.ruffle ? player.ruffle() : player).load(${JSON.stringify(encodeURI(safe))});
});
</script>
</body>
</html>
`;
}

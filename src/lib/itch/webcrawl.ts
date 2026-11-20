/*
 * Versão de navegador de um jogo do itch.io: o itch serve o build como arquivos
 * soltos em https://html(-classic).itch.zone/html/<id>/... (sem zip, sem listagem,
 * sem CORS). Aqui fica a parte sem rede: achar a página de entrada na página do
 * jogo e, em cada arquivo de texto, as referências a outros arquivos do build.
 *
 * ponytail: descobre os arquivos seguindo referências (atributos do HTML, url()
 * do CSS, textos entre aspas no JS/JSON com extensão conhecida). Cobre builds
 * Vite/HTML5, Godot, Construct, PICO-8 e a maioria dos Unity; um arquivo que só
 * é montado em tempo de execução (nome calculado) fica de fora e o jogo avisa ao
 * rodar. Aí o criador envia o zip pelo painel de builds.
 */

const ROOT_RE = /^https:\/\/html(?:-classic)?\.itch\.zone\/html\/\d+\//;

const decodeAttr = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Raiz do build (https://html…itch.zone/html/<id>/) e caminho da página de entrada, a partir da página do jogo. */
export function webEntryOf(pageHtml: string): { root: string; entry: string } | null {
  for (const m of pageHtml.matchAll(/data-iframe="([^"]*)"/g)) {
    const src = /\bsrc="([^"]+)"/.exec(decodeAttr(m[1]))?.[1];
    if (!src) continue;
    let u: URL;
    try {
      u = new URL(decodeAttr(src));
    } catch {
      continue;
    }
    const root = ROOT_RE.exec(u.origin + u.pathname)?.[0];
    if (!root) continue;
    const entry = decodeURIComponent(u.pathname.slice(new URL(root).pathname.length));
    if (entry && /\.html?$/i.test(entry)) return { root, entry };
  }
  return null;
}

/** Extensões de arquivo que um build costuma carregar. */
const EXT = "html?|m?js|css|json|wasm|pck|data|mem|unityweb|br|gz|png|jpe?g|webp|gif|svg|ico|bmp|ktx2?|basis|ogg|oga|mp3|wav|m4a|aac|flac|opus|webm|mp4|ttf|otf|woff2?|fnt|xml|txt|csv|bin|glb|gltf|obj|mtl|atlas|tmx|tsx|ldtk|p8|swf|zip|webmanifest|map";
const LITERAL = new RegExp(`["'\`]((?:\\.{0,2}/)?[A-Za-z0-9_\\-./%@+~]+?\\.(?:${EXT}))(?:[?#][^"'\`]*)?["'\`]`, "gi");
const CSS_URL = /url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/gi;
const HTML_ATTR = /\b(?:src|href|data-src|poster|data)\s*=\s*["']([^"']+)["']/gi;

export const isTextLike = (p: string) => /\.(html?|m?js|css|json|svg|xml|webmanifest|txt)$/i.test(p);

/** Referências cruas dentro de um arquivo de texto do build. */
export function refsOf(path: string, text: string): string[] {
  const out = new Set<string>();
  const add = (r: string | undefined) => {
    if (!r) return;
    const v = decodeAttr(r.trim());
    if (!v || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(v)) return; // http:, data:, blob:, javascript:, //host, âncora
    out.add(v.replace(/[?#].*$/, ""));
  };
  if (/\.html?$/i.test(path)) for (const m of text.matchAll(HTML_ATTR)) add(m[1]);
  if (/\.(html?|css)$/i.test(path)) for (const m of text.matchAll(CSS_URL)) add(m[1] ?? m[2]);
  if (/\.(html?|m?js|json|webmanifest)$/i.test(path)) for (const m of text.matchAll(LITERAL)) add(m[1]);
  return [...out];
}

/** Normaliza a/b/../c; null se sair da raiz. */
export function normalize(path: string): string | null {
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.length ? parts.join("/") : null;
}

/**
 * Onde uma referência pode estar, do mais provável ao menos: relativa ao
 * arquivo que a cita e relativa à raiz do build (JS empacotado costuma citar
 * caminhos a partir da página, não de si mesmo). "/x" é a raiz do build.
 */
export function candidatesFor(fromPath: string, ref: string): string[] {
  let r: string;
  try {
    r = decodeURIComponent(ref);
  } catch {
    r = ref;
  }
  if (r.startsWith("/")) {
    const n = normalize(r);
    return n ? [n] : [];
  }
  const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/") + 1) : "";
  return [...new Set([normalize(dir + r), normalize(r)].filter((x): x is string => Boolean(x)))];
}

/**
 * Tira do HTML os scripts que o itch.io injeta ao servir o jogo
 * (ex.: <script defer src="https://static.itch.io/htmlgame.js">): fora do
 * itch eles trocam a página pelo aviso "You should be using itch.io".
 */
export function stripItchScripts(html: string): string {
  return html.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\/[^"'\s>]*(?:itch\.io|itch\.zone)[^"'\s>]*["']?[^>]*>\s*<\/script\s*>/gi,
    "",
  );
}

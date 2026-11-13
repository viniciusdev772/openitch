import { COI_FILE } from "./paths";

/*
 * Cabeçalhos HTTP de cada arquivo de um build de navegador.
 *
 * O MinIO não lê .htaccess nem configuração de servidor: ele devolve o
 * Content-Type, o Content-Encoding e o Cache-Control gravados no objeto no
 * momento do envio. Então a plataforma decide esses valores aqui, a partir
 * da extensão, e o servidor os ASSINA na URL de envio (o navegador não
 * consegue trocá-los).
 *
 * Fontes das regras (consultadas em 2026-11):
 * - Unity, "Server configuration code samples" (Apache): .br → Content-Encoding br,
 *   .gz → gzip, .wasm(.br|.gz) → application/wasm, .js(.br|.gz) → application/javascript,
 *   .data.br → application/octet-stream, .data.gz → application/gzip (contorna o bug
 *   247421 do WebKit), .symbols.json(.br|.gz) → application/octet-stream,
 *   .unityweb → Content-Encoding conforme a compressão escolhida.
 *   https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/building-distribution/server-configuration-code-samples/web-server-config-apache
 * - Godot, "Exporting for the Web": .wasm como application/wasm, .pck como
 *   application/octet-stream. https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
 * - Unreal 4 HTML5: *.data, *.mem, *.symbols como application/octet-stream sem
 *   Content-Encoding; variantes .gz / *gz (jsgz, datagz, wasmgz) com Content-Encoding gzip.
 *   https://forums.unrealengine.com/t/compressed-shipping-not-working-on-website/152408
 * - Defold: .wasm precisa de application/wasm. https://defold.com/manuals/html5/
 */

export interface ObjectHeaders {
  contentType: string;
  /** "br", "gzip" ou null (sem Content-Encoding). */
  contentEncoding: "br" | "gzip" | null;
  cacheControl: string;
}

const TEXT = "; charset=utf-8";

/** Extensão (minúscula, sem ponto) → Content-Type. */
export const CONTENT_TYPES: Record<string, string> = {
  // Página e código
  html: "text/html" + TEXT,
  htm: "text/html" + TEXT,
  js: "text/javascript" + TEXT,
  mjs: "text/javascript" + TEXT,
  cjs: "text/javascript" + TEXT,
  css: "text/css" + TEXT,
  json: "application/json",
  map: "application/json",
  webmanifest: "application/manifest+json",
  xml: "application/xml",
  txt: "text/plain" + TEXT,
  md: "text/markdown" + TEXT,
  csv: "text/csv" + TEXT,
  ini: "text/plain" + TEXT,
  wasm: "application/wasm",
  // Dados binários de motores (Unity, Godot, Unreal, Defold, GameMaker)
  data: "application/octet-stream",
  pck: "application/octet-stream",
  mem: "application/octet-stream",
  symbols: "application/octet-stream",
  unityweb: "application/octet-stream",
  bin: "application/octet-stream",
  dat: "application/octet-stream",
  pak: "application/octet-stream",
  arcd: "application/octet-stream",
  arci: "application/octet-stream",
  dmanifest: "application/octet-stream",
  projectc: "application/octet-stream",
  unx: "application/octet-stream",
  droid: "application/octet-stream",
  swf: "application/x-shockwave-flash",
  // Áudio
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  mid: "audio/midi",
  midi: "audio/midi",
  // Vídeo
  webm: "video/webm",
  mp4: "video/mp4",
  m4v: "video/mp4",
  ogv: "video/ogg",
  mov: "video/quicktime",
  // Imagem
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  cur: "image/x-icon",
  ktx: "image/ktx",
  ktx2: "image/ktx2",
  basis: "application/octet-stream",
  dds: "application/octet-stream",
  // 3D
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  obj: "model/obj",
  // Fontes
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  // Outros
  pdf: "application/pdf",
  zip: "application/zip",
};

export const DEFAULT_TYPE = "application/octet-stream";

/** Tipos que fazem sentido entregar pré-comprimidos com Content-Encoding. */
const ENCODABLE = new Set(["js", "mjs", "wasm", "data", "json", "mem", "symbols", "pck", "html", "htm", "css", "txt", "svg", "bin", "xml"]);

/** Formato antigo do Unreal 4 HTML5: "jogo.jsgz", "jogo.datagz" etc. */
const UE4_GZ = /\.(js|data|wasm|mem|symbols)gz$/i;

/** Arquivos com caminho único por build: o conteúdo nunca muda (b/<id-aleatório>/...). */
export const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
/** HTML e service worker: o navegador sempre confere com o servidor (ETag, 304 barato). */
export const CACHE_REVALIDATE = "no-cache";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/**
 * Cabeçalhos de um arquivo do build.
 * @param path caminho relativo dentro do build
 * @param unitywebEncoding compressão detectada num .unityweb (o nome não diz qual é)
 */
export function headersFor(path: string, unitywebEncoding: "br" | "gzip" | null = null): ObjectHeaders {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const lower = base.toLowerCase();
  const ext = extOf(lower);

  let contentType = CONTENT_TYPES[ext] ?? DEFAULT_TYPE;
  let contentEncoding: ObjectHeaders["contentEncoding"] = null;

  if (ext === "br" || ext === "gz") {
    const inner = extOf(lower.slice(0, -(ext.length + 1)));
    if (ENCODABLE.has(inner)) {
      contentEncoding = ext === "br" ? "br" : "gzip";
      contentType = CONTENT_TYPES[inner] ?? DEFAULT_TYPE;
      // Unity recomenda application/gzip para .data.gz (bug do Safari) e
      // octet-stream para os símbolos.
      if (inner === "data" && ext === "gz") contentType = "application/gzip";
      if (lower.endsWith(".symbols.json.gz") || lower.endsWith(".symbols.json.br")) contentType = DEFAULT_TYPE;
    } else {
      // Um .gz que o próprio jogo descompacta (ex.: fase.tar.gz): sem Content-Encoding.
      contentType = ext === "gz" ? "application/gzip" : DEFAULT_TYPE;
    }
  } else if (UE4_GZ.test(lower)) {
    const inner = lower.match(UE4_GZ)![1];
    contentEncoding = "gzip";
    contentType = CONTENT_TYPES[inner] ?? DEFAULT_TYPE;
  } else if (ext === "unityweb") {
    contentEncoding = unitywebEncoding;
  }

  const isPage = ext === "html" || ext === "htm" || base === COI_FILE;
  return { contentType, contentEncoding, cacheControl: isPage ? CACHE_REVALIDATE : CACHE_IMMUTABLE };
}

/**
 * Compressão de um .unityweb pelos primeiros bytes. Gzip começa com 1f 8b;
 * o Brotli do Unity carrega o comentário "UnityWeb Compressed Content (brotli)"
 * logo no começo. Qualquer outra coisa: sem Content-Encoding (o descompressor
 * embutido do Unity, "Decompression Fallback", resolve sozinho).
 */
export function sniffUnityweb(head: Uint8Array): "br" | "gzip" | null {
  if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) return "gzip";
  const text = new TextDecoder("latin1").decode(head.subarray(0, 128));
  if (text.includes("UnityWeb Compressed Content (brotli)")) return "br";
  return null;
}

/** Confere se um .gz começa mesmo com a assinatura do gzip. */
export function looksGzip(head: Uint8Array): boolean {
  return head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
}

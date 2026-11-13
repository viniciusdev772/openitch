/*
 * Caminhos dentro de um build de navegador. Funções puras, usadas no
 * navegador (ao ler o zip ou a pasta) e no servidor (antes de assinar
 * qualquer URL). O servidor nunca confia no que o navegador já limpou:
 * roda as mesmas regras de novo.
 */

/** Maior caminho aceito, em caracteres (a chave final é b/<id>/<caminho>). */
export const MAX_PATH_CHARS = 300;
/** Limite de bytes UTF-8 do caminho (o S3 aceita 1024 na chave inteira). */
export const MAX_PATH_BYTES = 900;

/** Arquivo que a plataforma acrescenta quando o build precisa de isolamento. */
export const COI_FILE = "__vg_coi.js";

const CONTROL = /[\u0000-\u001f\u007f]/;
const DRIVE = /^[a-zA-Z]:/;

/**
 * Normaliza um caminho relativo ("pasta/arquivo.ext") ou devolve null se ele
 * for perigoso ou inválido: absoluto, com letra de unidade, com "." ou "..",
 * com caracteres de controle, vazio ou longo demais. Barras invertidas
 * (zips feitos no Windows) viram "/". Não mexe em maiúsculas nem em
 * acentos: o jogo pede os arquivos pelo nome exato.
 */
export function cleanBuildPath(raw: string): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_PATH_CHARS * 2) return null;
  if (CONTROL.test(raw)) return null;
  let p = raw.replace(/\\/g, "/");
  if (p.startsWith("/") || DRIVE.test(p)) return null;
  while (p.startsWith("./")) p = p.slice(2);
  const parts = p.split("/");
  for (const seg of parts) {
    if (seg === "" || seg === "." || seg === "..") return null;
    // Espaços nas pontas somem em alguns sistemas e confundem quem pede o arquivo.
    if (seg !== seg.trim()) return null;
  }
  if (p.length > MAX_PATH_CHARS) return null;
  if (new TextEncoder().encode(p).length > MAX_PATH_BYTES) return null;
  return p;
}

/** Pasta de um caminho, com barra no fim ("" para a raiz). */
export function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i + 1);
}

/** Nome do arquivo, sem pasta. */
export function baseOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Lixo de sistema que nunca faz parte do jogo e é descartado em silêncio. */
export function isJunk(path: string): boolean {
  const lower = path.toLowerCase();
  const base = baseOf(lower);
  return (
    lower.startsWith("__macosx/") ||
    lower.includes("/__macosx/") ||
    base === ".ds_store" ||
    base === "thumbs.db" ||
    base === "desktop.ini" ||
    base.startsWith("._") ||
    lower.startsWith(".git/") ||
    lower.includes("/.git/")
  );
}

/**
 * Se todos os arquivos estão dentro de uma única pasta (o zip "com uma pasta
 * por fora"), devolve essa pasta com barra no fim; senão "". Repete enquanto
 * houver uma pasta só (zip > MeuJogo > Build > ...). Para quando a próxima
 * pasta já tem arquivos soltos ao lado.
 */
export function commonRoot(paths: string[]): string {
  if (paths.length === 0) return "";
  let root = "";
  for (;;) {
    const first = paths[0].slice(root.length);
    const slash = first.indexOf("/");
    if (slash < 0) return root;
    const candidate = root + first.slice(0, slash + 1);
    if (!paths.every((p) => p.startsWith(candidate) && p.length > candidate.length)) return root;
    root = candidate;
  }
}

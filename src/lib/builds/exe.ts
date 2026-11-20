import { baseOf, commonRoot, isJunk } from "./paths";

/*
 * Jogar no navegador um download de Windows (.exe ou .zip com .exe), no PC
 * de quem joga: Boxedwine (Wine + emulador x86 em WebAssembly, GPL-2.0,
 * https://github.com/danoon2/Boxedwine). Usamos o build oficial "SingleThreaded"
 * da versão 26R1: não precisa de SharedArrayBuffer nem de COOP/COEP.
 *
 * Os arquivos do Boxedwine ficam no bucket jogável, numa pasta com a versão
 * no nome, com cache imutável. O próprio servidor os instala na primeira vez
 * (exe-install.ts); a página que roda o jogo vai para a mesma pasta (exe-server.ts).
 *
 * Funções puras: rodam no navegador e no servidor.
 */

export const BOXEDWINE = {
  version: "26R1",
  /** Pasta no bucket jogável (a política pública cobre b/*). */
  dir: "b/__vg_exe/boxedwine-26R1/",
  /** Arquivos usados (de SingleThreaded/ no zip oficial) e o tamanho exato de cada um. */
  files: [
    { name: "boxedwine-shell.js", size: 39_477 },
    { name: "boxedwine.js", size: 427_664 },
    { name: "boxedwine.wasm", size: 2_295_258 },
    { name: "boxedwine.zip", size: 37_247_698 },
  ],
  releaseZip: "https://github.com/danoon2/Boxedwine/releases/download/26R1.0/Boxedwine26R1Web.zip",
  releaseSha256: "ebc634e921f7c65980a7094f3efad84873cede8011eb7dd204446ff1de982945",
  source: "https://github.com/danoon2/Boxedwine/tree/26R1.0",
  release: "https://github.com/danoon2/Boxedwine/releases/tag/26R1.0",
} as const;

/**
 * Teto do arquivo do jogo. O zip inteiro fica na memória do navegador (e o
 * Wine o monta de lá); jogos antigos e leves cabem com folga.
 */
export const EXE_MAX_BYTES = 512 * 1024 * 1024;

/** O arquivo ganha "Jogar no navegador"? Só Windows, .exe ou .zip, até o teto. */
export function canPlayExe(f: { platform: string; filename: string; size: number }): boolean {
  return f.platform === "windows" && /\.(exe|zip)$/i.test(f.filename) && f.size > 0 && f.size <= EXE_MAX_BYTES;
}

/** Instaladores, desinstaladores e afins: nunca são o jogo. */
const NOT_THE_GAME = /setup|unins|uninstall|crash|redist|vcredist|dxsetup/i;

/**
 * Os .exe de um zip, o mais provável primeiro: os que não parecem
 * instalador antes, depois os mais rasos (a raiz do jogo, já sem a pasta
 * "de fora" do zip) e, entre eles, o maior. Vazio se não há .exe.
 */
export function exeCandidates<T extends { path: string; size: number }>(entries: T[]): T[] {
  const files = entries.filter((e) => !isJunk(e.path));
  const root = commonRoot(files.map((e) => e.path));
  const depth = (p: string) => p.slice(root.length).split("/").length;
  return files
    .filter((e) => /\.exe$/i.test(e.path))
    .sort(
      (a, b) =>
        Number(NOT_THE_GAME.test(baseOf(a.path))) - Number(NOT_THE_GAME.test(baseOf(b.path))) ||
        depth(a.path) - depth(b.path) ||
        b.size - a.size ||
        a.path.localeCompare(b.path),
    );
}

/** Mensagens entre a página do Portal (pai) e a página do Boxedwine (iframe). */
export type ExeToParent =
  | { vg: "exe"; estado: "pronto" }
  | { vg: "exe"; estado: "runtime"; carregado: number; total: number }
  | { vg: "exe"; estado: "iniciando" }
  | { vg: "exe"; estado: "rodando" }
  | { vg: "exe"; estado: "fim" }
  | { vg: "exe"; estado: "erro"; mensagem: string; detalhe?: string };

export interface ExeToFrame {
  vg: "exe";
  /** O arquivo do jogo: um zip (montado inteiro) ou o .exe sozinho. */
  arquivo: Blob;
  zip: boolean;
  /** Caminho do .exe dentro do zip ("Pasta/jogo.exe"), ou o nome do .exe. */
  exe: string;
}

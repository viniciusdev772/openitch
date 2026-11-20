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

type FileInfo = { platform: string; filename: string; size: number };

/**
 * Por que um arquivo de Windows não roda no navegador, ou null se roda.
 * Só vale para Windows (os outros nem ganham botão: ver canTryExe).
 */
export function exeBlockReason(f: FileInfo): string | null {
  if (!/\.(exe|zip)$/i.test(f.filename)) return "Só .exe ou .zip abrem no navegador.";
  if (f.size > EXE_MAX_BYTES) return `Passa do limite de ${EXE_MAX_BYTES / 1024 / 1024} MB do navegador.`;
  return null;
}

/** O arquivo ganha "Jogar no navegador"? Só Windows, .exe ou .zip, até o teto. */
export function canPlayExe(f: FileInfo): boolean {
  return canTryExe(f) && exeBlockReason(f) === null;
}

/** Arquivo de Windows: aparece o botão, ligado ou desligado com "Tentar mesmo assim". */
export function canTryExe(f: FileInfo): boolean {
  return f.platform === "windows" && f.size > 0;
}

/**
 * Arquitetura de um executável pelo cabeçalho PE (os primeiros KB do .exe):
 * Machine 0x14c = x86 (32 bits, roda), 0x8664 = x64 e 0xAA64 = ARM64 (não
 * rodam no Boxedwine). null se não é um PE (ou o cabeçalho não está nos bytes dados).
 */
export function peMachine(head: Uint8Array): "x86" | "x64" | "arm64" | "outro" | null {
  if (head.length < 0x40 || head[0] !== 0x4d || head[1] !== 0x5a) return null;
  const v = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const pe = v.getUint32(0x3c, true);
  if (pe + 6 > head.length || v.getUint32(pe, true) !== 0x00004550) return null;
  const m = v.getUint16(pe + 4, true);
  return m === 0x14c ? "x86" : m === 0x8664 ? "x64" : m === 0xaa64 ? "arm64" : "outro";
}

/** O servidor não respondeu um pedaço (206) ao pedido com Range. */
export class RangeUnsupported extends Error {}

/**
 * Um arquivo remoto que se comporta como Blob para o leitor de zip
 * (size, slice, arrayBuffer, stream): cada leitura vira um GET com Range.
 * Serve para ler só o índice do zip e o cabeçalho do .exe antes de baixar
 * tudo. Se o servidor ignorar o Range (200), lança RangeUnsupported.
 */
export function rangeBlob(url: string, size: number, start = 0, end = size): Blob {
  const get = async () => {
    const res = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` } });
    if (res.status !== 206 || !res.body) {
      await res.body?.cancel().catch(() => {});
      throw new RangeUnsupported(`Range não aceito (${res.status}).`);
    }
    return res;
  };
  const blob = {
    size: end - start,
    type: "",
    slice(a = 0, b = end - start) {
      const s = Math.min(Math.max(a, 0), end - start);
      const e = Math.min(Math.max(b, s), end - start);
      return rangeBlob(url, size, start + s, start + e);
    },
    async arrayBuffer() {
      return end > start ? (await get()).arrayBuffer() : new ArrayBuffer(0);
    },
    stream() {
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      return new ReadableStream<Uint8Array>({
        async pull(ctrl) {
          if (end <= start) return ctrl.close();
          reader ??= (await get()).body!.getReader();
          const { done, value } = await reader.read();
          if (done) ctrl.close();
          else ctrl.enqueue(value);
        },
        cancel() {
          return reader?.cancel();
        },
      });
    },
  };
  return blob as unknown as Blob;
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

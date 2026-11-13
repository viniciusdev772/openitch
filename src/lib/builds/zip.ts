import { MAX_WEB_BUILD_BYTES, MAX_WEB_BUILD_FILES } from "@/lib/storage/limits";
import { cleanBuildPath, isJunk } from "./paths";

/*
 * Leitor de ZIP próprio, sem bibliotecas, para rodar no NAVEGADOR (a Vercel
 * não aguenta descompactar 3 GB). Lê só o necessário com Blob.slice: o fim
 * do arquivo (diretório central) e, depois, cada entrada sob demanda.
 *
 * - ZIP e ZIP64 (arquivos e zips acima de 4 GB, mais de 65.535 entradas).
 * - Métodos 0 (armazenado) e 8 (deflate, via DecompressionStream("deflate-raw")).
 * - Nomes em UTF-8 (bit 11), no campo extra Info-ZIP Unicode Path (0x7075)
 *   ou, sem nenhum dos dois, em CP437 (o padrão antigo do Windows).
 * - Recusa: caminhos com "..", absolutos, com letra de unidade ou caracteres
 *   de controle; links simbólicos; entradas cifradas; nomes repetidos;
 *   métodos desconhecidos; entradas sobrepostas (a "bomba" de Fifield, que
 *   reaproveita os mesmos bytes comprimidos em várias entradas); razão de
 *   compressão absurda; mais arquivos ou mais bytes que os limites.
 * - Ao extrair, conta os bytes de verdade e confere o CRC-32: um zip que
 *   mente sobre o tamanho para de ser lido no primeiro byte a mais.
 */

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

export interface ZipEntry {
  /** Caminho já limpo (ver cleanBuildPath). */
  path: string;
  method: 0 | 8;
  compressedSize: number;
  size: number;
  crc32: number;
  localOffset: number;
  /** Tamanho do nome no diretório central (para conferir sobreposição). */
  nameLength: number;
}

export interface ZipLimits {
  maxFiles: number;
  maxTotalBytes: number;
  /** Razão máxima tamanho/comprimido para entradas acima de 1 MiB. */
  maxRatio: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxFiles: MAX_WEB_BUILD_FILES,
  maxTotalBytes: MAX_WEB_BUILD_BYTES,
  maxRatio: 400,
};

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_CENTRAL_BYTES = 128 * 1024 * 1024;
const MiB = 1024 * 1024;

async function bytesAt(blob: Blob, start: number, end: number): Promise<DataView> {
  const buf = await blob.slice(start, end).arrayBuffer();
  return new DataView(buf);
}

function u64(view: DataView, at: number): number {
  const n = view.getBigUint64(at, true);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new ZipError("O zip declara um tamanho impossível.");
  return Number(n);
}

const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (utf8Flag) return new TextDecoder("utf-8").decode(bytes);
  if (bytes.every((b) => b < 0x80)) return new TextDecoder("ascii").decode(bytes);
  try {
    // Muitos compactadores gravam UTF-8 sem marcar o bit 11.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    let s = "";
    for (const b of bytes) s += b < 0x80 ? String.fromCharCode(b) : CP437_HIGH[b - 0x80];
    return s;
  }
}

const shown = (s: string) => JSON.stringify(s.replace(/[\u0000-\u001f\u007f]/g, "?").slice(0, 120));

/** Lê o diretório central e devolve as entradas de arquivo, já conferidas. */
export async function readZip(blob: Blob, limits: ZipLimits = DEFAULT_ZIP_LIMITS): Promise<{ entries: ZipEntry[]; skipped: number }> {
  if (blob.size < 22) throw new ZipError("Isto não é um arquivo zip.");

  // 1. Fim do diretório central (EOCD): nos últimos 22 bytes + até 64 KiB de comentário.
  const tailLen = Math.min(blob.size, 22 + 0xffff + 20);
  const tailStart = blob.size - tailLen;
  const tail = await bytesAt(blob, tailStart, blob.size);
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD && i + 22 + tail.getUint16(i + 20, true) <= tailLen) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("Isto não é um arquivo zip (ou ele está cortado).");

  if (tail.getUint16(eocd + 4, true) !== 0 || tail.getUint16(eocd + 6, true) !== 0) {
    throw new ZipError("Zips divididos em várias partes não são aceitos. Gere um zip único.");
  }
  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);

  // 2. ZIP64: o EOCD normal tem 0xFFFF/0xFFFFFFFF e aponta para o registro de 64 bits.
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const loc = eocd - 20;
    if (loc < 0 || tail.getUint32(loc, true) !== SIG_ZIP64_LOCATOR) throw new ZipError("Zip64 incompleto.");
    const recOffset = u64(tail, loc + 8);
    if (recOffset + 56 > blob.size) throw new ZipError("Zip64 corrompido.");
    const rec = await bytesAt(blob, recOffset, recOffset + 56);
    if (rec.getUint32(0, true) !== SIG_ZIP64_EOCD) throw new ZipError("Zip64 corrompido.");
    count = u64(rec, 32);
    cdSize = u64(rec, 40);
    cdOffset = u64(rec, 48);
  }

  if (cdOffset + cdSize > blob.size) throw new ZipError("O zip está cortado: o índice aponta para fora do arquivo.");
  if (cdSize > MAX_CENTRAL_BYTES || count > limits.maxFiles * 2 + 1000) {
    throw new ZipError(`O zip tem entradas demais. O limite é ${limits.maxFiles.toLocaleString("pt-BR")} arquivos.`);
  }

  // 3. Diretório central.
  const cd = await bytesAt(blob, cdOffset, cdOffset + cdSize);
  const raw = new Uint8Array(cd.buffer);
  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let total = 0;
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > cdSize || cd.getUint32(p, true) !== SIG_CENTRAL) throw new ZipError("O índice do zip está corrompido.");
    const madeBy = cd.getUint16(p + 4, true);
    const flags = cd.getUint16(p + 8, true);
    const method = cd.getUint16(p + 10, true);
    const crc = cd.getUint32(p + 16, true);
    let csize = cd.getUint32(p + 20, true);
    let usize = cd.getUint32(p + 24, true);
    const nlen = cd.getUint16(p + 28, true);
    const elen = cd.getUint16(p + 30, true);
    const clen = cd.getUint16(p + 32, true);
    const external = cd.getUint32(p + 38, true);
    let offset = cd.getUint32(p + 42, true);
    const nameStart = p + 46;
    const extraStart = nameStart + nlen;
    const next = extraStart + elen + clen;
    if (next > cdSize) throw new ZipError("O índice do zip está corrompido.");

    let name = decodeName(raw.subarray(nameStart, extraStart), (flags & 0x0800) !== 0);

    // Campos extras: ZIP64 (0x0001) e nome Unicode (0x7075).
    let e = extraStart;
    const extraEnd = extraStart + elen;
    while (e + 4 <= extraEnd) {
      const id = cd.getUint16(e, true);
      const len = cd.getUint16(e + 2, true);
      const body = e + 4;
      if (body + len > extraEnd) break;
      if (id === 0x0001) {
        let q = body;
        if (usize === 0xffffffff && q + 8 <= body + len) (usize = u64(cd, q)), (q += 8);
        if (csize === 0xffffffff && q + 8 <= body + len) (csize = u64(cd, q)), (q += 8);
        if (offset === 0xffffffff && q + 8 <= body + len) (offset = u64(cd, q)), (q += 8);
      } else if (id === 0x7075 && len > 5 && !(flags & 0x0800)) {
        name = new TextDecoder("utf-8").decode(raw.subarray(body + 5, body + len));
      }
      e = body + len;
    }
    p = next;

    const os = madeBy >> 8;
    const unixMode = external >>> 16;
    const isDir = name.endsWith("/") || name.endsWith("\\") || (os === 0 && (external & 0x10) !== 0);
    if (isDir) continue;
    if ((os === 3 || os === 19) && (unixMode & 0xf000) === 0xa000) {
      throw new ZipError(`O zip tem um link simbólico (${shown(name)}). Links não são aceitos: inclua o arquivo de verdade.`);
    }
    if (flags & 0x0001 || flags & 0x0040) throw new ZipError(`O zip tem arquivos com senha (${shown(name)}). Gere o zip sem senha.`);
    if (method !== 0 && method !== 8) {
      throw new ZipError(`O zip usa um método de compressão que o navegador não abre (${shown(name)}, método ${method}). Gere o zip com Deflate (o padrão) ou sem compressão.`);
    }
    const clean = cleanBuildPath(name);
    if (!clean) throw new ZipError(`Caminho recusado no zip: ${shown(name)}. Use só caminhos relativos, sem "..", sem barra no começo.`);
    if (isJunk(clean)) {
      skipped++;
      continue;
    }
    if (seen.has(clean)) throw new ZipError(`O zip tem dois arquivos com o mesmo caminho: ${shown(clean)}.`);
    seen.add(clean);
    if (method === 0 && csize !== usize) throw new ZipError(`Tamanhos inconsistentes em ${shown(clean)}.`);
    if (method === 8 && usize > 0 && csize === 0) throw new ZipError(`Entrada inválida em ${shown(clean)}.`);
    if (usize > MiB && csize > 0 && usize / csize > limits.maxRatio) {
      throw new ZipError(`${shown(clean)} se expande ${Math.round(usize / csize)} vezes ao descompactar. Parece uma bomba de compressão e foi recusado.`);
    }
    total += usize;
    if (total > limits.maxTotalBytes) throw new ZipError(`Descompactado, o build passa do limite de ${(limits.maxTotalBytes / 1024 ** 3).toFixed(0)} GB.`);
    entries.push({ path: clean, method: method as 0 | 8, compressedSize: csize, size: usize, crc32: crc, localOffset: offset, nameLength: nlen });
    if (entries.length > limits.maxFiles) throw new ZipError(`O build tem mais de ${limits.maxFiles.toLocaleString("pt-BR")} arquivos, o máximo aceito.`);
  }

  // 4. Entradas sobrepostas (bytes comprimidos reaproveitados): recusa.
  const byOffset = [...entries].sort((a, b) => a.localOffset - b.localOffset);
  for (let k = 0; k < byOffset.length; k++) {
    const a = byOffset[k];
    const end = a.localOffset + 30 + a.nameLength + a.compressedSize;
    const limit = k + 1 < byOffset.length ? byOffset[k + 1].localOffset : cdOffset;
    if (end > limit) throw new ZipError("O zip tem entradas sobrepostas. Isso é típico de bombas de compressão e foi recusado.");
  }

  return { entries, skipped };
}

/* ------------------------------------------------------------------ */
/* Extração                                                            */
/* ------------------------------------------------------------------ */

let CRC_TABLE: Uint32Array | null = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (CRC_TABLE = t);
}

export function crc32Update(crc: number, chunk: Uint8Array): number {
  const t = crcTable();
  let c = ~crc >>> 0;
  for (let i = 0; i < chunk.length; i++) c = t[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

async function dataStart(blob: Blob, entry: ZipEntry): Promise<number> {
  const h = await bytesAt(blob, entry.localOffset, entry.localOffset + 30);
  if (h.byteLength < 30 || h.getUint32(0, true) !== SIG_LOCAL) throw new ZipError(`Cabeçalho corrompido em ${shown(entry.path)}.`);
  const start = entry.localOffset + 30 + h.getUint16(26, true) + h.getUint16(28, true);
  if (start + entry.compressedSize > blob.size) throw new ZipError(`${shown(entry.path)} está cortado no zip.`);
  return start;
}

/**
 * Bytes descompactados de uma entrada, em fluxo. Para no primeiro byte além
 * do tamanho declarado e confere tamanho e CRC-32 no fim.
 */
export async function openEntry(blob: Blob, entry: ZipEntry): Promise<ReadableStream<Uint8Array>> {
  const start = await dataStart(blob, entry);
  let stream = blob.slice(start, start + entry.compressedSize).stream() as ReadableStream<Uint8Array>;
  if (entry.method === 8) stream = stream.pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>);
  let seen = 0;
  let crc = 0;
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        seen += chunk.length;
        if (seen > entry.size) {
          ctrl.error(new ZipError(`${shown(entry.path)} é maior do que o zip declara. Recusado.`));
          return;
        }
        crc = crc32Update(crc, chunk);
        ctrl.enqueue(chunk);
      },
      flush(ctrl) {
        if (seen !== entry.size) ctrl.error(new ZipError(`${shown(entry.path)} está incompleto no zip.`));
        else if (crc !== entry.crc32) ctrl.error(new ZipError(`${shown(entry.path)} está corrompido (CRC não confere).`));
      },
    }),
  );
}

/**
 * A entrada inteira como Blob. Armazenada sem compressão: um recorte do
 * próprio zip, sem copiar bytes. Com deflate: descompacta para a memória
 * (use só para arquivos pequenos; os grandes vão em partes, ver entryParts).
 */
export async function entryBlob(blob: Blob, entry: ZipEntry, type = ""): Promise<Blob> {
  if (entry.method === 0) {
    const start = await dataStart(blob, entry);
    return blob.slice(start, start + entry.size, type);
  }
  const chunks: Uint8Array[] = [];
  const reader = (await openEntry(blob, entry)).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new Blob(chunks as BlobPart[], { type });
}

/** Os primeiros `max` bytes descompactados (para reconhecer o motor). */
export async function entryHead(blob: Blob, entry: ZipEntry, max: number): Promise<Uint8Array> {
  if (entry.method === 0) {
    const start = await dataStart(blob, entry);
    return new Uint8Array(await blob.slice(start, start + Math.min(max, entry.size)).arrayBuffer());
  }
  const start = await dataStart(blob, entry);
  const stream = blob
    .slice(start, start + entry.compressedSize)
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>);
  return readHead(stream, max);
}

/** Lê até `max` bytes de um fluxo e cancela o resto. */
export async function readHead(stream: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const out = new Uint8Array(max);
  let n = 0;
  try {
    while (n < max) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.length, max - n);
      out.set(value.subarray(0, take), n);
      n += take;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return out.subarray(0, n);
}

/**
 * Divide um fluxo em pedaços de exatamente `partSize` bytes (o último pode
 * ser menor), cada um como Blob. Usado para mandar arquivos grandes de um
 * zip em multipart sem segurar o arquivo inteiro na memória.
 */
export async function* chunkStream(stream: ReadableStream<Uint8Array>, partSize: number): AsyncGenerator<Blob> {
  const reader = stream.getReader();
  let parts: Uint8Array[] = [];
  let filled = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = value;
      while (chunk.length) {
        const take = Math.min(chunk.length, partSize - filled);
        parts.push(chunk.subarray(0, take));
        filled += take;
        chunk = chunk.subarray(take);
        if (filled === partSize) {
          yield new Blob(parts as BlobPart[]);
          parts = [];
          filled = 0;
        }
      }
    }
    if (filled > 0) yield new Blob(parts as BlobPart[]);
  } finally {
    reader.cancel().catch(() => {});
  }
}

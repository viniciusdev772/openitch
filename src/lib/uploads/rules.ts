import type { Platform } from "@/data/base";
import { MAX_FILE_BYTES } from "@/lib/storage/limits";

/*
 * Regras dos arquivos para baixar, compartilhadas entre o navegador (para
 * avisar cedo) e o servidor (que é quem decide). Nada aqui é segredo.
 */

const MiB = 1024 * 1024;

/** Plataformas que recebem arquivo para baixar (o navegador tem o jogável, outra frente). */
export const DOWNLOAD_PLATFORMS = ["windows", "macos", "linux", "android"] as const satisfies readonly Platform[];
export type DownloadPlatform = (typeof DOWNLOAD_PLATFORMS)[number];

export const PLATFORM_NAMES: Record<DownloadPlatform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
};

/** Formatos comuns por plataforma (só sugestão na tela; o servidor aceita qualquer arquivo). */
export const PLATFORM_HINTS: Record<DownloadPlatform, string> = {
  windows: ".zip, .7z, .rar, .exe ou .msi",
  macos: ".dmg, .pkg ou .zip com o .app",
  linux: ".AppImage, .tar.gz, .deb, .rpm ou .zip",
  android: ".apk ou .aab",
};

export function isDownloadPlatform(p: unknown): p is DownloadPlatform {
  return typeof p === "string" && (DOWNLOAD_PLATFORMS as readonly string[]).includes(p);
}

/**
 * Tamanho das partes do multipart: 16 MiB.
 *
 * Por que não 64 MiB (o PART_SIZE geral): com 6 partes em paralelo numa
 * conexão doméstica de 20 Mbit/s, cada parte de 64 MiB leva mais de dois
 * minutos; uma queda de rede ou uma página recarregada joga fora até
 * 6 × 64 MiB. Com 16 MiB a perda máxima cai para 96 MiB, o progresso fica
 * mais fino e o SHA-256 de cada parte cabe folgado na memória. 3 GiB dá
 * 192 partes (o S3 aceita até 10.000), assinadas em lotes.
 */
export const UPLOAD_PART_SIZE = 16 * MiB;

/** URLs pedidas por vez ao servidor. */
export const SIGN_BATCH = 12;
/** Máximo de URLs que o servidor assina num pedido. */
export const SIGN_BATCH_MAX = 24;

/** Arquivos por rascunho (prontos + enviando). */
export const MAX_FILES_PER_PROJECT = 30;
/** Envios abertos ao mesmo tempo por conta. */
export const MAX_OPEN_UPLOADS = 8;

export const MAX_FILENAME = 120;

export function partSizeFor(size: number): number {
  return Math.max(UPLOAD_PART_SIZE, Math.ceil(size / 10_000 / MiB) * MiB);
}

export function partCountFor(size: number, partSize = partSizeFor(size)): number {
  return Math.max(1, Math.ceil(size / partSize));
}

/** Até uma parte: um PUT único basta (não há o que paralelizar). */
export function isSinglePut(size: number): boolean {
  return size <= partSizeFor(size);
}

/** Tamanho esperado da parte n (1..count). */
export function expectedPartSize(size: number, partSize: number, n: number): number {
  const count = partCountFor(size, partSize);
  return n < count ? partSize : size - (count - 1) * partSize;
}

export function sizeError(size: unknown): string | null {
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 1) return "Esse arquivo está vazio.";
  if (size > MAX_FILE_BYTES) return "O limite é 3 GB por arquivo. Comprima o build ou divida em partes.";
  return null;
}

/**
 * Nome como o criador vê (e como o arquivo baixado se chama). Recusa
 * caminhos, nomes reservados e caracteres de controle em vez de "consertar".
 */
export function cleanFilename(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "O arquivo precisa de um nome." };
  const name = raw.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: "O arquivo precisa de um nome." };
  if ([...name].length > MAX_FILENAME) return { ok: false, error: `Use um nome de arquivo com até ${MAX_FILENAME} caracteres.` };
  if (/[\\/:*?"<>|]/.test(name)) return { ok: false, error: "O nome do arquivo não pode ter \\ / : * ? \" < > |." };
  if (name === "." || name === ".." || name.startsWith(".")) return { ok: false, error: "O nome do arquivo não pode começar com ponto." };
  return { ok: true, name };
}

/** Parte final da chave no MinIO: só ASCII seguro, preservando a extensão. */
export function keyName(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return ascii || "arquivo";
}

const TYPES: [RegExp, string][] = [
  [/\.zip$/i, "application/zip"],
  [/\.7z$/i, "application/x-7z-compressed"],
  [/\.rar$/i, "application/vnd.rar"],
  [/\.(tar\.gz|tgz)$/i, "application/gzip"],
  [/\.(tar\.xz|txz)$/i, "application/x-xz"],
  [/\.(tar\.bz2|tbz2?)$/i, "application/x-bzip2"],
  [/\.tar$/i, "application/x-tar"],
  [/\.exe$/i, "application/vnd.microsoft.portable-executable"],
  [/\.msi$/i, "application/x-msi"],
  [/\.dmg$/i, "application/x-apple-diskimage"],
  [/\.appimage$/i, "application/vnd.appimage"],
  [/\.deb$/i, "application/vnd.debian.binary-package"],
  [/\.rpm$/i, "application/x-rpm"],
  [/\.apk$/i, "application/vnd.android.package-archive"],
];

/** Tipo pelo nome, nunca pelo que o navegador diz (evita text/html e afins). */
export function contentTypeFor(name: string): string {
  for (const [re, type] of TYPES) if (re.test(name)) return type;
  return "application/octet-stream";
}

/** Reconhece o mesmo arquivo ao retomar: nome, tamanho e data de modificação. */
export function fingerprint(f: { name: string; size: number; lastModified: number }): string {
  return `${f.name}\u0000${f.size}\u0000${f.lastModified}`;
}

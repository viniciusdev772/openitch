/*
 * Limites do armazenamento, compartilhados entre servidor e navegador
 * (sem segredos aqui). Os números de partes seguem o S3: partes de 5 MiB a
 * 5 GiB, no máximo 10.000 por upload.
 */

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/** Maior arquivo único aceito (downloads e zips de build). */
export const MAX_FILE_BYTES = 3 * GiB;

/** Espaço total por conta, somando downloads e builds de navegador. */
export const USER_QUOTA_BYTES = 10 * GiB;

/** Maior build de navegador extraído (soma dos arquivos). */
export const MAX_WEB_BUILD_BYTES = 3 * GiB;

/** Máximo de arquivos dentro de um build de navegador. */
export const MAX_WEB_BUILD_FILES = 20_000;

/** Partes enviadas em paralelo pelo navegador (ajustável conforme a rede). */
export const PART_CONCURRENCY = 6;

/** Validade das URLs pré-assinadas de envio (s). */
export const UPLOAD_URL_TTL = 60 * 60;

/** Validade das URLs de download (s). */
export const DOWNLOAD_URL_TTL = 10 * 60;

export const formatBytes = (n: number) =>
  n >= GiB ? `${(n / GiB).toFixed(2).replace(".", ",")} GB` : n >= MiB ? `${Math.round(n / MiB)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/*
 * Números do envio de builds de navegador, compartilhados entre o navegador
 * e o servidor (sem segredos). Os limites de conta e de build ficam em
 * src/lib/storage/limits.ts.
 */

const MiB = 1024 * 1024;

/** Arquivos do build até este tamanho vão num único PUT pré-assinado. */
export const BUILD_SINGLE_MAX = 32 * MiB;

/**
 * Parte do multipart para arquivos grandes do build (ex.: um .data de 1 GB).
 * 16 MiB: 3 GiB = 192 partes; cada parte fica na memória só enquanto sobe.
 */
export const BUILD_PART_SIZE = 16 * MiB;

/** Arquivos pequenos enviados ao mesmo tempo. */
export const FILE_CONCURRENCY = 8;

/** Partes de um arquivo grande enviadas ao mesmo tempo. */
export const BUILD_PART_CONCURRENCY = 4;

/** Teto de bytes em trânsito (memória do navegador) somando tudo que está subindo. */
export const MAX_BYTES_IN_FLIGHT = 256 * MiB;

/** Caminhos assinados por pedido ao servidor. */
export const SIGN_BATCH = 200;

/** Validade das URLs de envio de arquivos pequenos (s): assinadas pouco antes de usar. */
export const SINGLE_URL_TTL = 30 * 60;

/** Validade das URLs de partes (s). */
export const PART_URL_TTL = 60 * 60;

/** Máximo de builds guardados por rascunho. */
export const MAX_BUILDS_PER_PROJECT = 5;

/** Builds ao mesmo tempo em "enviando" por conta. */
export const MAX_OPEN_BUILDS = 3;

/** Um envio parado há mais que isso é considerado abandonado e apagado. */
export const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

/** Identificador público de build: 128 bits aleatórios em hexadecimal. */
export const PUBLIC_ID_RE = /^[a-f0-9]{32}$/;

/** A partir deste tamanho a página do jogo pede um clique antes de baixar. */
export const HEAVY_BUILD_BYTES = 50 * MiB;

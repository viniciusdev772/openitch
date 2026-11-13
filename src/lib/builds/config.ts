/*
 * Números do envio de builds de navegador, compartilhados entre o navegador
 * e o servidor (sem segredos). Os limites de conta e de build ficam em
 * src/lib/storage/limits.ts.
 */

const MiB = 1024 * 1024;

/*
 * Requisições pequenas de propósito: o proxy na frente do MinIO (Traefik do
 * Easypanel) corta qualquer requisição com mais de 60 s. Numa conexão lenta,
 * um PUT grande nunca terminava e o envio voltava a zero. Com 5 MiB, cada
 * requisição cabe em 60 s até ~0,7 Mbit/s, e o teto de bytes em trânsito
 * acompanha a velocidade medida (REQUEST_BUDGET_S).
 */

/** Arquivos do build até este tamanho vão num único PUT pré-assinado. */
export const BUILD_SINGLE_MAX = 5 * MiB;

/**
 * Parte do multipart para arquivos grandes do build (ex.: um .data de 1 GB).
 * 5 MiB (o mínimo do S3): 3 GiB = 615 partes; cada parte fica na memória só enquanto sobe.
 */
export const BUILD_PART_SIZE = 5 * MiB;

/** Tempo-alvo de cada requisição de envio (s), bem abaixo do corte de 60 s do proxy. */
export const REQUEST_BUDGET_S = 20;

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

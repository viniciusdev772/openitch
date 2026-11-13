import "server-only";
import { MongoClient, type Db, type ObjectId } from "mongodb";
import type { Platform, TrackId } from "@/data/catalog";

/**
 * Conexão com o MongoDB. A URI vem só do ambiente (MONGODB_URI), cadastrada
 * na Vercel como variável sensível; nunca fica no código.
 */
const DB_NAME = "openitch";

function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI não definida. Configure a variável de ambiente (veja .env.example).");
  return uri;
}

/* ------------------------------------------------------------------ */
/* Formato dos documentos (só tipos do TypeScript; o banco não tem     */
/* schema nem validação).                                              */
/* ------------------------------------------------------------------ */

export interface RecoveryCode {
  hash: string;
  usedAt: Date | null;
}

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  recoveryCodes: RecoveryCode[];
  totp: {
    enabled: boolean;
    /** Segredo cifrado com AES-256-GCM (ver crypto.ts). */
    secret: string | null;
    lastStep: number;
    enabledAt: Date | null;
  };
  /** Segredo gerado na configuração, ainda não confirmado. */
  totpPending: { secret: string; expiresAt: Date } | null;
}

export interface SessionDoc {
  /** SHA-256 do token que vai no cookie. O token em si nunca é gravado. */
  _id: string;
  /** Identificador público (para listar e encerrar sem expor o hash). */
  publicId: string;
  userId: ObjectId;
  createdAt: Date;
  lastSeenAt: Date;
  /** Fim absoluto da sessão. Índice TTL apaga depois disso. */
  expiresAt: Date;
  persistent: boolean;
  ip: string;
  userAgent: string;
  place: string | null;
  mfa: boolean;
}

export interface MfaChallengeDoc {
  _id: string;
  userId: ObjectId;
  persistent: boolean;
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  resetAt: Date;
}

/** Jogo guardado na estante. `game` é o slug, conferido contra o catálogo. */
export interface SaveDoc {
  _id?: ObjectId;
  userId: ObjectId;
  game: string;
  at: Date;
}

/** Criador seguido. `creator` é o slug, conferido contra o catálogo. */
export interface FollowDoc {
  _id?: ObjectId;
  userId: ObjectId;
  creator: string;
  at: Date;
}

/**
 * Rascunho de um jogo, criado em /publicar. Só o dono lê e grava; toda
 * consulta filtra por `userId` da sessão. Valores de trilha, plataforma, jam e
 * capa são conferidos contra o catálogo antes de chegar aqui (lib/projects).
 */
export type ProjectPrice =
  | { kind: "free" }
  | { kind: "fixed"; cents: number }
  | { kind: "pwyw"; minimumCents: number };

export interface ProjectDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  /** Endereço sugerido a partir do título; não é reservado nem único. */
  slug: string;
  tagline: string;
  description: string;
  track: TrackId;
  tags: string[];
  platforms: Platform[];
  price: ProjectPrice;
  /** Capa provisória (um dos estilos de capa do catálogo). */
  cover: string;
  /** Slug da jam no catálogo, ou null. */
  jam: string | null;
  status: "rascunho";
  createdAt: Date;
  updatedAt: Date;
}

/* ------------------------------------------------------------------ */
/* Arquivos no MinIO (ver src/lib/storage)                             */
/* ------------------------------------------------------------------ */

/**
 * Um arquivo enviado para baixar (build de Windows, macOS, Linux, Android) ou
 * o zip original de um build de navegador. Os bytes vão do navegador direto
 * para o MinIO (multipart com URLs pré-assinadas); aqui fica só o registro.
 */
export interface UploadDoc {
  _id: ObjectId;
  userId: ObjectId;
  projectId: ObjectId;
  /** download: arquivo para baixar; web-source: zip de um build de navegador. */
  kind: "download" | "web-source";
  platform: Platform;
  filename: string;
  size: number;
  contentType: string;
  bucket: string;
  key: string;
  /** UploadId do multipart enquanto o envio está aberto. */
  multipartId: string | null;
  partSize: number;
  status: "enviando" | "pronto" | "cancelado";
  /** Soma de verificação informada pelo navegador ao terminar (opcional). */
  sha256: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export type WebEngine = "unity" | "godot" | "unreal-html5" | "construct" | "gamemaker" | "defold" | "pico8" | "bevy" | "ruffle" | "html5";

/** Um arquivo declarado de um build de navegador (caminho relativo e tamanho exato). */
export interface BuildFileDoc {
  p: string;
  s: number;
  /** Content-Encoding detectado num .unityweb (o nome não diz qual é). */
  e?: "br" | "gzip";
}

/**
 * Um build de navegador extraído no bucket jogável, sob `prefix`
 * (ex.: "b/<buildId>/"), servido direto do MinIO num iframe isolado.
 */
export interface BuildDoc {
  _id: ObjectId;
  userId: ObjectId;
  projectId: ObjectId;
  /** Upload do zip original, se o zip também foi guardado. */
  sourceUploadId: ObjectId | null;
  bucket: string;
  prefix: string;
  /** Caminho do HTML de entrada relativo ao prefixo (ex.: "index.html"). */
  entry: string;
  engine: WebEngine;
  /** Precisa de isolamento entre origens (SharedArrayBuffer: Godot com threads, Unity com threads). */
  needsIsolation: boolean;
  fileCount: number;
  totalSize: number;
  status: "enviando" | "pronto" | "falhou";
  /** Tamanho da tela sugerido (px), se o build informa. */
  width: number | null;
  height: number | null;
  createdAt: Date;
  updatedAt: Date;
  /* Campos da frente "jogável" (src/lib/builds). */
  /** Identificador público aleatório de 128 bits (hex): a pasta é b/<publicId>/ e a página /jogar/<publicId>. */
  publicId?: string;
  /** Lista declarada antes do envio; o servidor só assina estes caminhos, com estes tamanhos. */
  files?: BuildFileDoc[];
  /** Envios multipart abertos (arquivos grandes), por caminho. */
  multipart?: { p: string; id: string }[];
  /** Versão aproximada do motor (ex.: "4.3+"). */
  engineVersion?: string | null;
  completedAt?: Date | null;
}

export type SecurityEventType =
  | "conta_criada"
  | "entrada"
  | "entrada_2fa"
  | "senha_errada"
  | "2fa_errado"
  | "saida"
  | "senha_alterada"
  | "senha_redefinida"
  | "2fa_ativado"
  | "2fa_desativado"
  | "codigos_gerados"
  | "codigo_recuperacao_usado"
  | "sessao_encerrada"
  | "outras_sessoes_encerradas"
  | "nome_alterado";

export interface SecurityEventDoc {
  _id?: ObjectId;
  userId: ObjectId;
  type: SecurityEventType;
  at: Date;
  ip: string;
  userAgent: string;
  place: string | null;
}

/* ------------------------------------------------------------------ */
/* Cliente compartilhado entre invocações da mesma instância.          */
/* ------------------------------------------------------------------ */

type Cache = { client?: Promise<MongoClient>; indexes?: Promise<void> };
const g = globalThis as typeof globalThis & { __openitchMongo?: Cache };
const cache: Cache = (g.__openitchMongo ??= {});

function connect(): Promise<MongoClient> {
  if (!cache.client) {
    const client = new MongoClient(mongoUri(), {
      appName: "vibegames",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    cache.client = client.connect().catch((err) => {
      cache.client = undefined;
      throw err;
    });
  }
  return cache.client;
}

async function ensureIndexes(db: Db): Promise<void> {
  if (!cache.indexes) {
    cache.indexes = (async () => {
      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("sessions").createIndex({ userId: 1 }),
        db.collection("sessions").createIndex({ publicId: 1 }, { unique: true }),
        db.collection("mfa_challenges").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("rate_limits").createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("security_events").createIndex({ userId: 1, at: -1 }),
        db.collection("security_events").createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 }),
        db.collection("saves").createIndex({ userId: 1, game: 1 }, { unique: true }),
        db.collection("follows").createIndex({ userId: 1, creator: 1 }, { unique: true }),
        db.collection("projects").createIndex({ userId: 1, updatedAt: -1 }),
        db.collection("uploads").createIndex({ projectId: 1, createdAt: -1 }),
        db.collection("uploads").createIndex({ userId: 1, status: 1 }),
        db.collection("builds").createIndex({ projectId: 1, createdAt: -1 }),
        db.collection("builds").createIndex({ userId: 1, status: 1 }),
      ]);
    })().catch((err) => {
      cache.indexes = undefined;
      throw err;
    });
  }
  return cache.indexes;
}

export async function db() {
  const client = await connect();
  const database = client.db(DB_NAME);
  await ensureIndexes(database);
  return {
    users: database.collection<UserDoc>("users"),
    sessions: database.collection<SessionDoc>("sessions"),
    mfa: database.collection<MfaChallengeDoc>("mfa_challenges"),
    rateLimits: database.collection<RateLimitDoc>("rate_limits"),
    events: database.collection<SecurityEventDoc>("security_events"),
    saves: database.collection<SaveDoc>("saves"),
    follows: database.collection<FollowDoc>("follows"),
    projects: database.collection<ProjectDoc>("projects"),
    uploads: database.collection<UploadDoc>("uploads"),
    builds: database.collection<BuildDoc>("builds"),
  };
}

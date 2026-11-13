import "server-only";
import { MongoClient, type Db, type ObjectId } from "mongodb";

/**
 * Conexão com o MongoDB.
 *
 * A URI fica fixa no código por decisão do dono do projeto. MONGODB_URI, se
 * existir no ambiente, tem prioridade (útil para testes locais).
 */
const MONGODB_URI_FIXA = "mongodb://mongo:vpsqj4du1pc39b2ox9il@194.238.25.13:90/?tls=false";
const MONGODB_URI = process.env.MONGODB_URI || MONGODB_URI_FIXA;
const DB_NAME = "openitch";

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
    const client = new MongoClient(MONGODB_URI, {
      appName: "openitch",
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
  };
}

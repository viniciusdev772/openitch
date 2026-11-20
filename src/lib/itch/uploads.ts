import type { DownloadPlatform } from "@/lib/uploads/rules";

/* Leitura dos uploads da API do itch.io (sem rede: testável fora do Next). */

type Json = Record<string, unknown>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const strv = (v: unknown) => (typeof v === "string" ? v : "");
const pick = (o: Json, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

export type ItchKind = "download" | "web" | "outro";

export interface ItchUpload {
  id: number;
  filename: string;
  displayName: string;
  size: number;
  kind: ItchKind;
  /** Plataformas de download que o upload declara (na ordem windows, macos, linux, android). */
  platforms: DownloadPlatform[];
  storage: string;
  buildId: number | null;
  updatedAt: number | null;
}

/** Plataformas do upload, em qualquer das formas que a API usa. */
export function uploadPlatforms(raw: Json): DownloadPlatform[] {
  const pl = (raw.platforms && typeof raw.platforms === "object" ? raw.platforms : {}) as Json;
  const traits = Array.isArray(raw.traits) ? (raw.traits as unknown[]).map(String) : [];
  const has = (name: string, alt: string) => Boolean(pl[name] || raw[`p_${alt}`] || traits.includes(`p_${alt}`));
  const out: DownloadPlatform[] = [];
  if (has("windows", "windows")) out.push("windows");
  if (has("osx", "osx")) out.push("macos");
  if (has("linux", "linux")) out.push("linux");
  if (raw.p_android || traits.includes("p_android") || /\.apk$/i.test(strv(raw.filename))) out.push("android");
  return out;
}

export function normalizeUpload(raw: Json): ItchUpload | null {
  const id = num(raw?.id);
  const size = num(raw?.size);
  if (id === null) return null;
  const type = strv(raw.type) || "default";
  const platforms = uploadPlatforms(raw);
  const kind: ItchKind = type === "html" ? "web" : type === "default" && platforms.length ? "download" : "outro";
  const updated = Date.parse(strv(pick(raw, "updated_at", "updatedAt")) || strv(pick(raw, "created_at", "createdAt")));
  return {
    id,
    filename: strv(raw.filename) || `arquivo-${id}`,
    displayName: strv(pick(raw, "display_name", "displayName")),
    size: size ?? 0,
    kind,
    platforms,
    storage: strv(raw.storage) || "hosted",
    buildId: num(pick(raw, "build_id", "buildId")),
    updatedAt: Number.isFinite(updated) ? updated : null,
  };
}


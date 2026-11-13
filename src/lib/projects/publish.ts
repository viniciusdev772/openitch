import "server-only";
import { MongoServerError, type ObjectId } from "mongodb";
import { PLATFORMS, type Platform } from "@/data/base";
import { db, type ProjectDoc } from "@/lib/auth/db";
import { slugify } from "@/lib/slug";
import { publishFieldProblems, suggestSlug, type PublishProblem } from "./limits";

/*
 * Regras da publicação. Um jogo entra no programa quando a página está
 * completa (publishFieldProblems) e cada plataforma marcada tem o seu arquivo
 * pronto no armazenamento: um build de navegador para "web", um arquivo para
 * baixar para cada sistema. Tudo é conferido aqui, no servidor, a cada pedido.
 */

const isDuplicate = (err: unknown) => err instanceof MongoServerError && err.code === 11000;

/** O que impede este projeto de entrar no programa agora (vazio: pode publicar). */
export async function publishProblems(p: ProjectDoc): Promise<PublishProblem[]> {
  const fields = publishFieldProblems({
    title: p.title,
    tagline: p.tagline,
    description: p.description,
    platforms: p.platforms,
    priceKind: p.price.kind,
  });
  const out: PublishProblem[] = Object.entries(fields).map(([field, text]) => ({ field: field as PublishProblem["field"], text }));

  const { uploads, builds } = await db();
  const [ready, build] = await Promise.all([
    uploads.distinct("platform", { projectId: p._id, userId: p.userId, kind: "download", status: "pronto" }) as Promise<Platform[]>,
    builds.findOne({ projectId: p._id, userId: p.userId, status: "pronto" }, { projection: { _id: 1 } }),
  ]);
  for (const x of p.platforms) {
    if (x === "web" && !build) out.push({ field: "platforms", file: true, text: "Envie o build de navegador e espere ele terminar de subir." });
    if (x !== "web" && !ready.includes(x)) {
      out.push({ field: "platforms", file: true, text: `Envie o arquivo de ${PLATFORMS[x].name}, ou desmarque essa plataforma.` });
    }
  }
  return out;
}

/** Tenta `base`, depois `base-2`, `base-3`…: o primeiro que o índice único aceitar fica. */
async function claim(base: string, max: number, tryOne: (slug: string) => Promise<boolean>): Promise<string> {
  const root = base.slice(0, max - 4).replace(/-+$/g, "") || "jogo";
  for (let n = 1; n <= 60; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    try {
      if (await tryOne(slug)) return slug;
    } catch (err) {
      if (!isDuplicate(err)) throw err;
    }
  }
  // Nome muito comum: um sufixo aleatório curto resolve.
  const slug = `${root}-${Math.random().toString(36).slice(2, 7)}`;
  if (await tryOne(slug)) return slug;
  throw new Error("Não foi possível reservar um endereço.");
}

/** Endereço público do jogo: reservado uma vez e mantido, mesmo se o título mudar. */
export async function ensurePublicSlug(p: ProjectDoc): Promise<string> {
  if (p.publicSlug) return p.publicSlug;
  const { projects } = await db();
  // matchedCount 0: outro pedido já reservou um endereço para este projeto; vale o gravado.
  await claim(suggestSlug(p.title) || "jogo", 52, async (slug) => {
    await projects.updateOne({ _id: p._id, userId: p.userId, publicSlug: { $exists: false } }, { $set: { publicSlug: slug } });
    return true;
  });
  const saved = await projects.findOne({ _id: p._id }, { projection: { publicSlug: 1 } });
  if (!saved?.publicSlug) throw new Error("Projeto sumiu durante a publicação.");
  return saved.publicSlug;
}

/** Endereço de criador da conta (/criador/<slug>), reservado na primeira publicação. */
export async function ensureCreatorSlug(userId: ObjectId): Promise<string> {
  const { users } = await db();
  const user = await users.findOne({ _id: userId }, { projection: { name: 1, creatorSlug: 1 } });
  if (!user) throw new Error("Conta não encontrada.");
  if (user.creatorSlug) return user.creatorSlug;
  await claim(slugify(user.name, 40) || "criador", 44, async (slug) => {
    await users.updateOne({ _id: userId, creatorSlug: { $exists: false } }, { $set: { creatorSlug: slug, firstPublishedAt: new Date() } });
    return true;
  });
  const saved = await users.findOne({ _id: userId }, { projection: { creatorSlug: 1 } });
  if (!saved?.creatorSlug) throw new Error("Conta não encontrada.");
  return saved.creatorSlug;
}

/** Número da entrada (Nº 0001…), dado uma vez por projeto, na ordem em que chegam. */
export async function ensureNumber(p: ProjectDoc): Promise<number> {
  if (p.number) return p.number;
  const { counters, projects } = await db();
  const counter = await counters.findOneAndUpdate(
    { _id: "entradas" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  const seq = Number(counter?.seq);
  if (!Number.isInteger(seq) || seq < 1) throw new Error("Contador de entradas inválido.");
  const r = await projects.updateOne({ _id: p._id, number: { $exists: false } }, { $set: { number: seq } });
  if (r.matchedCount === 1) return seq;
  const now = await projects.findOne({ _id: p._id }, { projection: { number: 1 } });
  if (!now?.number) throw new Error("Projeto sumiu durante a publicação.");
  return now.number;
}

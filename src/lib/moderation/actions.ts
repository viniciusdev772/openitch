"use server";

import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getSession, readSuspended } from "@/lib/auth/session";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { str } from "@/lib/auth/validate";
import { requestInfo } from "@/lib/auth/request";
import { stripInvisible } from "@/lib/projects/limits";
import { toObjectId } from "@/lib/auth/session";
import { appealBan, appealRemoval, fileReport, processPending } from "./server";

export type ReportState = { ok?: string; error?: string } | undefined;
export type AppealState = { ok?: string; upheld?: boolean; error?: string; reasoning?: string | null } | undefined;

const MIN = 60 * 1000;
const SERVER_DOWN = "Não conseguimos falar com o servidor agora. Tente de novo em instantes.";

/** Denunciar um jogo ou um perfil. Com ou sem conta; limite por rede e, com conta, por conta. */
export async function reportContent(_prev: ReportState, form: FormData): Promise<ReportState> {
  const kind = str(form, "tipo", 10);
  const slug = str(form, "alvo", 80);
  const rule = str(form, "regra", 30);
  const details = stripInvisible(str(form, "detalhes", 1200)).trim();
  if (!rule) return { error: "Escolha a regra que foi quebrada." };
  if (details.length < 10) return { error: "Conte em poucas palavras o que está errado (pelo menos 10 letras)." };
  if (details.length > 1000) return { error: "Use no máximo 1.000 caracteres." };
  try {
    const [session, info] = await Promise.all([getSession(), requestInfo()]);
    const userId = session?.user._id ?? null;
    // Sem conta, o limite é mais curto: cada denúncia nova custa uma análise.
    const limits = [hit(`denuncia:ip:${info.ip}`, userId ? 20 : 5, 60 * MIN)];
    if (userId) limits.push(hit(`denuncia:${userId.toHexString()}`, 10, 60 * MIN));
    const blocked = (await Promise.all(limits)).find((l) => !l.allowed);
    if (blocked) return { error: `Muitas denúncias seguidas. Espere ${waitText(blocked.retryAfterMs)}.` };
    const res = await fileReport({ userId, ip: info.ip }, kind, slug, rule, details);
    if (!res.ok) return { error: res.error };
    after(() => processPending().catch((err) => console.error("[moderacao]", err)));
    return {
      ok: res.repeated
        ? "Você já denunciou isto há pouco. A análise já foi pedida."
        : "Denúncia recebida. A análise automática leva alguns minutos; se a regra foi quebrada, o conteúdo sai do ar.",
    };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[denuncia]", err);
    return { error: SERVER_DOWN };
  }
}

/** Recurso de uma conta banida, a partir da página /conta-suspensa. */
export async function submitAppeal(_prev: AppealState, form: FormData): Promise<AppealState> {
  const text = stripInvisible(str(form, "recurso", 2200)).trim();
  if (text.length < 20) return { error: "Explique por que a decisão está errada (pelo menos 20 letras)." };
  if (text.length > 2000) return { error: "Use no máximo 2.000 caracteres." };
  try {
    const userId = await readSuspended();
    if (!userId) return { error: "O acesso a esta página expirou. Entre de novo com sua conta para ver o aviso." };
    const limit = await hit(`recurso:${userId.toHexString()}`, 5, 60 * MIN);
    if (!limit.allowed) return { error: `Muitas tentativas. Espere ${waitText(limit.retryAfterMs)}.` };
    const res = await appealBan(userId, text);
    if (!res.ok) return { error: res.error };
    return res.upheld
      ? { upheld: true, ok: "Recurso analisado pelo plenário: a decisão foi mantida.", reasoning: res.reasoning }
      : { upheld: false, ok: "Recurso aceito pelo plenário: sua conta foi reaberta e os jogos que estavam no ar voltaram. Entre de novo.", reasoning: res.reasoning };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[recurso]", err);
    return { error: SERVER_DOWN };
  }
}

/** Recurso contra a remoção de um jogo, a partir de /conta/projetos. */
export async function submitRemovalAppeal(_prev: AppealState, form: FormData): Promise<AppealState> {
  const text = stripInvisible(str(form, "recurso", 2200)).trim();
  const id = toObjectId(str(form, "id", 40));
  if (!id) return { error: "Pedido inválido." };
  if (text.length < 20) return { error: "Explique por que a decisão está errada (pelo menos 20 letras)." };
  if (text.length > 2000) return { error: "Use no máximo 2.000 caracteres." };
  try {
    const session = await getSession();
    if (!session) return { error: "Sua sessão terminou. Entre de novo para recorrer." };
    const userId = session.user._id;
    const limit = await hit(`recurso:${userId.toHexString()}`, 5, 60 * MIN);
    if (!limit.allowed) return { error: `Muitas tentativas. Espere ${waitText(limit.retryAfterMs)}.` };
    const res = await appealRemoval(userId, id, text);
    if (!res.ok) return { error: res.error };
    // Sem revalidar a lista aqui: a linha some de "tirado do ar" e leva junto a resposta do recurso. A lista se atualiza na próxima visita.
    return res.upheld
      ? {
          upheld: true,
          ok: "Recurso analisado pelo plenário: a remoção foi mantida. Para voltar, mude o que quebra a regra e publique de novo.",
          reasoning: res.reasoning,
        }
      : {
          upheld: false,
          ok: "Recurso aceito pelo plenário: a remoção foi desfeita e não conta mais contra a sua conta. Se o jogo já tinha endereço, ele voltou ao programa.",
          reasoning: res.reasoning,
        };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[recurso]", err);
    return { error: SERVER_DOWN };
  }
}

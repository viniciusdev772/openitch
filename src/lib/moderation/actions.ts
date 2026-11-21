"use server";

import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getSession, readSuspended } from "@/lib/auth/session";
import { hit, waitText } from "@/lib/auth/ratelimit";
import { str } from "@/lib/auth/validate";
import { stripInvisible } from "@/lib/projects/limits";
import { appealBan, fileReport, processPending } from "./server";

export type ReportState = { ok?: string; error?: string; login?: boolean } | undefined;
export type AppealState = { ok?: string; upheld?: boolean; error?: string } | undefined;

const MIN = 60 * 1000;
const SERVER_DOWN = "Não conseguimos falar com o servidor agora. Tente de novo em instantes.";

/** Denunciar um jogo ou um perfil. Só com conta, e com limite por conta. */
export async function reportContent(_prev: ReportState, form: FormData): Promise<ReportState> {
  const kind = str(form, "tipo", 10);
  const slug = str(form, "alvo", 80);
  const rule = str(form, "regra", 30);
  const details = stripInvisible(str(form, "detalhes", 1200)).trim();
  if (!rule) return { error: "Escolha a regra que foi quebrada." };
  if (details.length < 10) return { error: "Conte em poucas palavras o que está errado (pelo menos 10 letras)." };
  if (details.length > 1000) return { error: "Use no máximo 1.000 caracteres." };
  try {
    const session = await getSession();
    if (!session) return { login: true, error: "Entre na sua conta para denunciar." };
    const userId = session.user._id;
    const limit = await hit(`denuncia:${userId.toHexString()}`, 10, 60 * MIN);
    if (!limit.allowed) return { error: `Muitas denúncias seguidas. Espere ${waitText(limit.retryAfterMs)}.` };
    const res = await fileReport(userId, kind, slug, rule, details);
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
      ? { upheld: true, ok: "Recurso analisado: a decisão foi mantida." }
      : { upheld: false, ok: "Recurso aceito: sua conta foi reaberta e os jogos que estavam no ar voltaram. Entre de novo." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[recurso]", err);
    return { error: SERVER_DOWN };
  }
}

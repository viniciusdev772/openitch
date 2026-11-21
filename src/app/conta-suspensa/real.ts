import "server-only";
import { db } from "@/lib/auth/db";
import { readSuspended } from "@/lib/auth/session";
import { readCaseAnswer } from "@/lib/moderation/decide";
import { ruleById } from "@/lib/moderation/rules";
import type { Case } from "./casos";

/*
 * O caso real de quem está na página: a decisão que fechou a conta, montada
 * no servidor a partir do cookie de conta suspensa (nunca do que o navegador
 * manda). Vira um caso do jogo com os documentos de verdade na mesa e
 * perguntas sobre a regra citada; não há respostas prontas, para o jogo não
 * pôr na boca da pessoa fatos ou provas que ela não tem.
 */

export const REAL_ID = "real";

const field = (snapshot: string[], name: string) =>
  snapshot.find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1).trim() ?? "";

export async function realCase(): Promise<Case | null> {
  const userId = await readSuspended();
  if (!userId) return null;
  const { users, moderation } = await db();
  const user = await users.findOne({ _id: userId }, { projection: { ban: 1 } });
  const ban = user?.ban;
  if (!ban || ban.revokedAt) return null;
  const d = await moderation.findOne(
    { _id: ban.decisionId },
    { projection: { snapshot: 1, reasoning: 1, rule: 1, votes: 1, stage: 1 } },
  );
  const rule = ruleById(ban.rule);
  const ruleTitle = rule?.title ?? ban.rule;
  const snapshot = d?.snapshot ?? [];
  const game = field(snapshot, "Title") || field(snapshot, "Name") || "A sua conta";
  const judged = snapshot
    .filter((l) => !l.startsWith("Provenance check") && !l.startsWith("Images follow"))
    .join(" · ")
    .slice(0, 900);
  const answers = (d?.votes ?? []).flatMap((v) => {
    const a = readCaseAnswer(v.model, v.answers);
    return a ? [a] : [];
  });
  const saw = answers.filter((a) => a.violation >= 0.5).length;

  return {
    id: REAL_ID,
    game,
    rule: ruleTitle,
    accusation: d?.reasoning || `O tribunal concluiu que conteúdo desta conta quebrou a regra “${ruleTitle}”.`,
    yourSide:
      "Este é o seu caso de verdade. Treine aqui a sua defesa: o resultado do jogo não muda nada na decisão. O recurso que vale é o formulário logo abaixo do jogo.",
    evidence: [
      { id: "decisao", kind: "documento", title: "Fundamentação da decisão", text: d?.reasoning || "O relator não deixou fundamentação escrita.", weight: 0, verifiable: true },
      { id: "regra", kind: "documento", title: `Regra: ${ruleTitle}`, text: rule?.text ?? ruleTitle, weight: 0, verifiable: true },
      { id: "conteudo", kind: "print", title: "O conteúdo que foi julgado", text: judged || "O conteúdo julgado não ficou guardado.", weight: 0, verifiable: true },
      {
        id: "placar",
        kind: "nota",
        title: "Placar do tribunal",
        text: answers.length
          ? `${d?.stage === "plenario" ? "Plenário" : "Turma"}: ${saw} de ${answers.length} juízes viram violação da regra.`
          : "O placar desta decisão não ficou guardado.",
        weight: 0,
        verifiable: true,
      },
    ],
    questions: [
      {
        judge: 4,
        text: `A decisão diz que conteúdo desta conta quebrou a regra “${ruleTitle}”. O que, exatamente, o tribunal entendeu errado?`,
        wants: [],
        answers: [],
      },
      {
        judge: 2,
        text: "Que fato concreto mostra isso? Uma data, um número, um nome de arquivo, um link que dê para conferir.",
        wants: [],
        answers: [],
      },
      {
        judge: 1,
        text: "Se a decisão for mantida, o que você muda no que publica daqui para a frente?",
        wants: [],
        answers: [],
      },
    ],
  };
}

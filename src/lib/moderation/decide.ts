import { RULES, ruleById, type RuleId } from "./rules";

/*
 * Quem decide são modelos de decisão do OpenRouter (/api/alpha/decisions):
 * em vez de texto, devolvem probabilidades para perguntas tipadas. Três
 * modelos de fabricantes diferentes julgam o mesmo caso e a decisão sai da
 * maioria, então um modelo sozinho não fecha conta de ninguém.
 *
 * Três dos mais baratos (todos cobram só a entrada, US$ 0,02 a 0,042 por
 * milhão de tokens; um caso sai por menos de US$ 0,0002), de fabricantes
 * diferentes, todos com texto e imagem. Índice de decisão da Artificial
 * Analysis v2.1 (nov/2026): Liquid d1.2-ultra 74,8 (primeiro lugar, menor
 * erro de calibração relatado), Perplexity Decider v1.2 69,8, TypeSafe Jev
 * 1.14 66,2 (estudos independentes o acham sensível à redação e
 * subconfiante; aqui ele é um voto entre três). Medidos neste site: os três
 * arquivam uma página limpa, condenam um golpe de "gerador de Robux" e
 * mantêm ou revertem um recurso como esperado. Baseten Mammoth 1 (71,4) saiu
 * por custar 2,4 vezes mais.
 */
export const MODELS = ["liquid/d1.2-ultra", "perplexity/pplx-decider-v1.2", "typesafe/jev-1.14"] as const;

/** Mínimo de modelos que precisam responder para valer uma decisão. */
export const QUORUM = 2;

export type Outcome = "arquivada" | "removido" | "banido";

/** Remoções nos últimos 180 dias que, somadas a uma nova, fecham a conta. */
export const STRIKES_TO_BAN = 3;
export const STRIKE_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

const SEVERITY = [
  "No problem, or too minor to act on",
  "Minor: borderline or easy to fix, a warning is enough",
  "Serious: the content must be taken down",
  "Severe: clear, deliberate and harmful; the account must be closed",
];

/** Perguntas do julgamento de uma denúncia ou de uma publicação. */
export function caseQuestions() {
  return {
    viola: {
      type: "noul",
      instructions:
        "You are the moderator of Portal dos Games, an open storefront for independent games. The state holds a game page or a creator profile, and possibly a report someone filed about it. Reports can be wrong or made in bad faith: judge the content itself. Does the content break any community rule?",
      criteria: {
        true: "The content clearly breaks at least one of the community rules.",
        false: "The content breaks no rule, or the report is unfounded, or the evidence is too weak.",
      },
    },
    regra: {
      type: "choice",
      instructions: "Which community rule does the content break most clearly?",
      criteria: {
        nenhuma: "No rule is broken.",
        ...Object.fromEntries(RULES.map((r) => [r.id, r.criteria])),
      },
    },
    gravidade: {
      type: "score",
      instructions: "How serious is the violation?",
      criteria: SEVERITY,
    },
  };
}

/** Pergunta do recurso: manter ou desfazer um banimento ("conta") ou a remoção de um jogo ("jogo"). */
export function appealQuestions(target: "conta" | "jogo" = "conta") {
  const what = target === "conta" ? "An account on Portal dos Games was closed" : "A game on Portal dos Games was taken down";
  const stay = target === "conta" ? "Should the account stay closed?" : "Should the game stay taken down?";
  const enough = target === "conta" ? "serious enough to close an account" : "serious enough to take the game down";
  return {
    manter: {
      type: "noul",
      instructions: `${what} by an automated decision. The state holds the content that was judged, the rule that was cited, and the owner's appeal. Re-examine the case from scratch. ${stay}`,
      criteria: {
        true: "The content clearly and seriously breaks the cited rule, and the appeal does not show a mistake.",
        false: `The content does not clearly break the rule, the violation is not ${enough}, or the appeal shows the decision was a mistake.`,
      },
    },
  };
}

export interface CaseAnswer {
  model: string;
  /** Probabilidade de haver violação (0..1). */
  violation: number;
  rule: RuleId | "nenhuma";
  /** Gravidade esperada, de 0 (nada) a 3 (fechar a conta). */
  severity: number;
}

export interface CaseVerdict {
  outcome: Outcome;
  rule: RuleId | null;
  /** Média das probabilidades de violação. */
  violation: number;
  /** Média da gravidade entre os modelos que viram violação. */
  severity: number;
  /** Quantos modelos viram violação. */
  agreeing: number;
  voters: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Junta os votos. Há violação quando a maioria dos modelos vê violação (≥ 0,5)
 * e a média passa de 0,7. A gravidade decide o que acontece:
 * - abaixo de 1,5: nada (arquivada);
 * - de 1,5: o jogo sai do ar (ou o perfil é limpo), e conta uma remoção;
 * - de 2,5, ou de 2 numa regra de tolerância zero: a conta é fechada;
 * - a terceira remoção em 180 dias também fecha a conta.
 * Sem quórum devolve null: o caso espera e é julgado de novo.
 */
export function caseVerdict(answers: CaseAnswer[], priorRemovals: number): CaseVerdict | null {
  if (answers.length < QUORUM) return null;
  const majority = Math.floor(answers.length / 2) + 1;
  const yes = answers.filter((a) => a.violation >= 0.5 && a.rule !== "nenhuma");
  const violation = mean(answers.map((a) => a.violation));
  const base = { violation, agreeing: yes.length, voters: answers.length };
  if (yes.length < majority || violation < 0.7) return { outcome: "arquivada", rule: null, severity: 0, ...base };

  // A regra mais votada entre quem viu violação; empate fica com a primeira da lista (mais grave).
  const votes = new Map<RuleId, number>();
  for (const a of yes) votes.set(a.rule as RuleId, (votes.get(a.rule as RuleId) ?? 0) + 1);
  const rule = RULES.map((r) => r.id).filter((id) => votes.has(id)).sort((a, b) => votes.get(b)! - votes.get(a)!)[0];
  const severity = mean(yes.map((a) => a.severity));

  const zero = ruleById(rule)?.zeroTolerance;
  let outcome: Outcome = "arquivada";
  if (severity >= 2.5 || (zero && severity >= 2)) outcome = "banido";
  else if (severity >= 1.5) outcome = priorRemovals + 1 >= STRIKES_TO_BAN ? "banido" : "removido";
  return { outcome, rule: outcome === "arquivada" ? null : rule, severity, ...base };
}

/** Recurso: o banimento cai se a maioria não o mantém. Sem quórum, null (tente de novo). */
export function appealVerdict(keep: number[]): { upheld: boolean; keep: number } | null {
  if (keep.length < QUORUM) return null;
  const majority = Math.floor(keep.length / 2) + 1;
  const upheldVotes = keep.filter((p) => p >= 0.5).length;
  return { upheld: upheldVotes >= majority, keep: mean(keep) };
}

/** Lê a resposta de um modelo para as perguntas do caso; null se veio incompleta. */
export function readCaseAnswer(model: string, answers: unknown): CaseAnswer | null {
  const a = answers as {
    viola?: { noul?: unknown };
    regra?: { choice?: unknown };
    gravidade?: { score?: unknown };
  } | null;
  const violation = Number(a?.viola?.noul);
  const rule = String(a?.regra?.choice ?? "");
  const severity = Number(a?.gravidade?.score);
  if (!Number.isFinite(violation) || !Number.isFinite(severity)) return null;
  if (rule !== "nenhuma" && !ruleById(rule)) return null;
  return {
    model,
    violation: Math.min(1, Math.max(0, violation)),
    rule: rule as CaseAnswer["rule"],
    severity: Math.min(3, Math.max(0, severity)),
  };
}

/** Lê a probabilidade de manter o banimento; null se veio incompleta. */
export function readAppealAnswer(answers: unknown): number | null {
  const p = Number((answers as { manter?: { noul?: unknown } } | null)?.manter?.noul);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null;
}

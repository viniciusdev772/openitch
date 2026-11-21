import { RULES, ruleById, type RuleId } from "./rules";

/*
 * O tribunal do Portal dos Games. Quem decide são modelos de decisão do
 * OpenRouter (/api/alpha/decisions): em vez de texto, devolvem probabilidades
 * para perguntas tipadas. Como num tribunal superior, há duas formações:
 *
 * - Turma: três juízes baratos, de fabricantes diferentes, julgam todo caso.
 *   Placar unânime decide ali mesmo (arquivar ou tirar do ar).
 * - Plenário: a turma mais dois juízes de outras casas. É convocado quando a
 *   turma se divide, quando a pena seria fechar a conta, e em todo recurso.
 *   Fechar uma conta exige maioria qualificada (4 de 5, como os 2/3 do STF
 *   para súmula vinculante) e média alta: na dúvida, a pena mais leve.
 *
 * Por que assim (pesquisa de nov/2026):
 * - Modelos de decisão são baratos e consistentes, mas enviesados: tom
 *   emocional derruba a acurácia de 99% para 42%, e o viés vira justamente os
 *   votos em que o modelo estava em dúvida (arXiv 2610.18122). Por isso
 *   denúncia e recurso chegam aos juízes reescritos em tom neutro pelo relator
 *   (tribunal.ts), e a dúvida (placar dividido) sobe para o plenário.
 * - Juízes da mesma família erram juntos: 9 juízes valeram ~2 votos
 *   independentes (arXiv 2605.29800). O que conta é a diversidade de origem:
 *   Liquid (arquitetura própria), Perplexity (Qwen), TypeSafe (fechado),
 *   Google e Microsoft.
 *
 * Índice de decisão da Artificial Analysis v2.1 (nov/2026) e preço de entrada
 * por milhão de tokens (saída é grátis): Liquid d1.2-ultra 74,8 (US$ 0,042),
 * Perplexity Decider v1.2 69,8 (US$ 0,02), TypeSafe Jev 1.14 66,2
 * (US$ 0,042), Microsoft Decision 1.1 67,8 (US$ 0,042), Gemini Decision 1 66
 * (US$ 0,10). Um caso na turma sai por menos de US$ 0,0002; no plenário, com
 * parecer e fundamentação, por volta de US$ 0,001.
 */
export const TURMA = ["liquid/d1.2-ultra", "perplexity/pplx-decider-v1.2", "typesafe/jev-1.14"] as const;
export const PLENARIO_EXTRA = ["google/gemini-decision-1", "microsoft/microsoft-decision-1.1"] as const;
export const PLENARIO = [...TURMA, ...PLENARIO_EXTRA] as const;
/** O relator não vota: escreve o parecer neutro e a fundamentação (modelo de raciocínio de segurança da OpenAI). */
export const RELATOR = "openai/gpt-oss-safeguard-20b";

/** Mínimo de juízes que precisam responder para valer uma decisão. */
export const QUORUM = 2;
/** Fração de votos para fechar uma conta (ou manter o fechamento) no plenário. */
export const QUALIFIED = 0.8;
/** Média mínima de violação para fechar uma conta. */
export const BAN_CONFIDENCE = 0.85;
/**
 * Mediana mínima de violação para agir. Calibrada nos casos-modelo: páginas
 * limpas nunca passaram de 0,16 em juiz nenhum, e casos reais de cópia
 * ficaram com a mediana entre 0,68 e 0,80 (Jev e Microsoft votam baixo em
 * cópia). 0,6 separa os dois com folga.
 */
export const VIOLATION_MEDIAN = 0.6;

export type Outcome = "arquivada" | "removido" | "banido";
export type Stage = "turma" | "plenario";

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
  /** Média da gravidade entre os juízes que viram violação. */
  severity: number;
  /** Quantos juízes viram violação. */
  agreeing: number;
  voters: number;
  /** Todos votaram para o mesmo lado (todos viram violação, ou nenhum viu). */
  unanimous: boolean;
  /** O plenário queria fechar a conta, mas sem maioria qualificada: ficou a remoção. */
  mitigated?: boolean;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const majorityOf = (n: number) => Math.floor(n / 2) + 1;
const qualifiedOf = (n: number) => Math.ceil(n * QUALIFIED);
const sawViolation = (a: CaseAnswer) => a.violation >= 0.5 && a.rule !== "nenhuma";

/**
 * Junta os votos. Há violação quando a maioria vê violação (≥ 0,5) e a
 * mediana (o voto do meio) chega a VIOLATION_MEDIAN: a mediana, e não a média, porque um
 * ou dois juízes enviesados (tom emocional, por exemplo) arrastavam a média e
 * derrubavam um caso claro para os outros três. A gravidade decide o que
 * acontece:
 * - abaixo de 1,5: nada (arquivada);
 * - de 1,5: o jogo sai do ar (ou o perfil é limpo), e conta uma remoção;
 * - de 2,5, ou de 2 numa regra de tolerância zero: a conta é fechada;
 * - a terceira remoção em 180 dias também fecha a conta.
 * No plenário, fechar a conta exige maioria qualificada e média alta (aqui a
 * média, de propósito: qualquer dúvida forte de um juiz poupa a conta); sem
 * isso, fica a remoção. Sem quórum devolve null: o caso espera.
 */
export function caseVerdict(answers: CaseAnswer[], priorRemovals: number, opts: { plenary?: boolean } = {}): CaseVerdict | null {
  if (answers.length < QUORUM) return null;
  const yes = answers.filter(sawViolation);
  const violation = mean(answers.map((a) => a.violation));
  const unanimous = yes.length === 0 || yes.length === answers.length;
  const base = { violation, agreeing: yes.length, voters: answers.length, unanimous };
  const middle = median(answers.map((a) => a.violation));
  if (yes.length < majorityOf(answers.length) || middle < VIOLATION_MEDIAN) return { outcome: "arquivada", rule: null, severity: 0, ...base };

  // A regra mais votada entre quem viu violação; empate fica com a primeira da lista (mais grave).
  const votes = new Map<RuleId, number>();
  for (const a of yes) votes.set(a.rule as RuleId, (votes.get(a.rule as RuleId) ?? 0) + 1);
  const rule = RULES.map((r) => r.id).filter((id) => votes.has(id)).sort((a, b) => votes.get(b)! - votes.get(a)!)[0];
  const severity = mean(yes.map((a) => a.severity));

  const zero = ruleById(rule)?.zeroTolerance;
  let outcome: Outcome = "arquivada";
  if (severity >= 2.5 || (zero && severity >= 2)) outcome = "banido";
  else if (severity >= 1.5) outcome = priorRemovals + 1 >= STRIKES_TO_BAN ? "banido" : "removido";

  let mitigated = false;
  if (opts.plenary && outcome === "banido" && (yes.length < qualifiedOf(answers.length) || violation < BAN_CONFIDENCE)) {
    outcome = "removido";
    mitigated = true;
  }
  return { outcome, rule: outcome === "arquivada" ? null : rule, severity, ...base, ...(mitigated ? { mitigated } : {}) };
}

/**
 * A turma decide sozinha só quando é unânime e a pena não é fechar a conta.
 * Placar dividido ou pedido de banimento sobem para o plenário.
 */
export function needsPlenary(v: CaseVerdict): boolean {
  return !v.unanimous || v.outcome === "banido";
}

/**
 * Recurso: a decisão cai se não houver votos para mantê-la. Remoção de jogo
 * fica com maioria simples; fechamento de conta, só com maioria qualificada
 * (na dúvida, a conta reabre). Sem quórum, null (tente de novo).
 */
export function appealVerdict(keep: number[], opts: { qualified?: boolean } = {}): { upheld: boolean; keep: number; votes: number } | null {
  if (keep.length < QUORUM) return null;
  const votes = keep.filter((p) => p >= 0.5).length;
  const need = opts.qualified ? qualifiedOf(keep.length) : majorityOf(keep.length);
  return { upheld: votes >= need, keep: mean(keep), votes };
}

/** Lê a resposta de um juiz para as perguntas do caso; null se veio incompleta. */
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

/** Lê a probabilidade de manter a decisão; null se veio incompleta. */
export function readAppealAnswer(answers: unknown): number | null {
  const p = Number((answers as { manter?: { noul?: unknown } } | null)?.manter?.noul);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null;
}

/** Nome curto de um juiz para pessoas ("liquid/d1.2-ultra-20261116" → "Liquid d1.2-ultra"). */
export function judgeName(model: string): string {
  const [maker, rest = ""] = model.split("/");
  const name = rest.replace(/-\d{8}$/, "");
  const makers: Record<string, string> = {
    liquid: "Liquid",
    perplexity: "Perplexity",
    typesafe: "TypeSafe",
    google: "Google",
    microsoft: "Microsoft",
    openai: "OpenAI",
  };
  return `${makers[maker] ?? maker} ${name}`;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { appealQuestions, appealVerdict, caseQuestions, caseVerdict, readCaseAnswer, type CaseAnswer } from "../decide";
import { RULES } from "../rules";

const vote = (violation: number, rule: CaseAnswer["rule"], severity: number, model = "m"): CaseAnswer => ({ model, violation, rule, severity });

test("sem quórum, nada é decidido", () => {
  assert.equal(caseVerdict([vote(0.99, "golpe", 3)], 0), null);
});

test("um modelo sozinho não derruba nada", () => {
  const v = caseVerdict([vote(0.99, "odio", 3), vote(0.1, "nenhuma", 0), vote(0.2, "nenhuma", 0)], 0)!;
  assert.equal(v.outcome, "arquivada");
});

test("maioria com gravidade séria tira do ar; a terceira remoção fecha a conta", () => {
  const votes = [vote(0.9, "direitos", 2), vote(0.85, "direitos", 1.8), vote(0.6, "golpe", 1.6)];
  assert.deepEqual([caseVerdict(votes, 0)!.outcome, caseVerdict(votes, 0)!.rule], ["removido", "direitos"]);
  assert.equal(caseVerdict(votes, 2)!.outcome, "banido");
});

test("tolerância zero fecha a conta com gravidade 2; violação leve é arquivada", () => {
  assert.equal(caseVerdict([vote(0.95, "malware", 2.1), vote(0.9, "malware", 2)], 0)!.outcome, "banido");
  assert.equal(caseVerdict([vote(0.95, "sexual", 1), vote(0.9, "sexual", 1.2)], 0)!.outcome, "arquivada");
});

test("média abaixo de 70% não age, mesmo com maioria", () => {
  assert.equal(caseVerdict([vote(0.55, "odio", 3), vote(0.6, "odio", 3), vote(0.1, "nenhuma", 0)], 0)!.outcome, "arquivada");
});

test("recurso: cai sem maioria para manter", () => {
  assert.equal(appealVerdict([0.9, 0.3, 0.2])!.upheld, false);
  assert.equal(appealVerdict([0.9, 0.7, 0.2])!.upheld, true);
  assert.equal(appealVerdict([0.9]), null);
});

test("lê a resposta da API e recusa regra desconhecida", () => {
  const ok = readCaseAnswer("x", { viola: { noul: 0.96, type: "noul" }, regra: { choice: "golpe" }, gravidade: { score: 1.99 } });
  assert.deepEqual(ok, { model: "x", violation: 0.96, rule: "golpe", severity: 1.99 });
  assert.equal(readCaseAnswer("x", { viola: { noul: 0.9 }, regra: { choice: "inventada" }, gravidade: { score: 1 } }), null);
  assert.equal(readCaseAnswer("x", null), null);
});

test("as perguntas cobrem todas as regras", () => {
  const q = caseQuestions();
  assert.deepEqual(Object.keys(q.regra.criteria).sort(), ["nenhuma", ...RULES.map((r) => r.id)].sort());
  assert.equal(q.gravidade.criteria.length, 4);
});

test("o recurso pergunta sobre o alvo certo", () => {
  assert.match(appealQuestions("jogo").manter.instructions, /game .*taken down/);
  assert.match(appealQuestions("conta").manter.instructions, /account .*closed/);
});

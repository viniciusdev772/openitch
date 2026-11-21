import { test } from "node:test";
import assert from "node:assert/strict";
import { appealQuestions, appealVerdict, caseQuestions, caseVerdict, judgeName, needsPlenary, readCaseAnswer, type CaseAnswer } from "../decide";
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

test("mediana abaixo de 70% não age, mesmo com maioria", () => {
  assert.equal(caseVerdict([vote(0.55, "odio", 3), vote(0.6, "odio", 3), vote(0.1, "nenhuma", 0)], 0)!.outcome, "arquivada");
});

test("dois juízes enviesados não derrubam a maioria confiante (mediana, não média)", () => {
  // Caso real da calibração: denúncia emotiva de cópia; média 0,63, mediana 0,74.
  const v = caseVerdict(
    [vote(0.95, "direitos", 1.9), vote(0.96, "direitos", 1.8), vote(0.33, "nenhuma", 0.4), vote(0.74, "direitos", 1.7), vote(0.16, "nenhuma", 0.2)],
    0,
    { plenary: true },
  )!;
  assert.deepEqual([v.outcome, v.rule], ["removido", "direitos"]);
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

test("a turma só decide sozinha com placar unânime e sem pedido de banimento", () => {
  const unanimeLimpo = caseVerdict([vote(0.01, "nenhuma", 0), vote(0.02, "nenhuma", 0), vote(0.05, "nenhuma", 0)], 0)!;
  const unanimeRemove = caseVerdict([vote(0.9, "direitos", 1.8), vote(0.8, "direitos", 1.7), vote(0.75, "direitos", 1.6)], 0)!;
  const dividido = caseVerdict([vote(0.92, "direitos", 1.9), vote(0.6, "direitos", 1.5), vote(0.05, "nenhuma", 0)], 0)!;
  const banimento = caseVerdict([vote(0.99, "malware", 2.9), vote(0.98, "malware", 2.8), vote(0.97, "golpe", 2.9)], 0)!;
  assert.deepEqual(
    [needsPlenary(unanimeLimpo), needsPlenary(unanimeRemove), needsPlenary(dividido), needsPlenary(banimento)],
    [false, false, true, true],
  );
  assert.equal(dividido.unanimous, false);
});

test("no plenário, banir exige 4 de 5 e média alta; sem isso fica a remoção", () => {
  const cinco = [vote(0.99, "malware", 2.9), vote(0.98, "malware", 2.8), vote(0.97, "golpe", 2.9), vote(0.95, "malware", 2.7), vote(0.9, "malware", 2.6)];
  assert.equal(caseVerdict(cinco, 0, { plenary: true })!.outcome, "banido");
  const tresDeCinco = [vote(0.99, "odio", 2.9), vote(0.95, "odio", 2.8), vote(0.9, "odio", 2.7), vote(0.3, "nenhuma", 0.5), vote(0.2, "nenhuma", 0.3)];
  const v = caseVerdict(tresDeCinco, 0, { plenary: true })!;
  assert.deepEqual([v.outcome, v.mitigated], ["removido", true]); // 3 de 5 veem violação grave: tira do ar, não fecha a conta
  const quatroMediaBaixa = [vote(0.95, "odio", 2.9), vote(0.9, "odio", 2.8), vote(0.85, "odio", 2.7), vote(0.8, "odio", 2.6), vote(0.1, "nenhuma", 0)];
  const m = caseVerdict(quatroMediaBaixa, 0, { plenary: true })!;
  assert.deepEqual([m.outcome, m.mitigated], ["removido", true]); // 4 de 5, mas média 0,72 < 0,85
  // A mesma votação na turma (sem a regra do plenário) pediria banimento, e por isso subiria.
  assert.equal(caseVerdict(quatroMediaBaixa.slice(0, 3), 0)!.outcome, "banido");
});

test("recurso de conta só mantém o banimento com maioria qualificada", () => {
  assert.equal(appealVerdict([0.9, 0.9, 0.9, 0.2, 0.1], { qualified: true })!.upheld, false); // 3 de 5
  assert.equal(appealVerdict([0.9, 0.9, 0.9, 0.8, 0.1], { qualified: true })!.upheld, true); // 4 de 5
  assert.equal(appealVerdict([0.9, 0.9, 0.9, 0.2, 0.1])!.upheld, true); // remoção de jogo: maioria simples
});

test("nome curto dos juízes", () => {
  assert.equal(judgeName("liquid/d1.2-ultra-20261116"), "Liquid d1.2-ultra");
  assert.equal(judgeName("google/gemini-decision-1"), "Google gemini-decision-1");
});

test("o recurso pergunta sobre o alvo certo", () => {
  assert.match(appealQuestions("jogo").manter.instructions, /game .*taken down/);
  assert.match(appealQuestions("conta").manter.instructions, /account .*closed/);
});

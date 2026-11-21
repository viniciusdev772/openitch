import { test } from "node:test";
import assert from "node:assert/strict";
import { CASES, JUDGES, MAX_CARRY, accepted, score, type Case, type Evidence, type Tone } from "../casos";

/** Joga um caso inteiro: em cada pergunta, a resposta do tom pedido e (se `proof`) a melhor prova que ela quer. */
function play(c: Case, tone: Tone, proof: boolean, extra?: Evidence) {
  const lean = JUDGES.map((j) => j.start);
  for (const [n, q] of c.questions.entries()) {
    const answer = q.answers.find((a) => a.tone === tone) ?? q.answers[0];
    const best = proof ? c.evidence.filter((e) => q.wants.includes(e.id)).sort((a, b) => b.weight - a.weight)[0] ?? null : null;
    const ev = n === 0 && extra ? extra : best;
    score(q, answer, ev).forEach((d, i) => (lean[i] += d));
  }
  return lean;
}

test("cada caso tem 3 perguntas, 4 respostas por pergunta e provas que existem", () => {
  for (const c of CASES) {
    assert.equal(c.questions.length, 3, c.id);
    const ids = new Set(c.evidence.map((e) => e.id));
    for (const q of c.questions) {
      assert.equal(q.answers.length, 4, c.id);
      assert.ok(q.judge >= 0 && q.judge < JUDGES.length);
      for (const w of q.wants) assert.ok(ids.has(w), `${c.id}: ${w}`);
    }
    // As provas que as perguntas querem cabem na pasta.
    assert.ok(new Set(c.questions.flatMap((q) => q.wants)).size <= MAX_CARRY + 1, c.id);
  }
});

test("resposta específica com a prova certa vira o plenário", () => {
  for (const c of CASES) assert.ok(accepted(play(c, "especifico", true)), c.id);
});

test("detalhe sem prova não basta", () => {
  for (const c of CASES) assert.ok(!accepted(play(c, "especifico", false)), c.id);
});

test("emoção e ataque perdem, mesmo com provas", () => {
  for (const c of CASES) {
    assert.ok(!accepted(play(c, "emocao", false)), c.id);
    assert.ok(!accepted(play(c, "ataque", true)), c.id);
  }
});

test("a prova que atrapalha derruba a juíza cética", () => {
  for (const c of CASES) {
    const bad = c.evidence.find((e) => e.weight < 0)!;
    const clean = play(c, "especifico", true);
    const dirty = play(c, "especifico", true, bad);
    assert.ok(dirty[4] < clean[4], c.id);
  }
});

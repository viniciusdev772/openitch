import { test } from "node:test";
import assert from "node:assert/strict";
import { decisionPdf, safeText } from "../pdf";

test("texto do PDF fica no que a fonte padrão sabe desenhar (cp1252)", () => {
  assert.equal(safeText("Decisão nº 1 — “ação” ≥ 0,6 ✓ 🎮"), "Decisão nº 1 — “ação” >= 0,6  ");
});

test("gera um PDF de verdade, com acentos e sem logotipo", async () => {
  const bytes = await decisionPdf(
    {
      id: "ABC12345",
      at: new Date("2026-11-21T02:00:00Z"),
      kind: "Denúncia",
      bench: "Turma, 3 juízes",
      target: 'Jogo "Lantern Rock"',
      rule: { title: "Só publique o que é seu", text: "Publicar o jogo de outra pessoa sem permissão." },
      outcome: "O jogo foi tirado do ar.",
      reasoning: "A conta que publicou não é a do autor. ".repeat(40),
      votes: [{ judge: "Liquid d1.2-ultra", vote: "violação 97%" }],
      next: "Você pode recorrer uma vez.",
    },
    null,
  );
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.ok(bytes.length > 1500);
});

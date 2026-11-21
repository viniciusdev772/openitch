/*
 * Gera o PDF de uma decisão de exemplo, julgada ao vivo pelo tribunal, para
 * conferir a diagramação sem precisar de banco. Usa um caso-modelo ou um
 * recurso-modelo (src/lib/moderation/casos-modelo.ts) e o logotipo de
 * public/marca.
 *
 *   OPENROUTER_API_KEY=... node scripts/exemplo-decisao-pdf.ts [id-do-caso-ou-recurso] [saida.pdf]
 */
import { register } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

register(new URL("../src/lib/builds/__tests__/hooks.mjs", import.meta.url));

const { CASOS, RECURSOS } = await import("../src/lib/moderation/casos-modelo");
const { judgeAppealCase, judgeCase, writeReasoning } = await import("../src/lib/moderation/tribunal");
const { decisionPdf, pdfDataOf } = await import("../src/lib/moderation/pdf");
const { ObjectId } = await import("mongodb");

const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("Defina OPENROUTER_API_KEY.");
  process.exit(1);
}
const id = process.argv[2] ?? "copia-creditada-sem-denuncia";
const out = process.argv[3] ?? "decisao-exemplo.pdf";
const titleOf = (text: string[]) => text.find((l) => l.startsWith("Title: "))?.slice(7) ?? id;
const logo = new Uint8Array(readFileSync(new URL("../public/marca/logo.png", import.meta.url)));

const caso = CASOS.find((c) => c.id === id);
const recurso = RECURSOS.find((r) => r.id === id);

if (caso) {
  const res = await judgeCase(key, { text: caso.text, images: [], claims: caso.claims, priorRemovals: 0 });
  if (!res) throw new Error("Sem quórum.");
  const v = res.verdict;
  const reasoning =
    v.outcome === "arquivada"
      ? null
      : await writeReasoning(key, { decision: v.outcome === "banido" ? "fechar a conta" : "tirar o jogo do ar", rule: v.rule, material: [...caso.text, ...res.brief] });
  const data = pdfDataOf(
    { _id: new ObjectId(), at: new Date(), kind: caso.claims.length ? "denuncia" : "publicacao", stage: res.stage, rule: v.rule, outcome: v.outcome, reasoning, votes: res.votes, mitigated: v.mitigated ?? false },
    `Jogo "${titleOf(caso.text)}"`,
  );
  writeFileSync(out, await decisionPdf(data, logo));
  console.log(`${v.outcome} (${res.stage}) → ${out}`);
} else if (recurso) {
  const res = await judgeAppealCase(key, {
    target: recurso.target,
    rule: recurso.rule,
    original: { violation: 0.99, severity: 2.8 },
    snapshot: recurso.snapshot,
    images: [],
    appeal: recurso.appeal,
  });
  if (!res) throw new Error("Sem quórum.");
  const what = recurso.target === "conta" ? "o fechamento da conta" : "a remoção do jogo";
  const reasoning = await writeReasoning(key, {
    decision: res.upheld ? `manter ${what}; o recurso não mostrou erro na decisão` : `desfazer ${what}; o recurso foi aceito`,
    rule: recurso.rule,
    material: res.state,
  });
  const data = pdfDataOf(
    { _id: new ObjectId(), at: new Date(), kind: "recurso", stage: "plenario", rule: recurso.rule, outcome: res.upheld ? "mantido" : "revertido", reasoning, votes: res.votes, mitigated: false },
    `Jogo "${titleOf(recurso.snapshot)}"`,
    recurso.appeal,
  );
  writeFileSync(out, await decisionPdf(data, logo));
  console.log(`${res.upheld ? "mantido" : "revertido"} (plenario, manter ${res.keep.toFixed(2)}) → ${out}`);
} else {
  throw new Error(`Caso ou recurso não encontrado: ${id}`);
}

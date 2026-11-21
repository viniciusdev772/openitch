/*
 * Gera o PDF de uma decisão de exemplo, julgada ao vivo pelo tribunal, para
 * conferir a diagramação sem precisar de banco. Usa um caso-modelo
 * (src/lib/moderation/casos-modelo.ts) e o logotipo de public/marca.
 *
 *   OPENROUTER_API_KEY=... node scripts/exemplo-decisao-pdf.ts [id-do-caso] [saida.pdf]
 */
import { register } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

register(new URL("../src/lib/builds/__tests__/hooks.mjs", import.meta.url));

const { CASOS } = await import("../src/lib/moderation/casos-modelo");
const { judgeCase, writeReasoning } = await import("../src/lib/moderation/tribunal");
const { decisionPdf, pdfDataOf } = await import("../src/lib/moderation/pdf");
const { ObjectId } = await import("mongodb");

const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("Defina OPENROUTER_API_KEY.");
  process.exit(1);
}
const id = process.argv[2] ?? "copia-creditada-sem-denuncia";
const out = process.argv[3] ?? "decisao-exemplo.pdf";
const caso = CASOS.find((c) => c.id === id);
if (!caso) throw new Error(`Caso não encontrado: ${id}`);

const res = await judgeCase(key, { text: caso.text, images: [], claims: caso.claims, priorRemovals: 0 });
if (!res) throw new Error("Sem quórum.");
const v = res.verdict;
const reasoning =
  v.outcome === "arquivada" ? null : await writeReasoning(key, { decision: v.outcome === "banido" ? "fechar a conta" : "tirar o jogo do ar", rule: v.rule, material: [...caso.text, ...res.brief] });

const title = caso.text.find((l) => l.startsWith("Title: "))?.slice(7) ?? caso.id;
const data = pdfDataOf(
  {
    _id: new ObjectId(),
    at: new Date(),
    kind: caso.claims.length ? "denuncia" : "publicacao",
    stage: res.stage,
    rule: v.rule,
    outcome: v.outcome,
    reasoning,
    votes: res.votes,
    mitigated: v.mitigated ?? false,
  },
  `Jogo "${title}"`,
);
const logo = new Uint8Array(readFileSync(new URL("../public/marca/logo.png", import.meta.url)));
writeFileSync(out, await decisionPdf(data, logo));
console.log(`${v.outcome} (${res.stage}) → ${out}`);

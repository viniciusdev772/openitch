/*
 * Calibração do tribunal de moderação: roda os casos-modelo
 * (src/lib/moderation/casos-modelo.ts) pelo mesmo rito do site e mostra o
 * acerto do colegiado e de cada juiz. Rode quando trocar um juiz, uma regra
 * ou um limiar. Gasta alguns centavos de dólar no OpenRouter.
 *
 *   OPENROUTER_API_KEY=... node scripts/calibrar-moderacao.ts [--fundamentar] [--so=id1,id2]
 *
 * --fundamentar pede também a fundamentação do relator nos casos com pena.
 */
import { register } from "node:module";

register(new URL("../src/lib/builds/__tests__/hooks.mjs", import.meta.url));

const { CASOS, RECURSOS } = await import("../src/lib/moderation/casos-modelo");
const { judgeAppealCase, judgeCase, writeReasoning } = await import("../src/lib/moderation/tribunal");
const { judgeName, readAppealAnswer, readCaseAnswer } = await import("../src/lib/moderation/decide");

const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("Defina OPENROUTER_API_KEY.");
  process.exit(1);
}
const args = process.argv.slice(2);
const fundamentar = args.includes("--fundamentar");
const only = args.find((a) => a.startsWith("--so="))?.slice(5).split(",");
const pick = <T extends { id: string }>(xs: T[]) => (only ? xs.filter((x) => only.includes(x.id)) : xs);

type Tally = { right: number; total: number };
const perJudge = new Map<string, Tally>();
const count = (judge: string, right: boolean) => {
  const t = perJudge.get(judge) ?? { right: 0, total: 0 };
  t.total++;
  if (right) t.right++;
  perJudge.set(judge, t);
};
let right = 0;
let total = 0;
let plenary = 0;
let cost = 0;

console.log("\n== Casos ==");
for (const c of pick(CASOS)) {
  const res = await judgeCase(key, { text: c.text, images: [], claims: c.claims, priorRemovals: 0 });
  total++;
  if (!res) {
    console.log(`✗ ${c.id}: sem quórum`);
    continue;
  }
  const out = res.verdict.outcome;
  const ok = c.espera === "arquivada" ? out === "arquivada" : c.espera === "banido" ? out === "banido" : out !== "arquivada";
  if (ok) right++;
  if (res.stage === "plenario") plenary++;
  const shouldAct = c.espera !== "arquivada";
  const votes = res.votes.map((v) => {
    cost += v.cost ?? 0;
    const a = readCaseAnswer(v.model, v.answers);
    const saw = Boolean(a && a.violation >= 0.5 && a.rule !== "nenhuma");
    count(judgeName(v.model), saw === shouldAct);
    return a ? `${judgeName(v.model).split(" ")[0]} ${a.violation.toFixed(2)}${saw ? `/${a.rule}` : ""}` : `${v.model} ?`;
  });
  console.log(
    `${ok ? "✓" : "✗"} ${c.id} (${c.sobre}): esperado ${c.espera}, saiu ${out}${res.verdict.rule ? ` (${res.verdict.rule})` : ""}${res.verdict.mitigated ? " [banimento sem maioria qualificada]" : ""} · ${res.stage} · ${votes.join(", ")}`,
  );
  if (c.claims.length) console.log(`    parecer: ${res.brief.join(" | ").replace(/\n/g, " ").slice(0, 300)}`);
  if (fundamentar && out !== "arquivada") {
    const r = await writeReasoning(key, { decision: out, rule: res.verdict.rule, material: [...c.text, ...res.brief] });
    console.log(`    fundamentação: ${r ?? "(o relator não respondeu)"}`);
  }
}

console.log("\n== Recursos (sempre no plenário) ==");
for (const r of pick(RECURSOS)) {
  const res = await judgeAppealCase(key, {
    target: r.target,
    rule: r.rule,
    original: { violation: 0.9, severity: 2.2 },
    snapshot: r.snapshot,
    images: [],
    appeal: r.appeal,
  });
  total++;
  if (!res) {
    console.log(`✗ ${r.id}: sem quórum`);
    continue;
  }
  const ok = res.upheld === r.mantem;
  if (ok) right++;
  const votes = res.votes.map((v) => {
    cost += v.cost ?? 0;
    const p = readAppealAnswer(v.answers);
    if (p !== null) count(judgeName(v.model), p >= 0.5 === r.mantem);
    return `${judgeName(v.model).split(" ")[0]} ${p?.toFixed(2) ?? "?"}`;
  });
  console.log(
    `${ok ? "✓" : "✗"} ${r.id} (${r.sobre}): esperado ${r.mantem ? "mantido" : "revertido"}, saiu ${res.upheld ? "mantido" : "revertido"} · ${votes.join(", ")}`,
  );
}

console.log("\n== Placar ==");
console.log(`Colegiado: ${right}/${total} (${Math.round((right / Math.max(total, 1)) * 100)}%) · casos no plenário: ${plenary} · custo dos votos: US$ ${cost.toFixed(4)}`);
for (const [judge, t] of [...perJudge].sort((a, b) => b[1].right / b[1].total - a[1].right / a[1].total)) {
  console.log(`  ${judge.padEnd(36)} ${t.right}/${t.total} (${Math.round((t.right / t.total) * 100)}%)`);
}

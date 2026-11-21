import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MAX_WAIT_MS, MIN_WAIT_MS, openAtFor, waitMessage } from "../novato-rules";

test("a espera fica entre 3 horas e 3 dias e é fixa para a mesma conta", () => {
  const created = new Date("2026-11-20T12:00:00Z");
  const waits = new Set<number>();
  for (let i = 0; i < 500; i++) {
    const h = createHash("sha256").update(String(i)).digest("hex");
    const w = openAtFor(created, h).getTime() - created.getTime();
    assert.ok(w >= MIN_WAIT_MS && w <= MAX_WAIT_MS, `fora da faixa: ${w}`);
    assert.equal(openAtFor(created, h).getTime() - created.getTime(), w);
    waits.add(Math.floor(w / 3_600_000));
  }
  assert.ok(waits.size > 50, "o sorteio espalha pelas horas");
});

test("o aviso diz o motivo, a data e quanto falta", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const msg = waitMessage(new Date(now + 29 * 3_600_000), now);
  assert.match(msg, /vírus, golpes ou spam/);
  assert.match(msg, /entre 3 horas e 3 dias/);
  assert.match(msg, /21 de novembro, às 14:00/);
  assert.match(msg, /daqui a cerca de 1 dia e 5 horas/);
});

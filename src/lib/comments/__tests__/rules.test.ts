import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, cleanComment, COMMENT_MAX, hasLink } from "../rules";

test("limpa o comentário e confere o tamanho", () => {
  assert.deepEqual(cleanComment("  oi​\r\n\n\n\nbom jogo  "), { ok: true, body: "oi\n\nbom jogo" });
  assert.equal(cleanComment(" ").ok, false);
  assert.equal(cleanComment(42).ok, false);
  assert.equal(cleanComment("a".repeat(COMMENT_MAX + 1)).ok, false);
});

test("reconhece links (bloqueados para conta nova)", () => {
  assert.ok(hasLink("veja https://x.com"));
  assert.ok(hasLink("acesse robux-gratis.xyz agora"));
  assert.ok(hasLink("www.site"));
  assert.ok(!hasLink("nota 9.5, muito bom"));
  assert.ok(!hasLink("fase 3 é difícil"));
});

test("tempo relativo", () => {
  const now = Date.parse("2026-11-21T12:00:00Z");
  assert.equal(ago("2026-11-21T11:59:30Z", now), "agora");
  assert.equal(ago("2026-11-21T11:30:00Z", now), "há 30 min");
  assert.equal(ago("2026-11-21T07:00:00Z", now), "há 5 h");
  assert.equal(ago("2026-11-20T12:00:00Z", now), "há 1 dia");
});

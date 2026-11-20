import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUpload } from "../uploads";

// Rodar: node --conditions=react-server --experimental-strip-types --import ./src/lib/builds/__tests__/register.mjs --test src/lib/itch/__tests__/*.test.ts

test("upload: as duas formas da API (snake_case com p_*, camelCase com platforms)", () => {
  const a = normalizeUpload({ id: 7, filename: "Jogo-win64.zip", size: 1000, type: "default", p_windows: true, p_linux: true, storage: "hosted", updated_at: "2026-11-01T10:00:00Z" })!;
  assert.deepEqual(a.platforms, ["windows", "linux"]);
  assert.equal(a.kind, "download");
  assert.equal(a.updatedAt, Date.parse("2026-11-01T10:00:00Z"));

  const b = normalizeUpload({ id: 8, filename: "mac.zip", size: 5, type: "default", platforms: { osx: "all" }, storage: "build", buildId: 99, displayName: "Mac" })!;
  assert.deepEqual(b.platforms, ["macos"]);
  assert.equal(b.buildId, 99);
  assert.equal(b.displayName, "Mac");

  assert.equal(normalizeUpload({ id: 9, filename: "web.zip", size: 5, type: "html" })!.kind, "web");
  assert.deepEqual(normalizeUpload({ id: 10, filename: "app.apk", size: 5, type: "default" })!.platforms, ["android"]);
  assert.equal(normalizeUpload({ id: 11, filename: "ost.zip", size: 5, type: "soundtrack" })!.kind, "outro");
  assert.equal(normalizeUpload({ filename: "sem-id" }), null);
});

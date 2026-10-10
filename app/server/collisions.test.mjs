import assert from "node:assert/strict";
import test from "node:test";
import { findCollision } from "./collisions.mjs";

const unit = (overrides = {}) => ({ sessionId: "a", name: "Authentication", cwd: "/work/auth", repo: "demo", repoRoot: "/repo/.git", status: "done", landed: {}, files: new Set(["src/permissions.js"]), ...overrides });
test("reviewable branches warn about the same edited file", () => {
  const a = unit(), b = unit({ sessionId: "b", name: "API", cwd: "/work/api" });
  assert.deepEqual(findCollision(a, new Map([["a", a], ["b", b]])), { file: "src/permissions.js", other: "API", otherSession: "b" });
});
test("working, gone, unrelated files and equally named repositories do not cause false warnings", () => {
  const a = unit();
  for (const b of [unit({ repoRoot: "/different/.git" }), unit({ files: new Set(["other.js"]) }), unit({ status: "gone" })]) {
    assert.equal(findCollision(a, new Map([["a", a], ["b", b]])), null);
  }
  assert.equal(findCollision(unit({ landed: null, status: "working" }), new Map([["b", unit()]])), null);
});
test("a pending edit resolves its absolute path against its own worktree", () => {
  const a = unit({ landed: null, held: { tool: "Edit", input: { file_path: "/work/auth/src/permissions.js" } } });
  assert.equal(findCollision(a, new Map([["b", unit({ sessionId: "b", name: "API" })]])).other, "API");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeHooks } from "../share/merge.js";

test("merges function hooks so all run in order", async () => {
  const calls = [];
  const a = { "tool.execute.before": async () => { calls.push("a"); } };
  const b = { "tool.execute.before": async () => { calls.push("b"); } };
  const merged = mergeHooks(a, b);

  await merged["tool.execute.before"]();
  assert.deepEqual(calls, ["a", "b"]);
});

test("merges object values by key", () => {
  const a = { tool: { alpha: 1 } };
  const b = { tool: { beta: 2 } };
  const merged = mergeHooks(a, b);
  assert.deepEqual(merged.tool, { alpha: 1, beta: 2 });
});

test("ignores undefined values", () => {
  const merged = mergeHooks(undefined, { event: async () => {} });
  assert.equal(typeof merged.event, "function");
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getActiveGuardsCount, getCuratedMemoryCount, getMetrics } from "../tui/src/lib/metrics.js";
import { appendMemory, projectMemoryFile, GLOBAL_FILE } from "../memory/store.js";

test("getActiveGuardsCount returns 7 for default configuration", () => {
  const count = getActiveGuardsCount({
    guard: {
      readBeforeWrite: true,
      staleWrite: true,
      planMode: true,
      secretScanner: true,
      commitGuard: true,
      devServerGuard: true,
      dangerousBash: true,
    },
  });
  assert.equal(count, 7);
});

test("getActiveGuardsCount adjusts for disabled flags and tools", () => {
  const count = getActiveGuardsCount({
    guard: {
      readBeforeWrite: true,
      staleWrite: false, // disabled
      planMode: true,
      secretScanner: false, // disabled
      commitGuard: true,
      devServerGuard: true,
      dangerousBash: true,
      tools: {
        delete: "deny",
        webfetch: "deny",
      },
    },
  });
  // 5 active boolean flags + 2 tools = 7
  assert.equal(count, 7);
});

test("getCuratedMemoryCount returns non-negative integer", () => {
  const count = getCuratedMemoryCount(process.cwd());
  assert.equal(typeof count, "number");
  assert.ok(count >= 0);
});

test("getMetrics returns structured metrics object", () => {
  const metrics = getMetrics(process.cwd(), {
    guard: { readBeforeWrite: true, dangerousBash: true },
  });
  assert.equal(typeof metrics.guardsActive, "number");
  assert.equal(typeof metrics.memoryNotes, "number");
});

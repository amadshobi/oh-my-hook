import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { loadLedger, saveLedger, markRead, wasRead, isStale, statOf, cleanupSessionLedger } from "../share/state.js";

// The ledger file is global (~/.config/opencode/...). To keep tests
// isolated, we point LEDGER_FILE indirectly by monkeypatching is not
// possible (const), so we test the pure helpers that don't depend on the
// global path: markRead/wasRead/isStale/statOf against an in-memory ledger.
test("markRead then wasRead returns true", () => {
  const ledger = {};
  const tmp = path.join(mkdtempSync(path.join(os.tmpdir(), "oh-my-hook-")), "a.ts");
  writeFileSync(tmp, "hello");
  markRead(ledger, tmp, statOf(tmp));
  assert.equal(wasRead(ledger, tmp), true);
  rmSync(path.dirname(tmp), { recursive: true, force: true });
});

test("isStale detects mtime/size change", () => {
  const ledger = {};
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "oh-my-hook-"));
  const tmp = path.join(tmpDir, "a.ts");
  writeFileSync(tmp, "v1");

  markRead(ledger, tmp, statOf(tmp));
  assert.equal(isStale(ledger, tmp), false);

  // Modify the file on disk after it was "read".
  writeFileSync(tmp, "v2 (longer content to change size and mtime)");
  assert.equal(isStale(ledger, tmp), true);

  rmSync(tmpDir, { recursive: true, force: true });
});

test("isStale returns false for never-read files", () => {
  assert.equal(isStale({}, "/nonexistent/never-read.ts"), false);
});

test("per-session read-ledger isolates reads and supports cleanup", () => {
  const ledger = {};
  const file = "/workspace/src/app.js";
  const sess1 = "ses_1";
  const sess2 = "ses_2";

  markRead(ledger, file, { mtimeMs: 100, size: 200 }, sess1);
  assert.equal(wasRead(ledger, file, sess1), true);
  assert.equal(wasRead(ledger, file, sess2), false);

  cleanupSessionLedger(ledger, sess1);
  assert.equal(wasRead(ledger, file, sess1), false);
});

test("saveLedger/loadLedger round-trip", () => {
  // Use the real global path but guard against clobbering a real ledger.
  const before = loadLedger();
  try {
    saveLedger({ __test: { readAt: 1 } });
    const after = loadLedger();
    assert.equal(after.__test.readAt, 1);
  } finally {
    saveLedger(before);
  }
});

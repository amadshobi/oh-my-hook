import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import {
	loadLedger,
	saveLedger,
	markRead,
	wasRead,
	isStale,
	statOf,
	cleanupSessionLedger,
	getReadRecord,
} from "../share/state.js";

// The ledger file is global (~/.config/opencode/...). To keep tests
// isolated, we point LEDGER_FILE indirectly by monkeypatching is not
// possible (const), so we test the pure helpers that don't depend on the
// global path: markRead/wasRead/isStale/statOf against an in-memory ledger.
test("markRead then wasRead returns true", () => {
	const ledger = {};
	const tmp = path.join(
		mkdtempSync(path.join(os.tmpdir(), "oh-my-hook-")),
		"a.ts",
	);
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

test("cross-session fallback: wasRead succeeds and re-syncs when file exists and matches on disk", () => {
	const ledger = {};
	const tmpDir = mkdtempSync(path.join(os.tmpdir(), "oh-my-hook-cross-"));
	const tmp = path.join(tmpDir, "cross.ts");
	writeFileSync(tmp, "initial content");

	const sess1 = "ses_attach_1";
	const sess2 = "ses_attach_2";

	// 1. Read in session 1
	markRead(ledger, tmp, statOf(tmp), sess1);
	assert.equal(wasRead(ledger, tmp, sess1), true);
	assert.equal(
		ledger[sess2]?.[tmp],
		undefined,
		"session 2 initially has no record",
	);

	// 2. Query in session 2 without reading in session 2 (file on disk is unchanged)
	assert.equal(
		wasRead(ledger, tmp, sess2),
		true,
		"wasRead should fallback to fresh cross-session record",
	);

	// 3. Verify session 2 now has re-synced record
	assert.ok(ledger[sess2]?.[tmp], "session 2 should now have re-synced record");
	assert.equal(ledger[sess2][tmp].size, ledger[sess1][tmp].size);

	rmSync(tmpDir, { recursive: true, force: true });
});

test("cross-session fallback: wasRead rejects when file on disk was modified externally (stale)", () => {
	const ledger = {};
	const tmpDir = mkdtempSync(path.join(os.tmpdir(), "oh-my-hook-stale-cross-"));
	const tmp = path.join(tmpDir, "stale-cross.ts");
	writeFileSync(tmp, "version 1");

	const sess1 = "ses_orig";
	const sess2 = "ses_reconnected";

	// 1. Read in session 1
	markRead(ledger, tmp, statOf(tmp), sess1);

	// 2. Modify file on disk externally
	writeFileSync(tmp, "version 2 with modified length and timestamp");

	// 3. Query in session 2 (should NOT fallback because disk state is stale)
	assert.equal(
		wasRead(ledger, tmp, sess2),
		false,
		"stale cross-session record must be rejected",
	);
	assert.equal(
		ledger[sess2]?.[tmp],
		undefined,
		"session 2 should NOT receive stale re-sync",
	);

	// Also isStale should detect staleness across sessions
	assert.equal(
		isStale(ledger, tmp, sess2),
		true,
		"isStale should report true for stale cross-session file",
	);

	rmSync(tmpDir, { recursive: true, force: true });
});

test("getReadRecord: prioritizes direct session hit over cross-session matches", () => {
	const ledger = {};
	const file = "/workspace/direct.ts";
	const sess1 = "ses_old";
	const sess2 = "ses_current";

	markRead(ledger, file, { readAt: 100, mtimeMs: 1 }, sess1);
	markRead(ledger, file, { readAt: 200, mtimeMs: 2 }, sess2);

	const direct = getReadRecord(ledger, file, sess2);
	assert.equal(direct.isDirect, true);
	assert.equal(direct.sourceSession, sess2);
	assert.equal(direct.entry.mtimeMs, 2);

	const cross = getReadRecord(ledger, file, "ses_other");
	assert.equal(cross.isDirect, false);
	assert.equal(
		cross.sourceSession,
		sess2,
		"should pick newest readAt across sessions",
	);
	assert.equal(cross.entry.mtimeMs, 2);
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

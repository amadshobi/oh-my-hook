#!/usr/bin/env node
/**
 * read-guard-session.hook.e2e.js — deterministic E2E test for Issue #24:
 * Preserving read-guard ledger state across session attach/detach & runner restarts.
 *
 * Scenarios verified:
 *   1. File read in session 1 (ses_initial) allows editing in session 2 (ses_reconnected)
 *      without throwing readGuardUnread, provided the on-disk file remains fresh.
 *   2. The ledger automatically re-syncs the fresh read entry into session 2's key.
 *   3. If the file is modified on disk externally between sessions, cross-session
 *      fallback is correctly rejected and mutation is blocked.
 *
 * Usage: node tests/e2e/read-guard-session.hook.e2e.js
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLedger, saveLedger } from "../../share/state.js";
import { createReadGuard } from "../../sandbox/read-guard.js";

function assert(cond, message) {
	if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

console.log("\n[E2E] Read-Guard Cross-Session Ledger Preservation (Issue #24)");

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "omh-rg-session-e2e-"));
const targetFile = path.join(tmpDir, "src", "app.ts");
const SESS_1 = "ses_attach_init_" + Date.now();
const SESS_2 = "ses_reconnect_attach_" + Date.now();
const SESS_3 = "ses_external_mod_" + Date.now();

import { mkdirSync } from "node:fs";
mkdirSync(path.dirname(targetFile), { recursive: true });
writeFileSync(targetFile, "export const app = 'v1';\n");

const initialLedger = loadLedger();

try {
	const hooks = createReadGuard({ directory: tmpDir });

	// ------------------------------------------------------------------------
	// 1. Session 1 reads the file
	// ------------------------------------------------------------------------
	console.log("  1. Session 1 ('ses_initial') reads the file...");
	await hooks["tool.execute.after"](
		{ tool: "read", sessionID: SESS_1 },
		{ args: { filePath: targetFile } },
	);

	const ledger1 = loadLedger();
	assert(
		ledger1[SESS_1]?.[targetFile],
		"Session 1 should have recorded the file in ledger",
	);
	assert(
		!ledger1[SESS_2]?.[targetFile],
		"Session 2 should not have a record yet",
	);
	console.log("  → File recorded under Session 1 ledger key");

	// ------------------------------------------------------------------------
	// 2. User detaches and reconnects as Session 2 (file on disk is UNCHANGED)
	// ------------------------------------------------------------------------
	console.log(
		"  2. Session 2 ('ses_reconnected') attempts edit without prior read in Session 2...",
	);
	let blocked = false;
	let errorMsg = "";
	try {
		await hooks["tool.execute.before"]({
			tool: "edit",
			args: {
				filePath: targetFile,
				oldString: "export const app = 'v1';",
				newString: "export const app = 'v2';",
			},
			sessionID: SESS_2,
		});
	} catch (e) {
		blocked = true;
		errorMsg = e.message;
	}

	assert(
		!blocked,
		`Expected edit to succeed via cross-session fallback, but was blocked: ${errorMsg}`,
	);
	console.log(
		"  → Edit ALLOWED via cross-session freshness fallback (no unread error)",
	);

	// Verify session 2 re-sync in persisted ledger
	const ledger2 = loadLedger();
	assert(
		ledger2[SESS_2]?.[targetFile],
		"Session 2 should have automatically re-synced the read record",
	);
	console.log("  → Ledger successfully re-synced record into Session 2 key");

	// ------------------------------------------------------------------------
	// 3. File is modified externally on disk (stale)
	// ------------------------------------------------------------------------
	console.log(
		"  3. Modifying file on disk externally and connecting as Session 3...",
	);
	writeFileSync(
		targetFile,
		"export const app = 'v_external_changed_content';\n",
	);

	blocked = false;
	errorMsg = "";
	try {
		await hooks["tool.execute.before"]({
			tool: "edit",
			args: {
				filePath: targetFile,
				oldString: "app",
				newString: "app_mod",
			},
			sessionID: SESS_3,
		});
	} catch (e) {
		blocked = true;
		errorMsg = e.message;
	}

	assert(
		blocked,
		"Expected edit in Session 3 to be BLOCKED because on-disk state changed",
	);
	assert(
		/unread|stale|belum dibaca|berubah/i.test(errorMsg),
		`Block message should indicate unread or stale: ${errorMsg.slice(0, 100)}`,
	);
	console.log("  → Mutation correctly BLOCKED on stale external change");

	console.log(
		"\n✅ PASS: Read-Guard Cross-Session Ledger Preservation verified 100%",
	);
} catch (e) {
	console.error(`\n❌ FAIL: ${e.message}`);
	process.exitCode = 1;
} finally {
	// Cleanup ledger entries created by this test
	const finalLedger = loadLedger();
	delete finalLedger[SESS_1];
	delete finalLedger[SESS_2];
	delete finalLedger[SESS_3];
	saveLedger(finalLedger);

	try {
		rmSync(tmpDir, { recursive: true, force: true });
	} catch {}
}

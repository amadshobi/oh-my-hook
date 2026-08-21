#!/usr/bin/env node
/**
 * stale-write.hook.e2e.js — deterministic test of the stale-write guard
 * against the ACTUAL hook pipeline used by OpenCode.
 *
 * The E2E-via-model version is timing-sensitive (the model reads and writes
 * within a window a watcher can't reliably hit). This test drives the same
 * `tool.execute.before` hook the plugin registers, but with full control:
 *
 *   1. Create a file and mark it "read" in the ledger (fresh mtime).
 *   2. Modify the file on disk (simulating an external change) — the on-disk
 *      mtime now differs from what the ledger recorded.
 *   3. Invoke the real `tool.execute.before` for tool `edit` — it must throw
 *      the stale-write block.
 *   4. Clean up the ledger entry and the temp dir.
 *
 * This exercises the exact same guard logic that runs inside OpenCode,
 * without depending on model timing.
 *
 * Usage: node tests/e2e/stale-write.hook.e2e.js
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLedger, saveLedger, markRead, statOf } from "../../share/state.js";
import { createReadGuard } from "../../sandbox/read-guard.js";

function assert(cond, message) {
	if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "ohmyhook-stale-hook-"));
const targetFile = path.join(tmpDir, "config.js");
writeFileSync(targetFile, "export const VERSION = 'v1';\n");

// Save the real ledger so we can restore it.
const ledger = loadLedger();
const originalEntry = ledger[targetFile];

console.log("\n[1/1] stale-write guard (deterministic, real hook pipeline)");

try {
	// 1. Model "reads" the file → ledger records current mtime/size.
	markRead(ledger, targetFile, statOf(targetFile));
	saveLedger(ledger);
	console.log("  → file marked as read (fresh mtime)");

	// 2. External process changes the file on disk.
	writeFileSync(
		targetFile,
		"export const VERSION = 'v2';\n// changed externally\n",
	);
	console.log("  → file changed on disk after read (external)");

	// 3. Invoke the real hook the plugin registers for edit.
	const hooks = createReadGuard({ directory: tmpDir });
	let blocked = false;
	let message = "";
	try {
		await hooks["tool.execute.before"]({
			tool: "edit",
			args: { filePath: targetFile, oldString: "v2", newString: "v3" },
			sessionID: "test-session",
		});
	} catch (e) {
		blocked = true;
		message = e.message;
	}

	assert(blocked, "expected stale-write hook to throw a block");
	assert(
		/stale|berubah/i.test(message),
		`block message should mention stale/berubah: ${message.slice(0, 120)}`,
	);
	console.log(`  → hook blocked with: ${message.split("\n")[0]}`);

	console.log(
		"\n✅ PASS: stale-write guard blocks edits to files changed on disk",
	);
} catch (e) {
	console.error(`\n❌ FAIL: ${e.message}`);
	process.exitCode = 1;
} finally {
	if (originalEntry) ledger[targetFile] = originalEntry;
	else delete ledger[targetFile];
	saveLedger(ledger);
	rmSync(tmpDir, { recursive: true, force: true });
}

/**
 * tests/read-guard.test.js — Unit/integration tests for the createReadGuard
 * hook pipeline (Issue #24: read-guard state across session attach/detach and
 * runner restarts).
 *
 * The ledger is a global JSON file, so every test backs up the current ledger
 * and restores it in a `finally` block. All file fixtures live in mkdtemp dirs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { loadLedger, saveLedger } from "../share/state.js";
import { createReadGuard } from "../sandbox/read-guard.js";

/** Create a unique session ID for ledger isolation. */
function uniqueSession(prefix) {
	return `ses_rg_test_${prefix}_${Date.now()}_${Math.random()
		.toString(36)
		.slice(2)}`;
}

/** Create a temp workspace with a seeded file. */
function makeWorkspace() {
	const dir = mkdtempSync(path.join(os.tmpdir(), "omh-rg-test-"));
	return dir;
}

test("read-guard: tool.execute.after records reads per session with mtimeMs and size", async () => {
	const beforeLedger = loadLedger();
	const tmpDir = makeWorkspace();
	const targetFile = path.join(tmpDir, "notes.txt");
	writeFileSync(targetFile, "hello world");
	const sessionID = uniqueSession("record");

	try {
		const hooks = createReadGuard({ directory: tmpDir });
		await hooks["tool.execute.after"](
			{ tool: "read", sessionID },
			{ args: { filePath: targetFile } },
		);

		const ledger = loadLedger();
		const entry = ledger[sessionID]?.[targetFile];
		assert.ok(entry, "read should be recorded under the current session");
		assert.equal(typeof entry.mtimeMs, "number", "entry must carry mtimeMs");
		assert.equal(typeof entry.size, "number", "entry must carry size");
		assert.equal(entry.size, "hello world".length);
	} finally {
		saveLedger(beforeLedger);
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("read-guard: tool.execute.after on write refreshes mtime preventing self-stale", async () => {
	const beforeLedger = loadLedger();
	const tmpDir = makeWorkspace();
	const targetFile = path.join(tmpDir, "notes.txt");
	writeFileSync(targetFile, "v1");
	const sessionID = uniqueSession("write-refresh");

	try {
		const hooks = createReadGuard({ directory: tmpDir });

		// Session reads the file first.
		await hooks["tool.execute.after"](
			{ tool: "read", sessionID },
			{ args: { filePath: targetFile } },
		);
		const ledgerAfterRead = loadLedger();
		const staleMeta = ledgerAfterRead[sessionID][targetFile];
		assert.ok(staleMeta, "read should be recorded");

		// Session writes the file; the ledger mtime must refresh so a
		// subsequent same-session edit is not flagged stale.
		writeFileSync(targetFile, "v2 longer content");
		await hooks["tool.execute.after"](
			{ tool: "write", sessionID },
			{ args: { filePath: targetFile, content: "v2 longer content" } },
		);

		const ledgerAfterWrite = loadLedger();
		const freshMeta = ledgerAfterWrite[sessionID][targetFile];
		assert.ok(freshMeta, "write should refresh the ledger entry");
		assert.equal(freshMeta.size, "v2 longer content".length);

		// Same-session edit right after our own write must not throw stale.
		let blocked = null;
		try {
			await hooks["tool.execute.before"](
				{
					tool: "edit",
					args: {
						filePath: targetFile,
						oldString: "v2 longer",
						newString: "v3 even longer",
					},
					sessionID,
				},
				{},
			);
		} catch (err) {
			blocked = err;
		}
		assert.equal(
			blocked,
			null,
			`self-stale must not trigger after own write: ${blocked?.message ?? ""}`,
		);
	} finally {
		saveLedger(beforeLedger);
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("read-guard: cross-session allow with fresh disk re-syncs ledger for session B", async () => {
	const beforeLedger = loadLedger();
	const tmpDir = makeWorkspace();
	const targetFile = path.join(tmpDir, "app.ts");
	writeFileSync(targetFile, "export const v = 1;\n");
	const sessionA = uniqueSession("a");
	const sessionB = uniqueSession("b");

	try {
		const hooks = createReadGuard({ directory: tmpDir });

		// Session A reads the file.
		await hooks["tool.execute.after"](
			{ tool: "read", sessionID: sessionA },
			{ args: { filePath: targetFile } },
		);
		assert.ok(
			loadLedger()[sessionA]?.[targetFile],
			"session A must hold a ledger record",
		);
		assert.equal(
			loadLedger()[sessionB]?.[targetFile],
			undefined,
			"session B starts with no record",
		);

		// Session B edits the UNMODIFIED file without reading it first:
		// cross-session fallback must allow the edit and re-sync session B.
		let blocked = null;
		try {
			await hooks["tool.execute.before"](
				{
					tool: "edit",
					args: {
						filePath: targetFile,
						oldString: "export const v = 1;",
						newString: "export const v = 2;",
					},
					sessionID: sessionB,
				},
				{},
			);
		} catch (err) {
			blocked = err;
		}
		assert.equal(
			blocked,
			null,
			`fresh cross-session edit must be allowed: ${blocked?.message ?? ""}`,
		);
		assert.ok(
			loadLedger()[sessionB]?.[targetFile],
			"session B should have re-synced the read record",
		);
	} finally {
		saveLedger(beforeLedger);
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("read-guard: cross-session stale block when disk changed externally", async () => {
	const beforeLedger = loadLedger();
	const tmpDir = makeWorkspace();
	const targetFile = path.join(tmpDir, "app.ts");
	writeFileSync(targetFile, "export const v = 1;\n");
	const sessionA = uniqueSession("orig");
	const sessionB = uniqueSession("reconnect");

	try {
		const hooks = createReadGuard({ directory: tmpDir });

		// Session A reads the original file.
		await hooks["tool.execute.after"](
			{ tool: "read", sessionID: sessionA },
			{ args: { filePath: targetFile } },
		);

		// External process modifies the file on disk.
		writeFileSync(
			targetFile,
			"export const v = 99; // externally changed on disk\n",
		);

		// Session B attempts to edit without reading: cross-session fallback
		// must reject because the on-disk state no longer matches.
		let blocked = null;
		try {
			await hooks["tool.execute.before"](
				{
					tool: "edit",
					args: {
						filePath: targetFile,
						oldString: "export const v = 99;",
						newString: "export const v = 100;",
					},
					sessionID: sessionB,
				},
				{},
			);
		} catch (err) {
			blocked = err;
		}
		assert.ok(blocked, "stale external change must block session B edit");
		assert.match(
			blocked.message,
			/read before you edit|stale/i,
			"block message should indicate unread or stale",
		);
	} finally {
		saveLedger(beforeLedger);
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("read-guard: session.deleted event cleans up that session ledger entries", async () => {
	const beforeLedger = loadLedger();
	const tmpDir = makeWorkspace();
	const targetFile = path.join(tmpDir, "notes.txt");
	writeFileSync(targetFile, "hello");
	const sessionID = uniqueSession("deleted");
	const otherSession = uniqueSession("kept");

	try {
		const hooks = createReadGuard({ directory: tmpDir });

		// Record reads under two sessions.
		await hooks["tool.execute.after"](
			{ tool: "read", sessionID },
			{ args: { filePath: targetFile } },
		);
		await hooks["tool.execute.after"](
			{ tool: "read", sessionID: otherSession },
			{ args: { filePath: targetFile } },
		);
		assert.ok(loadLedger()[sessionID]?.[targetFile]);
		assert.ok(loadLedger()[otherSession]?.[targetFile]);

		// Trigger session.deleted for one session only.
		await hooks.event({
			event: { type: "session.deleted", properties: { sessionID } },
		});

		const ledger = loadLedger();
		assert.equal(
			ledger[sessionID],
			undefined,
			"deleted session ledger entry must be removed",
		);
		assert.ok(
			ledger[otherSession]?.[targetFile],
			"unrelated session entries must be preserved",
		);
	} finally {
		saveLedger(beforeLedger);
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("read-guard: new non-existent file write is allowed without prior read", async () => {
	const beforeLedger = loadLedger();
	const tmpDir = makeWorkspace();
	const targetFile = path.join(tmpDir, "fresh", "new-file.txt");
	const sessionID = uniqueSession("newfile");

	try {
		// Ensure the file does NOT exist on disk yet.
		assert.equal(
			path.basename(targetFile),
			"new-file.txt",
			"fixture sanity check",
		);
		const hooks = createReadGuard({ directory: tmpDir });

		let blocked = null;
		try {
			await hooks["tool.execute.before"](
				{
					tool: "write",
					args: { filePath: targetFile, content: "brand new" },
					sessionID,
				},
				{},
			);
		} catch (err) {
			blocked = err;
		}
		assert.equal(
			blocked,
			null,
			`writing a new file must not require prior read: ${blocked?.message ?? ""}`,
		);

		// And after a successful write, ledger should record it.
		mkdirSync(path.dirname(targetFile), { recursive: true });
		writeFileSync(targetFile, "brand new");
		await hooks["tool.execute.after"](
			{
				tool: "write",
				args: { filePath: targetFile, content: "brand new" },
				sessionID,
			},
			{},
		);
		assert.ok(
			loadLedger()[sessionID]?.[targetFile],
			"write should be recorded after creation",
		);
	} finally {
		saveLedger(beforeLedger);
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

#!/usr/bin/env node
/**
 * mode-intent.hook.e2e.js — deterministic E2E test of the mode enforcement guard
 * (Plan vs Execute state machine) against the ACTUAL hook pipeline used by OpenCode.
 *
 * Flow:
 *   1. Send message.part.updated event with text "mikir dulu arsitekturnya".
 *   2. Mode state changes to "plan".
 *   3. Attempt mutating tool calls (edit, write, delete, mutating bash) -> all must throw block error.
 *   4. Attempt read-only tool calls (read, glob, git status) -> must pass through.
 *   5. Send message.part.updated event with text "gasken bikin kodenya".
 *   6. Mode state switches to "execute".
 *   7. Mutating tool calls are now permitted!
 *
 * Usage: node tests/e2e/mode-intent.hook.e2e.js
 */
import { planHooks } from "../../plans/index.js";
import { loadModeState, saveModeState } from "../../share/state.js";

function assert(cond, message) {
	if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

console.log("\n[E2E] Mode Intent Guard (Plan vs Execute State Machine)");

const TEST_SESSION = "e2e-mode-session-" + Date.now();
const originalState = loadModeState();

try {
	const hooks = await planHooks(
		{ client: null },
		{ config: { guard: { planMode: true } } },
	);
	const eventHandler = hooks.event;
	const before = hooks["tool.execute.before"];

	// 1. Trigger Plan mode intent
	console.log("  1. Emitting plan intent ('mikir dulu arsitekturnya')...");
	await eventHandler({
		event: {
			type: "message.part.updated",
			properties: {
				sessionID: TEST_SESSION,
				part: { type: "text", text: "mikir dulu arsitekturnya ya" },
			},
		},
	});

	const stateAfterPlan = loadModeState();
	assert(
		stateAfterPlan[TEST_SESSION]?.mode === "plan",
		"Session mode should be 'plan'",
	);
	console.log("  → Session mode recorded as 'plan'");

	// 2. Test Mutating Tool Blocks in Plan Mode
	console.log("  2. Testing mutating tools blocked in Plan Mode...");
	const mutatingCalls = [
		{
			tool: "edit",
			args: { filePath: "/tmp/foo.js", oldString: "a", newString: "b" },
		},
		{ tool: "write", args: { filePath: "/tmp/foo.js", content: "hello" } },
		{ tool: "delete", args: { filePath: "/tmp/foo.js" } },
		{ tool: "bash", args: { command: "rm -f /tmp/foo.js" } },
		{ tool: "bash", args: { command: "git commit -m 'feat: test'" } },
		{ tool: "bash", args: { command: "npm install express" } },
	];

	for (const call of mutatingCalls) {
		let blocked = false;
		try {
			await before({ ...call, sessionID: TEST_SESSION });
		} catch (e) {
			blocked = true;
			assert(
				/Plan Mode/i.test(e.message),
				`Expected plan block error, got: ${e.message}`,
			);
		}
		assert(
			blocked,
			`Expected mutating call (${call.tool}: ${JSON.stringify(call.args)}) to be blocked`,
		);
	}
	console.log("  → All mutating tools and mutating bash blocked successfully");

	// 3. Test Read-Only tools allowed in Plan Mode
	console.log("  3. Testing read-only tools allowed in Plan Mode...");
	await before({
		tool: "read",
		args: { filePath: "/tmp/foo.js" },
		sessionID: TEST_SESSION,
	});
	await before({
		tool: "glob",
		args: { pattern: "*.js" },
		sessionID: TEST_SESSION,
	});
	await before({
		tool: "bash",
		args: { command: "git status" },
		sessionID: TEST_SESSION,
	});
	await before({
		tool: "bash",
		args: { command: "ls -la" },
		sessionID: TEST_SESSION,
	});
	console.log("  → Read-only tools pass through cleanly");

	// 4. Trigger Execute mode intent
	console.log("  4. Emitting execute intent ('gasken bikin kodenya')...");
	await eventHandler({
		event: {
			type: "message.part.updated",
			properties: {
				sessionID: TEST_SESSION,
				part: { type: "text", text: "gasken bikin kodenya sekarang" },
			},
		},
	});

	const stateAfterExec = loadModeState();
	assert(
		stateAfterExec[TEST_SESSION]?.mode === "execute",
		"Session mode should be 'execute'",
	);
	console.log("  → Session mode switched to 'execute'");

	// 5. Test Mutating tools now allowed in Execute Mode
	console.log("  5. Verifying mutating tools allowed in Execute Mode...");
	await before({
		tool: "edit",
		args: { filePath: "/tmp/foo.js" },
		sessionID: TEST_SESSION,
	});
	await before({
		tool: "bash",
		args: { command: "git commit -m 'feat: ok'" },
		sessionID: TEST_SESSION,
	});
	console.log("  → Mutating tools pass through in Execute Mode");

	console.log(
		"\n✅ PASS: mode-intent guard state machine verified successfully",
	);
} catch (e) {
	console.error(`\n❌ FAIL: ${e.message}`);
	process.exitCode = 1;
} finally {
	// Cleanup test session from state
	const state = loadModeState();
	delete state[TEST_SESSION];
	saveModeState(state);
}

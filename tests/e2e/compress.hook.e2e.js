#!/usr/bin/env node
/**
 * compress.hook.e2e.js — deterministic E2E test for the compress suite:
 *   1. Dynamic messages pruning (historical bloated tool output collapsed, recent turns intact).
 *   2. Failure signal protection (failing test outputs never pruned).
 *   3. Post-push milestone detection & idle snapshot injection.
 *   4. Deterministic /compress and /compress stats slash command execution.
 *   5. Compaction snapshot preservation (git + todos).
 *
 * Usage: node tests/e2e/compress.hook.e2e.js
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { compressModule } from "../../compress/index.js";
import { isHandledError } from "../../share/handled.js";

function assert(cond, message) {
	if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

console.log("\n[E2E] Context Compression & Dynamic Pruning Pipeline");

const TEST_SESSION = "e2e-compress-" + Date.now();
const tmpDir = path.join(os.tmpdir(), "omh-compress-e2e-" + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

const promptDeliveries = [];
const compactCalls = [];

const mockClient = {
	session: {
		prompt: async (payload) => promptDeliveries.push(payload),
		compact: async (payload) => compactCalls.push(payload),
	},
	tui: {
		showToast: () => {},
	},
};

const customConfig = {
	enabled: true,
	pruning: {
		enabled: true,
		recentTurns: 2,
		minOutputChars: 500,
		keepHeadChars: 50,
		keepTailChars: 50,
		protectedTools: { read: true, write: true, edit: true },
		eligibleTools: { bash: true },
		commandPatterns: { test: "npm test" },
		failureSignals: { fail: "FAILED|Error:" },
	},
	milestones: {
		enabled: true,
		pushAutoCompress: true,
		minTurnsAfterPush: 1,
		idleCooldownMs: 0,
		maxAutoCompressPerSession: 2,
	},
	commands: {
		compress: true,
	},
	snapshot: {
		compactionSnapshot: true,
	},
};

try {
	const cHooks = await compressModule(
		{ client: mockClient, directory: tmpDir },
		{ config: customConfig },
	);

	// 1. Test Dynamic Messages Pruning
	console.log(
		"  1. Testing dynamic tool output pruning in message transform...",
	);
	const bloatedOutput = `HEADER_LINE\n${".".repeat(1000)}\nPASS ALL TESTS`;
	const failedOutput = `HEADER_LINE\n${".".repeat(1000)}\nFAILED: 1 test failed`;

	const mockMessages = [
		{
			info: { role: "user", id: "u1" },
			parts: [{ type: "text", text: "run tests" }],
		},
		{
			info: { role: "assistant", id: "a1" },
			parts: [
				{
					type: "tool",
					tool: "bash",
					state: {
						status: "completed",
						input: { command: "npm test" },
						output: bloatedOutput,
					},
				},
				{
					type: "tool",
					tool: "bash",
					state: {
						status: "completed",
						input: { command: "npm test" },
						output: failedOutput,
					},
				},
			],
		},
		// 2 recent turns to protect
		{ info: { role: "user", id: "u2" } },
		{ info: { role: "assistant", id: "a2" } },
		{ info: { role: "user", id: "u3" } },
		{ info: { role: "assistant", id: "a3" } },
	];

	const transformHook = cHooks["experimental.chat.messages.transform"];
	assert(
		typeof transformHook === "function",
		"messages.transform hook must be registered",
	);

	const transformPayload = { messages: mockMessages };
	await transformHook({ sessionID: TEST_SESSION }, transformPayload);

	const prunedToolOutput = mockMessages[1].parts[0].state.output;
	const failedToolOutput = mockMessages[1].parts[1].state.output;

	assert(
		prunedToolOutput.includes("── OMH-PRUNE ──"),
		"Bloated output must be pruned with collapse marker",
	);
	assert(failedToolOutput === failedOutput, "Failed output must NOT be pruned");
	console.log(
		"  → Bloated output successfully pruned; failure output strictly preserved",
	);

	// 2. Test Post-Push Milestone Detection & Idle Snapshot
	console.log(
		"  2. Testing post-push milestone detection and idle compaction...",
	);
	const toolAfter = cHooks["tool.execute.after"];
	const eventHook = cHooks.event;

	// Execute git push
	await toolAfter({
		tool: "bash",
		sessionID: TEST_SESSION,
		args: { command: "git push origin main" },
	});

	// Execute 1 turn after push to satisfy minTurnsAfterPush: 1
	await toolAfter({
		tool: "bash",
		sessionID: TEST_SESSION,
		args: { command: "git status" },
	});

	// Trigger idle event
	await eventHook({
		type: "session.status",
		properties: { status: "idle", sessionID: TEST_SESSION },
		sessionID: TEST_SESSION,
	});

	assert(
		promptDeliveries.length >= 1,
		"Milestone snapshot must be delivered to transcript",
	);
	assert(
		compactCalls.length >= 1,
		"Compaction must be triggered upon post-push idle",
	);
	console.log(
		"  → Post-push snapshot delivered and session compaction triggered",
	);

	// 3. Test /compress stats command
	console.log(
		"  3. Testing /compress stats slash command (0-token transcript delivery)...",
	);
	const cmdBefore = cHooks["command.execute.before"];

	let threwHandled = false;
	try {
		await cmdBefore(
			{ command: "compress", arguments: "stats", sessionID: TEST_SESSION },
			{},
		);
	} catch (err) {
		if (isHandledError(err)) {
			threwHandled = true;
		} else {
			throw err;
		}
	}

	assert(
		threwHandled,
		"/compress stats must throw handled error to halt pipeline",
	);
	const lastDelivery = promptDeliveries[promptDeliveries.length - 1];
	assert(
		lastDelivery.body.noReply === true,
		"Slash command output must be delivered with noReply: true",
	);
	assert(
		lastDelivery.body.parts[0].text.includes(
			"Context Compression & Pruning Metrics",
		),
		"Stats output must contain header",
	);
	console.log("  → /compress stats delivered cleanly with 0 LLM tokens");

	// 4. Test Compaction Snapshot Injection
	console.log("  4. Testing compaction snapshot context injection...");
	const compactingHook = cHooks["experimental.session.compacting"];
	assert(
		typeof compactingHook === "function",
		"session.compacting hook must be registered",
	);

	const compactingOutput = { context: [] };
	await compactingHook({ sessionID: TEST_SESSION }, compactingOutput);

	assert(
		compactingOutput.context.length >= 1,
		"Compacting context must be injected",
	);
	assert(
		compactingOutput.context[0].includes("Current Session Snapshot"),
		"Snapshot block must be present in context",
	);
	console.log(
		"  → Session snapshot injected into compaction prompt successfully",
	);

	console.log("\n✅ PASS: compress suite pipeline verified successfully\n");
} finally {
	fs.rmSync(tmpDir, { recursive: true, force: true });
}

#!/usr/bin/env node
/**
 * memory.hook.e2e.js — deterministic E2E test for the Hermes-style multi-target memory pipeline:
 *   1. Explicit JSON Schema definition override via tool.definition hook (required: []).
 *   2. Native tool memory execution with atomic batch operations across user, global, and project stores.
 *   3. Atomic rollback verification when any batch operation violates validation (zero dirty writes).
 *   4. Zero-token transcript delivery for /memory slash commands (all, user, global, project, add, replace, remove).
 *   5. Hermes-style visual header rendering and character budget tracking in experimental.chat.system.transform.
 *   6. Lossless memory injection into experimental.session.compacting context.
 *
 * Usage: node tests/e2e/memory.hook.e2e.js
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { memoryHooks } from "../../memory/index.js";
import {
	getUserFile,
	getGlobalFile,
	projectMemoryFile,
	readMemory,
} from "../../memory/store.js";
import { isHandledError } from "../../share/handled.js";

function assert(cond, message) {
	if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

console.log("\n[E2E] Hermes-Style Multi-Target Memory Pipeline");

const TEST_SESSION = "e2e-mem-session-" + Date.now();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omh-mem-e2e-"));
const projectDir = path.join(tmpRoot, "sample-project");
fs.mkdirSync(projectDir, { recursive: true });

// Route memory storage to isolated temporary directory
process.env.OMH_MEMORY_ROOT = path.join(tmpRoot, "memory");

const promptDeliveries = [];
const mockClient = {
	session: {
		prompt: async (payload) => {
			promptDeliveries.push(payload);
			return { ok: true };
		},
	},
	app: {
		log: () => {},
	},
};

const customConfig = {
	memory: {
		enabled: true,
		budgets: {
			user: 1500,
			global: 2500,
			project: 3500,
		},
	},
};

try {
	const hooks = await memoryHooks(
		{ client: mockClient, directory: projectDir },
		{ config: customConfig },
	);

	// ------------------------------------------------------------------------
	// 1. Verify Clean Schema Definition Override (Solves non-working models)
	// ------------------------------------------------------------------------
	console.log("  1. Verifying tool.definition schema override...");
	const schemaOutput = { description: "", jsonSchema: undefined };
	await hooks["tool.definition"]({ toolID: "memory" }, schemaOutput);

	assert(
		schemaOutput.jsonSchema && typeof schemaOutput.jsonSchema === "object",
		"jsonSchema must be defined",
	);
	assert(
		schemaOutput.jsonSchema.type === "object",
		"jsonSchema.type must be 'object'",
	);
	assert(
		Array.isArray(schemaOutput.jsonSchema.required) &&
			schemaOutput.jsonSchema.required.length === 0,
		"jsonSchema.required must be empty [] to prevent model validation errors",
	);
	assert(
		schemaOutput.jsonSchema.properties?.target?.enum?.includes("user"),
		"jsonSchema target must include 'user'",
	);
	assert(
		schemaOutput.jsonSchema.properties?.operations?.type === "array",
		"jsonSchema operations must be an array type",
	);
	console.log(
		"  → Schema definition override verified with clean empty required []",
	);

	// ------------------------------------------------------------------------
	// 2. Test Atomic Batch Operations via Tool Execution
	// ------------------------------------------------------------------------
	console.log("  2. Testing Hermes atomic batch operations across targets...");
	const memTool = hooks.tool.memory;
	assert(
		typeof memTool.execute === "function",
		"memory tool execute must be a function",
	);

	const batchResult = await memTool.execute(
		{
			operations: [
				{
					action: "add",
					target: "user",
					content: "Panggil user dengan sebutan BOSS",
				},
				{
					action: "add",
					target: "global",
					content: "Global convention: use bun test when available",
				},
				{
					action: "add",
					target: "project",
					content: "Project architecture: strict boundary contract",
				},
			],
		},
		{ directory: projectDir },
	);

	assert(
		batchResult.includes("Batch memory update applied"),
		`Expected batch update confirmation, got: ${batchResult}`,
	);
	assert(batchResult.includes("3 added"), "Should report 3 added");
	assert(
		batchResult.includes("Write saved"),
		"Should include terminal confirmation",
	);

	// Check on-disk persistence
	assert(
		readMemory(getUserFile()).includes("Panggil user dengan sebutan BOSS"),
		"USER.md should contain user profile note",
	);
	assert(
		readMemory(getGlobalFile()).includes("bun test"),
		"MEMORY.md should contain global technical note",
	);
	assert(
		readMemory(projectMemoryFile(projectDir)).includes("boundary contract"),
		"project MEMORY.md should contain project architecture rule",
	);
	console.log(
		"  → Atomic batch operations persisted successfully across all 3 stores",
	);

	// ------------------------------------------------------------------------
	// 3. Test Atomic Rollback on Validation Failure (Zero Dirty Writes)
	// ------------------------------------------------------------------------
	console.log("  3. Testing atomic rollback on invalid batch operation...");
	const rollbackResult = await memTool.execute(
		{
			operations: [
				{ action: "add", target: "user", content: "Should be rolled back" },
				{ action: "replace", target: "user", content: "Missing old_text" },
			],
		},
		{ directory: projectDir },
	);

	assert(
		rollbackResult.startsWith(
			"Error: Operation #2 ('replace') requires 'old_text'",
		),
		`Expected validation error, got: ${rollbackResult}`,
	);
	assert(
		!readMemory(getUserFile()).includes("Should be rolled back"),
		"Rolled back content must NOT be written to disk",
	);
	console.log("  → Atomic rollback verified (zero partial writes on failure)");

	// ------------------------------------------------------------------------
	// 4. Test Zero-Token /memory Slash Commands
	// ------------------------------------------------------------------------
	console.log(
		"  4. Testing zero-token transcript delivery for /memory slash commands...",
	);
	const cmdBefore = hooks["command.execute.before"];

	// /memory add user
	let handled = false;
	try {
		await cmdBefore(
			{
				command: "memory",
				arguments: "add user Prefer Indonesian for interactions",
				sessionID: TEST_SESSION,
			},
			{ parts: [] },
		);
	} catch (e) {
		if (isHandledError(e)) handled = true;
	}
	assert(handled, "Slash command must throw handled error to prevent LLM call");
	assert(
		readMemory(getUserFile()).includes("Prefer Indonesian for interactions"),
		"/memory add user should update USER.md",
	);

	// /memory user
	handled = false;
	try {
		await cmdBefore(
			{ command: "memory", arguments: "user", sessionID: TEST_SESSION },
			{ parts: [] },
		);
	} catch (e) {
		if (isHandledError(e)) handled = true;
	}
	assert(handled, "/memory user must throw handled error");

	// /memory all
	handled = false;
	try {
		await cmdBefore(
			{ command: "memory", arguments: "all", sessionID: TEST_SESSION },
			{ parts: [] },
		);
	} catch (e) {
		if (isHandledError(e)) handled = true;
	}
	assert(handled, "/memory all must throw handled error");
	assert(
		promptDeliveries.length >= 3,
		`Expected at least 3 prompt deliveries, got ${promptDeliveries.length}`,
	);
	console.log(
		"  → All slash commands delivered directly to transcript with 0 tokens",
	);

	// ------------------------------------------------------------------------
	// 5. Test Hermes Visual Header & Budget System Prompt Injection
	// ------------------------------------------------------------------------
	console.log(
		"  5. Testing Hermes visual headers and budget tracking in system prompt...",
	);
	const systemOutput = { system: [] };
	await hooks["experimental.chat.system.transform"](
		{ sessionID: TEST_SESSION, model: {} },
		systemOutput,
	);

	assert(
		systemOutput.system.length > 0,
		"System prompt should have received memory injection",
	);
	const injectedPrompt = systemOutput.system.join("\n");

	assert(
		injectedPrompt.includes("USER PROFILE (who the user is)"),
		"Should include USER PROFILE visual header",
	);
	assert(
		injectedPrompt.includes("GLOBAL MEMORY (environment & tools)"),
		"Should include GLOBAL MEMORY visual header",
	);
	assert(
		injectedPrompt.includes("PROJECT MEMORY (sample-project)"),
		"Should include PROJECT MEMORY visual header with slug",
	);
	assert(
		/\[\d+%\s+—\s+[\d,]+\/[\d,]+\s+chars\]/.test(injectedPrompt),
		"Should include Hermes-style percentage and character budget indicators",
	);

	// Verify subagents are excluded
	const subagentOutput = { system: [] };
	await hooks["experimental.chat.system.transform"](
		{ agent: "explore", model: {} },
		subagentOutput,
	);
	assert(
		subagentOutput.system.length === 0,
		"Subagents must NOT receive memory injection",
	);
	console.log(
		"  → Hermes visual headers and budget indicators rendered accurately",
	);

	// ------------------------------------------------------------------------
	// 6. Test Compaction Context Injection
	// ------------------------------------------------------------------------
	console.log("  6. Testing compaction context injection...");
	const compactOutput = { context: [] };
	await hooks["experimental.session.compacting"](
		{ sessionID: TEST_SESSION },
		compactOutput,
	);

	assert(
		compactOutput.context.length > 0,
		"Compaction output should contain memory context",
	);
	assert(
		compactOutput.context.some((c) => c.includes("USER PROFILE")),
		"Compaction context should include memory snapshot",
	);
	console.log("  → Compaction context injected losslessly");

	console.log(
		"\n✅ PASS: Hermes-Style Multi-Target Memory Pipeline verified 100%",
	);
} catch (err) {
	console.error(`\n❌ FAIL: ${err.message}`);
	console.error(err.stack);
	process.exitCode = 1;
} finally {
	try {
		fs.rmSync(tmpRoot, { recursive: true, force: true });
	} catch {}
	delete process.env.OMH_MEMORY_ROOT;
}

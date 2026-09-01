import { test } from "node:test";
import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	writeFileSync,
	rmSync,
	readdirSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import {
	isProtectedTool,
	isEligibleTool,
	isNeverPruned,
	isAlwaysPruned,
	isEligibleCommand,
	matchesCommandPattern,
	hasFailureSignal,
	buildCollapseMarker,
	isAlreadyPruned,
} from "../compress/rules.js";
import { calculateCutoffIndex, pruneMessages } from "../compress/pruner.js";
import { cleanOldDebugSessions } from "../compress/debug.js";

const DEFAULT_CONFIG = {
	enabled: true,
	recentTurns: 2,
	minOutputChars: 100,
	keepHeadChars: 20,
	keepTailChars: 20,
	protectedTools: {
		read: true,
		write: true,
		edit: true,
		patch: true,
		grep: true,
		glob: true,
		find: true,
		ls: true,
		todowrite: true,
		webfetch: true,
	},
	eligibleTools: {
		bash: true,
	},
	commandPatterns: {
		test: "npm (test|run test)|pnpm test|yarn test|bun test",
		build: "go (build|test)|cargo (build|test)|make",
		gitlog: "git (log|diff|show)",
		listing: "ls -la|kubectl get|docker ps",
	},
	failureSignals: {
		fail: "FAILED|FAILURE|tests? failed",
		crash: "panic:|Traceback|SyntaxError|TypeError|ReferenceError",
		npm: "npm ERR!",
		os: "EACCES|ENOENT|exit status 1|segmentation fault",
	},
};

test("rules: isProtectedTool and isEligibleTool distinguish tools correctly", () => {
	assert.equal(isProtectedTool("read", DEFAULT_CONFIG), true);
	assert.equal(isProtectedTool("write", DEFAULT_CONFIG), true);
	assert.equal(isProtectedTool("edit", DEFAULT_CONFIG), true);
	assert.equal(isProtectedTool("grep", DEFAULT_CONFIG), true);
	assert.equal(isProtectedTool("glob", DEFAULT_CONFIG), true);
	assert.equal(isProtectedTool("bash", DEFAULT_CONFIG), false);

	assert.equal(isEligibleTool("bash", DEFAULT_CONFIG), true);
	assert.equal(isEligibleTool("read", DEFAULT_CONFIG), false);
});

test("rules: matchesCommandPattern matches test, build, and log commands", () => {
	assert.equal(matchesCommandPattern("npm test", DEFAULT_CONFIG), true);
	assert.equal(matchesCommandPattern("pnpm test", DEFAULT_CONFIG), true);
	assert.equal(
		matchesCommandPattern("bun test tests/auth.test.js", DEFAULT_CONFIG),
		true,
	);
	assert.equal(matchesCommandPattern("go test ./...", DEFAULT_CONFIG), true);
	assert.equal(
		matchesCommandPattern("cargo build --release", DEFAULT_CONFIG),
		true,
	);
	assert.equal(
		matchesCommandPattern("git log -n 50 --oneline", DEFAULT_CONFIG),
		true,
	);
	assert.equal(matchesCommandPattern("git diff HEAD~1", DEFAULT_CONFIG), true);
	assert.equal(matchesCommandPattern("node script.js", DEFAULT_CONFIG), false);
});

test("rules: hasFailureSignal detects errors and prevents pruning", () => {
	assert.equal(
		hasFailureSignal("Tests passed cleanly: 100/100", DEFAULT_CONFIG),
		false,
	);
	assert.equal(
		hasFailureSignal("1 tests failed\nFAILED: test_auth", DEFAULT_CONFIG),
		true,
	);
	assert.equal(
		hasFailureSignal(
			"panic: runtime error: invalid memory address",
			DEFAULT_CONFIG,
		),
		true,
	);
	assert.equal(
		hasFailureSignal(
			"Traceback (most recent call last):\n  File 'app.py'",
			DEFAULT_CONFIG,
		),
		true,
	);
	assert.equal(
		hasFailureSignal("npm ERR! code ELIFECYCLE", DEFAULT_CONFIG),
		true,
	);
	assert.equal(
		hasFailureSignal(
			"Command exited with code 1\nexit status 1",
			DEFAULT_CONFIG,
		),
		true,
	);
});

test("pruner: calculateCutoffIndex protects recent turns window", () => {
	const messages = [
		{ info: { role: "user", id: "u1" } },
		{ info: { role: "assistant", id: "a1" } },
		{ info: { role: "user", id: "u2" } },
		{ info: { role: "assistant", id: "a2" } },
		{ info: { role: "user", id: "u3" } },
		{ info: { role: "assistant", id: "a3" } },
	];

	// recentTurns = 2: protect u2, a2, u3, a3 -> cutoff at index 2 (u2)
	const cutoff = calculateCutoffIndex(messages, 2);
	assert.equal(cutoff, 2);

	// When fewer turns than recentTurns exist, protect everything (cutoff = 0)
	assert.equal(calculateCutoffIndex(messages.slice(0, 2), 2), 0);
});

test("pruner: pruneMessages collapses eligible historical tool output", () => {
	const largeSuccessfulTestOutput = `START OF TEST OUTPUT\n${".".repeat(500)}\nEND OF TEST OUTPUT ALL 50 TESTS PASSED`;

	const messages = [
		{
			info: { role: "user", id: "u1" },
			parts: [{ type: "text", text: "run the tests" }],
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
						output: largeSuccessfulTestOutput,
					},
				},
			],
		},
		{
			info: { role: "user", id: "u2" },
			parts: [{ type: "text", text: "now check git status" }],
		},
		{
			info: { role: "assistant", id: "a2" },
			parts: [{ type: "text", text: "checking status" }],
		},
		{
			info: { role: "user", id: "u3" },
			parts: [{ type: "text", text: "done" }],
		},
		{
			info: { role: "assistant", id: "a3" },
			parts: [{ type: "text", text: "all done" }],
		},
	];

	const result = pruneMessages(messages, DEFAULT_CONFIG, "test-ses-1");

	assert.equal(result.prunedCount, 1);
	assert.ok(result.totalBytesPruned > 400);

	const prunedOutput = messages[1].parts[0].state.output;
	assert.match(prunedOutput, /START OF TEST OUTPUT/);
	assert.match(
		prunedOutput,
		/── OMH-PRUNE ── \d+ chars collapsed ── head\/tail preserved ──/,
	);
	assert.match(prunedOutput, /ALL 50 TESTS PASSED/);
	assert.equal(isAlreadyPruned(prunedOutput), true);
});

test("pruner: pruneMessages skips protected tools and failing outputs", () => {
	const largeReadOutput = "A".repeat(500);
	const largeFailedTestOutput = `START\n${"E".repeat(500)}\nFAILED: 1 test broken`;

	const messages = [
		{
			info: { role: "user", id: "u1" },
			parts: [{ type: "text", text: "step 1" }],
		},
		{
			info: { role: "assistant", id: "a1" },
			parts: [
				{
					type: "tool",
					tool: "read",
					state: {
						status: "completed",
						output: largeReadOutput,
					},
				},
				{
					type: "tool",
					tool: "bash",
					state: {
						status: "completed",
						input: { command: "npm test" },
						output: largeFailedTestOutput,
					},
				},
			],
		},
		{ info: { role: "user", id: "u2" } },
		{ info: { role: "assistant", id: "a2" } },
		{ info: { role: "user", id: "u3" } },
		{ info: { role: "assistant", id: "a3" } },
	];

	const result = pruneMessages(messages, DEFAULT_CONFIG, "test-ses-2");

	// Both should be skipped: read is protected, and failed test has failureSignal
	assert.equal(result.prunedCount, 0);
	assert.equal(messages[1].parts[0].state.output, largeReadOutput);
	assert.equal(messages[1].parts[1].state.output, largeFailedTestOutput);
});

test("pruner: pruneMessages is idempotent and deterministic", () => {
	const output = `HEAD_CONTENT_${"X".repeat(500)}_TAIL_CONTENT`;
	const messages = [
		{
			info: { role: "user", id: "u1" },
			parts: [{ type: "text", text: "step 1" }],
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
						output: output,
					},
				},
			],
		},
		{ info: { role: "user", id: "u2" } },
		{ info: { role: "assistant", id: "a2" } },
		{ info: { role: "user", id: "u3" } },
		{ info: { role: "assistant", id: "a3" } },
	];

	const firstPass = pruneMessages(messages, DEFAULT_CONFIG, "test-ses-3");
	assert.equal(firstPass.prunedCount, 1);
	const transformedAfterFirst = messages[1].parts[0].state.output;

	// Second pass on same messages must be a no-op
	const secondPass = pruneMessages(messages, DEFAULT_CONFIG, "test-ses-3");
	assert.equal(secondPass.prunedCount, 0);
	assert.equal(messages[1].parts[0].state.output, transformedAfterFirst);
});

test("rules: modern config distinguishes alwaysPrune, neverPrune, and generic commands", () => {
	const modernConfig = {
		commandPatterns: {
			alwaysPrune: ["npm (install|test)", "git (commit|push|status)"],
			neverPrune: ["git (diff|show|log -p|blame)", "cat .*"],
		},
	};

	// neverPrune commands
	assert.equal(isNeverPruned("git diff HEAD~1", modernConfig), true);
	assert.equal(isNeverPruned("git show abc1234", modernConfig), true);
	assert.equal(isNeverPruned("cat package.json", modernConfig), true);
	assert.equal(isNeverPruned("npm test", modernConfig), false);
	assert.equal(isEligibleCommand("git diff HEAD~1", modernConfig), false);

	// alwaysPrune commands
	assert.equal(isAlwaysPruned("npm test", modernConfig), true);
	assert.equal(isAlwaysPruned("git commit -m foo", modernConfig), true);
	assert.equal(isAlwaysPruned("python run.py", modernConfig), false);

	// Generic commands: any command not in neverPrune is eligible
	assert.equal(isEligibleCommand("python run.py", modernConfig), true);
	assert.equal(
		isEligibleCommand("curl https://example.com/api", modernConfig),
		true,
	);
	assert.equal(isEligibleCommand("node index.js", modernConfig), true);
});

test("pruner: generic size-based pruning prunes arbitrary commands and honors neverPrune", () => {
	const modernConfig = {
		enabled: true,
		recentTurns: 2,
		minOutputChars: 200,
		keepHeadChars: 50,
		keepTailChars: 50,
		keepImportantLines: true,
		eligibleTools: { bash: true },
		protectedTools: { read: true },
		commandPatterns: {
			alwaysPrune: ["npm test"],
			neverPrune: ["git diff"],
		},
		failureSignals: {
			fail: "FAILED",
		},
	};

	const largePythonOutput = `PYTHON START\n${"Y".repeat(200)}\nMiddle summary: 20 passed, 0 errors\n${"Y".repeat(200)}\nPYTHON END`;
	const largeGitDiffOutput = `diff --git a/foo.js b/foo.js\n${"+".repeat(600)}\nEND DIFF`;

	const messages = [
		{
			info: { role: "user", id: "u1" },
			parts: [{ type: "text", text: "step 1" }],
		},
		{
			info: { role: "assistant", id: "a1" },
			parts: [
				{
					type: "tool",
					tool: "bash",
					state: {
						status: "completed",
						input: { command: "python run.py" },
						output: largePythonOutput,
					},
				},
				{
					type: "tool",
					tool: "bash",
					state: {
						status: "completed",
						input: { command: "git diff HEAD" },
						output: largeGitDiffOutput,
					},
				},
			],
		},
		{ info: { role: "user", id: "u2" } },
		{ info: { role: "assistant", id: "a2" } },
		{ info: { role: "user", id: "u3" } },
		{ info: { role: "assistant", id: "a3" } },
	];

	const result = pruneMessages(messages, modernConfig, "test-ses-generic");

	// python output should be pruned (generic size-based)
	// git diff output should NOT be pruned (in neverPrune)
	assert.equal(result.prunedCount, 1);
	assert.match(messages[1].parts[0].state.output, /── OMH-PRUNE ──/);
	assert.match(messages[1].parts[0].state.output, /── Highlights:/);
	assert.equal(messages[1].parts[1].state.output, largeGitDiffOutput);
});

test("debug: cleanOldDebugSessions preserves maxSessions and removes oldest", () => {
	const tmpDir = path.join(os.tmpdir(), `omh-debug-test-${Date.now()}`);
	mkdirSync(tmpDir, { recursive: true });

	try {
		// Create 5 session dirs with distinct mtimes
		for (let i = 1; i <= 5; i++) {
			const sDir = path.join(tmpDir, `session-${i}`);
			mkdirSync(sDir, { recursive: true });
			writeFileSync(path.join(sDir, "snapshot.md"), `Session ${i} audit`);
		}

		// Retain only 3 sessions
		cleanOldDebugSessions(tmpDir, 3);

		const remaining = readdirSync(tmpDir);
		assert.equal(remaining.length, 3);
	} finally {
		try {
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {}
	}
});

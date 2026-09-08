import { test } from "node:test";
import assert from "node:assert/strict";
import {
	isGitPushCommand,
	buildMilestoneSnapshot,
	automationHooks,
	_resetAutomationState,
	_getAutomationMapSizes,
} from "../compress/automation.js";

test("automation: isGitPushCommand identifies push commands and filters dry-runs", () => {
	assert.equal(isGitPushCommand("git push"), true);
	assert.equal(isGitPushCommand("git push origin main"), true);
	assert.equal(isGitPushCommand("git push -u origin dev"), true);
	assert.equal(isGitPushCommand("git push --force origin main"), true);

	assert.equal(isGitPushCommand("git push --dry-run origin main"), false);
	assert.equal(isGitPushCommand("git pull origin main"), false);
	assert.equal(isGitPushCommand("git commit -m 'push changes'"), false);
	assert.equal(isGitPushCommand(""), false);
});

test("automation: buildMilestoneSnapshot produces clean string format", () => {
	const snapshot = buildMilestoneSnapshot(process.cwd(), 1000);
	assert.match(snapshot, /── MILESTONE SNAPSHOT/);
	assert.match(snapshot, /Branch:/);
	assert.ok(snapshot.length <= 1050);
});

test("automation: automationHooks executes milestone snapshot and compact on idle", async () => {
	const calls = [];
	const mockClient = {
		session: {
			prompt: async (payload) => {
				calls.push({ type: "prompt", payload });
			},
			compact: async (payload) => {
				calls.push({ type: "compact", payload });
			},
		},
		tui: {
			showToast: () => {},
		},
	};

	const hooks = await automationHooks(
		{ client: mockClient, directory: process.cwd() },
		{
			config: {
				milestones: {
					enabled: true,
					pushAutoCompress: true,
					minTurnsAfterPush: 1,
					idleCooldownMs: 1000,
					maxAutoCompressPerSession: 2,
				},
			},
		},
	);

	const sessionID = "ses-auto-test-1";

	// 1. Execute git push
	await hooks["tool.execute.after"]({
		tool: "bash",
		sessionID,
		args: { command: "git push origin dev" },
	});

	// 2. Execute 1 subsequent turn to satisfy minTurnsAfterPush
	await hooks["tool.execute.after"]({
		tool: "bash",
		sessionID,
		args: { command: "git status" },
	});

	// 3. Emit idle event
	await hooks.event({
		type: "session.status",
		properties: { status: "idle", sessionID },
		sessionID,
	});

	assert.equal(calls.length, 2);
	assert.equal(calls[0].type, "prompt");
	assert.equal(calls[0].payload.body.noReply, true);
	assert.equal(calls[1].type, "compact");
	assert.equal(calls[1].payload.path.sessionID, sessionID);
});

test("automation: respects maxAutoCompressPerSession", async () => {
	const calls = [];
	const mockClient = {
		session: {
			prompt: async () => calls.push("prompt"),
			compact: async () => calls.push("compact"),
		},
	};

	const hooks = await automationHooks(
		{ client: mockClient, directory: process.cwd() },
		{
			config: {
				milestones: {
					enabled: true,
					pushAutoCompress: true,
					minTurnsAfterPush: 0,
					idleCooldownMs: 0,
					maxAutoCompressPerSession: 1,
				},
			},
		},
	);

	const sessionID = "ses-auto-test-2";

	// First push & idle
	await hooks["tool.execute.after"]({
		tool: "bash",
		sessionID,
		args: { command: "git push" },
	});
	await hooks.event({
		type: "session.status",
		properties: { status: "idle", sessionID },
	});
	assert.equal(calls.length, 2); // 1 prompt + 1 compact

	// Second push & idle -> should be blocked by maxAutoCompressPerSession: 1
	await hooks["tool.execute.after"]({
		tool: "bash",
		sessionID,
		args: { command: "git push" },
	});
	await hooks.event({
		type: "session.status",
		properties: { status: "idle", sessionID },
	});
	assert.equal(calls.length, 2); // No new calls
});

test("automation: session.deleted event purges state from memory maps", async () => {
	_resetAutomationState();
	const hooks = await automationHooks(
		{ client: {}, directory: process.cwd() },
		{ config: { milestones: { enabled: true, pushAutoCompress: true } } },
	);

	const sessionID = "ses-delete-purge-test";

	// 1. Register push
	await hooks["tool.execute.after"]({
		tool: "bash",
		sessionID,
		args: { command: "git push" },
	});

	let sizes = _getAutomationMapSizes();
	assert.equal(sizes.pushMilestones, 1);

	// 2. Fire session.deleted event
	await hooks.event({
		type: "session.deleted",
		properties: { sessionID },
		sessionID,
	});

	sizes = _getAutomationMapSizes();
	assert.equal(sizes.pushMilestones, 0);
	assert.equal(sizes.sessionAutoCompactState, 0);
});

test("automation: module-level Maps evict oldest session when exceeding cap", async () => {
	_resetAutomationState();
	const hooks = await automationHooks(
		{ client: {}, directory: process.cwd() },
		{ config: { milestones: { enabled: true, pushAutoCompress: true } } },
	);

	// Insert 105 sessions sequentially (cap is 100)
	for (let i = 0; i < 105; i++) {
		await hooks["tool.execute.after"]({
			tool: "bash",
			sessionID: `ses-cap-${i}`,
			args: { command: "git push" },
		});
	}

	const sizes = _getAutomationMapSizes();
	assert.equal(sizes.pushMilestones, 100);
});

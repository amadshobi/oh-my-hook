import { test } from "node:test";
import assert from "node:assert/strict";
import {
	formatCompressStats,
	formatCompressHelp,
	commandHooks,
} from "../compress/commands.js";
import { isHandledError } from "../share/handled.js";

test("commands: formatCompressStats renders markdown without throwing", () => {
	const stats = formatCompressStats("test-ses-stats");
	assert.match(stats, /## Context Compression & Pruning Metrics/);
	assert.match(stats, /Current Session:/);
	assert.match(stats, /Global Aggregate/);
});

test("commands: formatCompressHelp renders usage guide", () => {
	const help = formatCompressHelp();
	assert.match(help, /\/compress/);
	assert.match(help, /\/compress stats/);
});

test("commands: commandHooks registers /compress command in config", async () => {
	const hooks = await commandHooks(
		{},
		{ config: { commands: { compress: true } } },
	);
	const config = {};
	await hooks.config(config);

	assert.ok(config.command.compress);
	assert.equal(config.command.compress.template, "/compress $ARGUMENTS");
});

test("commands: /compress stats delivers text and throws handled error", async () => {
	const calls = [];
	const mockClient = {
		session: {
			prompt: async (payload) => {
				calls.push(payload);
			},
		},
	};

	const hooks = await commandHooks(
		{ client: mockClient },
		{ config: { commands: { compress: true } } },
	);

	const input = {
		command: "compress",
		arguments: "stats",
		sessionID: "ses-cmd-1",
	};

	let threwHandled = false;
	try {
		await hooks["command.execute.before"](input, {});
	} catch (err) {
		if (isHandledError(err)) {
			threwHandled = true;
		} else {
			throw err;
		}
	}

	assert.equal(threwHandled, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].path.id, "ses-cmd-1");
	assert.equal(calls[0].body.noReply, true);
	assert.match(
		calls[0].body.parts[0].text,
		/## Context Compression & Pruning Metrics/,
	);
});

test("commands: /compress triggers compact and throws handled error", async () => {
	const promptCalls = [];
	const compactCalls = [];
	const mockClient = {
		session: {
			prompt: async (payload) => promptCalls.push(payload),
			compact: async (payload) => compactCalls.push(payload),
		},
	};

	const hooks = await commandHooks(
		{ client: mockClient },
		{ config: { commands: { compress: true } } },
	);

	const input = {
		command: "compress",
		arguments: "",
		sessionID: "ses-cmd-2",
	};

	let threwHandled = false;
	try {
		await hooks["command.execute.before"](input, {});
	} catch (err) {
		if (isHandledError(err)) {
			threwHandled = true;
		} else {
			throw err;
		}
	}

	assert.equal(threwHandled, true);
	assert.equal(compactCalls.length, 1);
	assert.equal(compactCalls[0].path.sessionID, "ses-cmd-2");
	assert.equal(promptCalls.length, 1);
	assert.match(promptCalls[0].body.parts[0].text, /Context Compaction/);
});

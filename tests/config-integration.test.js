import test from "node:test";
import assert from "node:assert/strict";
import { sandboxHooks } from "../sandbox/index.js";
import { planHooks } from "../plans/index.js";

test("sandbox respects disabled dangerousBash flag", async () => {
	const hooks = await sandboxHooks(
		{ client: null },
		{ config: { sandbox: { dangerousBash: false } } },
	);
	const before = hooks["tool.execute.before"];

	// Should NOT throw because dangerousBash is disabled
	await assert.doesNotReject(() =>
		before({ tool: "bash", args: { command: "rm -rf /" } }, {}),
	);
});

test("sandbox respects disabled secretScanner flag", async () => {
	const hooks = await sandboxHooks(
		{ client: null },
		{ config: { sandbox: { secretScanner: false } } },
	);
	const before = hooks["tool.execute.before"];

	// Should NOT throw because secretScanner is disabled
	await assert.doesNotReject(() =>
		before(
			{
				tool: "write",
				args: {
					filePath: "/tmp/secret.js",
					content:
						'const key = "ghp_' +
						"abcdefghijklmnopqrstuvwxyz1234567890ABCD" +
						'";',
				},
			},
			{},
		),
	);
});

test("memory commands not registered when memory.enabled is false", async () => {
	const { memoryHooks } = await import("../memory/index.js");
	const hooks = await memoryHooks(
		{ client: null, directory: "/tmp" },
		{ config: { memory: { enabled: false } } },
	);

	const cfg = { command: {} };
	await hooks.config(cfg);
	assert.equal(
		Object.keys(cfg.command).length,
		0,
		"No memory slash commands registered when disabled",
	);
});

test("plans commands not registered when plans.enabled is false", async () => {
	const { planHooks } = await import("../plans/index.js");
	const hooks = await planHooks(
		{ client: null, directory: "/tmp" },
		{ config: { plans: { enabled: false } } },
	);

	const cfg = { command: {} };
	await hooks.config(cfg);
	assert.equal(
		Object.keys(cfg.command).length,
		0,
		"No plan slash commands registered when disabled",
	);
});

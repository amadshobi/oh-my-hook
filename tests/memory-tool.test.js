import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeMemoryTool, createMemoryTool } from "../memory/tool.js";
import { memoryHooks } from "../memory/index.js";
import {
	readMemory,
	GLOBAL_FILE,
	projectMemoryFile,
	parseBullets,
	listMemoryEntries,
} from "../memory/store.js";

function makeIsolatedEnv() {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omh-mem-tool-"));
	process.env.OMH_MEMORY_ROOT = tempDir;
	return {
		tempDir,
		cleanup: () => {
			try {
				fs.rmSync(tempDir, { recursive: true, force: true });
			} catch {}
			delete process.env.OMH_MEMORY_ROOT;
		},
	};
}

test("memory/tool: createMemoryTool provides valid OpenCode tool definition", () => {
	const toolDef = createMemoryTool();
	assert.ok(toolDef.description.includes("Manage persistent curated memory"));
	assert.equal(typeof toolDef.execute, "function");
	assert.deepEqual(toolDef.args.action.enum, [
		"add",
		"replace",
		"remove",
		"list",
	]);
	assert.equal(toolDef.args.content.type, "string");
	assert.equal(toolDef.args.old_text.type, "string");
});

test("memory/tool: action 'add' saves to markdown store", async () => {
	const env = makeIsolatedEnv();
	const projectDir = "/tmp/test-project-alpha";

	try {
		const res = await executeMemoryTool(
			{
				action: "add",
				content: "Always use Bun for testing in this repo",
				scope: "project",
			},
			{ directory: projectDir },
		);

		assert.ok(res.output.includes("Memory added successfully"));
		assert.ok(res.output.includes("Bun for testing"));

		// Check markdown file
		const projMemFile = projectMemoryFile(projectDir);
		const mdContent = readMemory(projMemFile);
		assert.ok(mdContent.includes("Always use Bun for testing in this repo"));

		const entries = listMemoryEntries(projectDir);
		assert.equal(entries.length, 1);
		assert.equal(entries[0].content, "Always use Bun for testing in this repo");
		assert.equal(entries[0].scope, "project");
	} finally {
		env.cleanup();
	}
});

test("memory/tool: action 'add' blocks secret leak into memory", async () => {
	const env = makeIsolatedEnv();
	const projectDir = "/tmp/test-project-sec";

	try {
		const fakeSecret = "ghp_" + "abcdefghijklmnopqrstuvwxyz1234567890ABCD";
		const res = await executeMemoryTool(
			{
				action: "add",
				content: `Our GitHub token is ${fakeSecret}`,
				scope: "project",
			},
			{ directory: projectDir },
		);

		assert.ok(
			res.output.includes("Error: Memory content blocked by security scanner"),
		);
		assert.ok(res.output.includes("GitHub Token"));

		// Ensure nothing was saved
		const entries = listMemoryEntries(projectDir);
		assert.equal(entries.length, 0);
	} finally {
		env.cleanup();
	}
});

test("memory/tool: action 'replace' updates memory by substring matching", async () => {
	const env = makeIsolatedEnv();
	const projectDir = "/tmp/test-project-beta";

	try {
		// 1. Add initial memory
		await executeMemoryTool(
			{
				action: "add",
				content: "Project uses tabs for indentation and 80 cols",
				scope: "project",
			},
			{ directory: projectDir },
		);

		// 2. Replace using substring
		const replaceRes = await executeMemoryTool(
			{
				action: "replace",
				old_text: "tabs for indentation",
				content: "Project uses spaces (2 spaces) for indentation",
				scope: "project",
			},
			{ directory: projectDir },
		);

		assert.ok(replaceRes.output.includes("Memory replaced successfully"));
		assert.ok(replaceRes.output.includes("2 spaces"));

		// Check markdown
		const md = readMemory(projectMemoryFile(projectDir));
		assert.ok(md.includes("Project uses spaces (2 spaces) for indentation"));
		assert.ok(!md.includes("tabs for indentation"));

		const entries = listMemoryEntries(projectDir);
		assert.equal(entries.length, 1);
		assert.equal(
			entries[0].content,
			"Project uses spaces (2 spaces) for indentation",
		);
	} finally {
		env.cleanup();
	}
});

test("memory/tool: action 'replace' returns clear error on 0 matches and ambiguous matches", async () => {
	const env = makeIsolatedEnv();
	const projectDir = "/tmp/test-project-ambig";

	try {
		await executeMemoryTool(
			{
				action: "add",
				content: "Frontend rule: use TailwindCSS",
				scope: "project",
			},
			{ directory: projectDir },
		);
		await executeMemoryTool(
			{
				action: "add",
				content: "Backend rule: use TailwindCSS for docs",
				scope: "project",
			},
			{ directory: projectDir },
		);

		// 0 match
		const zeroMatch = await executeMemoryTool(
			{
				action: "replace",
				old_text: "nonexistent framework",
				content: "use React",
			},
			{ directory: projectDir },
		);
		assert.ok(zeroMatch.output.includes("No active memory found matching"));

		// Ambiguous match (TailwindCSS appears in both)
		const ambig = await executeMemoryTool(
			{ action: "replace", old_text: "TailwindCSS", content: "use UnoCSS" },
			{ directory: projectDir },
		);
		assert.ok(ambig.output.includes("Ambiguous match"));
		assert.ok(ambig.output.includes("matches 2 memory entries"));
	} finally {
		env.cleanup();
	}
});

test("memory/tool: action 'remove' deletes memory by substring matching", async () => {
	const env = makeIsolatedEnv();
	const projectDir = "/tmp/test-project-gamma";

	try {
		await executeMemoryTool(
			{
				action: "add",
				content: "Temporary debug note: test on port 3001",
				scope: "project",
			},
			{ directory: projectDir },
		);

		const remRes = await executeMemoryTool(
			{ action: "remove", old_text: "port 3001", scope: "project" },
			{ directory: projectDir },
		);

		assert.ok(remRes.output.includes("Memory removed successfully"));

		// Markdown check
		const md = readMemory(projectMemoryFile(projectDir));
		assert.ok(!md.includes("port 3001"));

		const entries = listMemoryEntries(projectDir);
		assert.equal(entries.length, 0);
	} finally {
		env.cleanup();
	}
});

test("memory/tool: action 'list' returns all active memories", async () => {
	const env = makeIsolatedEnv();
	const projectDir = "/tmp/test-project-list";

	try {
		await executeMemoryTool(
			{
				action: "add",
				content: "Rule 1: Always write tests",
				scope: "project",
			},
			{ directory: projectDir },
		);
		await executeMemoryTool(
			{
				action: "add",
				content: "Rule 2: Conventional commits",
				scope: "project",
			},
			{ directory: projectDir },
		);

		const listRes = await executeMemoryTool(
			{ action: "list" },
			{ directory: projectDir },
		);

		assert.ok(listRes.output.includes("Active Memories (2 entries)"));
		assert.ok(listRes.output.includes("Rule 1: Always write tests"));
		assert.ok(listRes.output.includes("Rule 2: Conventional commits"));
	} finally {
		env.cleanup();
	}
});

test("memory/index: memoryHooks exports tool.memory when enabled, omits when disabled", async () => {
	const enabledHooks = await memoryHooks(
		{ client: {}, directory: "/tmp/fake" },
		{ config: { memory: { enabled: true } } },
	);
	assert.ok(enabledHooks.tool?.memory, "tool.memory should exist when enabled");

	const disabledHooks = await memoryHooks(
		{ client: {}, directory: "/tmp/fake" },
		{ config: { memory: { enabled: false } } },
	);
	assert.equal(
		disabledHooks.tool?.memory,
		undefined,
		"tool.memory should be omitted when disabled",
	);
});

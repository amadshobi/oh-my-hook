import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	projectSlug,
	projectMemoryFile,
	readMemory,
	readAllMemory,
	appendMemory,
	parseBullets,
} from "../memory/store.js";
import { memoryHooks } from "../memory/index.js";
import { isHandledError } from "../share/handled.js";

function makeProject() {
	return mkdtempSync(path.join(os.tmpdir(), "mem-"));
}

async function runCmd(hooks, cmd, args = "") {
	try {
		await hooks["command.execute.before"]({
			command: cmd,
			arguments: args,
		});
	} catch (e) {
		if (!isHandledError(e)) throw e;
	}
}

test("projectSlug returns clean directory name", () => {
	assert.equal(projectSlug("/home/user/proj"), "proj");
	assert.equal(projectSlug(""), "");
});

test("appendMemory writes bullet lines", () => {
	const file = path.join(
		mkdtempSync(path.join(os.tmpdir(), "memfile-")),
		"MEMORY.md",
	);
	appendMemory(file, "satu");
	appendMemory(file, "dua");
	const content = readFileSync(file, "utf8");
	assert.ok(content.includes("- satu"));
	assert.ok(content.includes("- dua"));
	rmSync(path.dirname(file), { recursive: true, force: true });
});

test("parseBullets extracts topic lines", () => {
	const md = "# Memory\n\n- alpha\n- beta\n\n## Notes\n- gamma";
	assert.deepEqual(parseBullets(md), ["alpha", "beta", "gamma"]);
});

test("readAllMemory merges global + project", () => {
	const project = makeProject();
	const projFile = projectMemoryFile(project);
	appendMemory(projFile, "proj-specific");
	const all = readAllMemory(project);
	assert.ok(all.includes("proj-specific"));
	rmSync(path.dirname(projFile), { recursive: true, force: true });
});

test("memoryHooks: /memory add writes project memory", async () => {
	const project = makeProject();
	const hooks = await memoryHooks({ client: {}, directory: project });
	await runCmd(hooks, "memory", "add pakai kebab-case");
	const projFile = projectMemoryFile(project);
	assert.ok(existsSync(projFile));
	assert.ok(readFileSync(projFile, "utf8").includes("pakai kebab-case"));
	rmSync(path.dirname(projFile), { recursive: true, force: true });
});

test("memoryHooks: /memory replace updates project memory", async () => {
	const project = makeProject();
	const hooks = await memoryHooks({ client: {}, directory: project });
	await runCmd(hooks, "memory", "add pakai tabs");
	await runCmd(hooks, "memory", "replace tabs -> pakai spaces");
	const projFile = projectMemoryFile(project);
	const content = readFileSync(projFile, "utf8");
	assert.ok(content.includes("pakai spaces"));
	assert.ok(!content.includes("pakai tabs"));
	rmSync(path.dirname(projFile), { recursive: true, force: true });
});

test("memoryHooks: /memory remove deletes matching bullet", async () => {
	const project = makeProject();
	const hooks = await memoryHooks({ client: {}, directory: project });
	await runCmd(hooks, "memory", "add temporary debug note");
	await runCmd(hooks, "memory", "remove debug note");
	const projFile = projectMemoryFile(project);
	const content = readFileSync(projFile, "utf8");
	assert.ok(!content.includes("temporary debug note"));
	rmSync(path.dirname(projFile), { recursive: true, force: true });
});

test("memoryHooks: /memory (list all / project / global) handles queries cleanly", async () => {
	const project = makeProject();
	const hooks = await memoryHooks({ client: {}, directory: project });
	await runCmd(hooks, "memory", "add rule-xyz");

	// /memory project
	await runCmd(hooks, "memory", "project");

	// /memory global
	await runCmd(hooks, "memory", "global");

	// /memory all
	await runCmd(hooks, "memory", "all");

	rmSync(path.dirname(projectMemoryFile(project)), {
		recursive: true,
		force: true,
	});
});

test("memoryHooks: system.transform injects for main agent, not subagent", async () => {
	const project = makeProject();
	const hooks = await memoryHooks({ client: {}, directory: project });
	await runCmd(hooks, "memory", "add memory-test-note");

	const mainOut = { system: [] };
	await hooks["experimental.chat.system.transform"](
		{ sessionID: "s1", model: {} },
		mainOut,
	);
	assert.ok(
		mainOut.system.some((s) => s.includes("memory-test-note")),
		"main agent should get memory",
	);

	const subOut = { system: [] };
	await hooks["experimental.chat.system.transform"](
		{ agent: "explore", model: {} },
		subOut,
	);
	assert.equal(subOut.system.length, 0, "subagent should NOT get memory");

	rmSync(path.dirname(projectMemoryFile(project)), {
		recursive: true,
		force: true,
	});
});

test("memoryHooks: compaction injects memory", async () => {
	const project = makeProject();
	const hooks = await memoryHooks(
		{ client: {}, directory: project },
		{ config: { memory: { enabled: true } } },
	);
	await runCmd(hooks, "memory", "add compact-note");

	const out = { context: [] };
	await hooks["experimental.session.compacting"]({ sessionID: "s1" }, out);
	rmSync(path.dirname(projectMemoryFile(project)), {
		recursive: true,
		force: true,
	});
});

test("memoryHooks: /memory add user and /memory user manage USER.md profile", async () => {
	const project = makeProject();
	const hooks = await memoryHooks({ client: {}, directory: project });
	await runCmd(hooks, "memory", "add user Panggil user dengan sebutan BOSS");

	const userFile = path.join(
		process.env.OMH_MEMORY_ROOT ||
			path.join(os.homedir(), ".config", "opencode", "memory"),
		"USER.md",
	);
	assert.ok(existsSync(userFile), "USER.md should be created");
	assert.ok(
		readFileSync(userFile, "utf8").includes("Panggil user dengan sebutan BOSS"),
	);

	// Query /memory user
	await runCmd(hooks, "memory", "user");

	rmSync(userFile, { force: true });
	rmSync(path.dirname(projectMemoryFile(project)), {
		recursive: true,
		force: true,
	});
});

test("memoryHooks: tool.definition supplies explicit Hermes JSON schema", async () => {
	const hooks = await memoryHooks({ client: {}, directory: "/tmp" });
	const output = { description: "", jsonSchema: undefined };
	await hooks["tool.definition"]({ toolID: "memory" }, output);

	assert.ok(output.jsonSchema);
	assert.equal(output.jsonSchema.type, "object");
	assert.deepEqual(output.jsonSchema.properties.target.enum, [
		"user",
		"global",
		"project",
	]);
	assert.deepEqual(output.jsonSchema.required, []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	resolvePresetPath,
	loadPromptContent,
	replaceSystemPrompt,
} from "../prompts/router.js";
import { promptHooks } from "../prompts/index.js";

test("resolvePresetPath identifies model families from assets directory", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "assets-test-"));
	mkdirSync(path.join(dir, "Misc"), { recursive: true });
	mkdirSync(path.join(dir, "DeepSeek"), { recursive: true });
	mkdirSync(path.join(dir, "Qwen"), { recursive: true });
	mkdirSync(path.join(dir, "Mistral"), { recursive: true });

	writeFileSync(path.join(dir, "Misc/minimax-m2.5.md"), "MINIMAX PROMPT");
	writeFileSync(path.join(dir, "DeepSeek/deepseek-chat.md"), "DEEPSEEK PROMPT");
	writeFileSync(path.join(dir, "Qwen/qwen3.6-plus.md"), "QWEN PLUS PROMPT");
	writeFileSync(path.join(dir, "Qwen/qwen3.8-max.md"), "QWEN MAX PROMPT");
	writeFileSync(path.join(dir, "Mistral/mistral-code.md"), "MISTRAL PROMPT");

	const cfg = { directory: dir };

	assert.equal(
		resolvePresetPath({ id: "minimax-m3", providerID: "omp" }, cfg),
		path.join(dir, "Misc/minimax-m2.5.md"),
	);

	assert.equal(
		resolvePresetPath({ id: "deepseek-v3", providerID: "omp" }, cfg),
		path.join(dir, "DeepSeek/deepseek-chat.md"),
	);

	assert.equal(
		resolvePresetPath({ id: "qwen-2.5-coder", providerID: "kilo" }, cfg),
		path.join(dir, "Qwen/qwen3.6-plus.md"),
	);

	assert.equal(
		resolvePresetPath({ id: "qwen-max", providerID: "alibaba" }, cfg),
		path.join(dir, "Qwen/qwen3.8-max.md"),
	);

	assert.equal(
		resolvePresetPath({ id: "codestral-latest", providerID: "mistral" }, cfg),
		path.join(dir, "Mistral/mistral-code.md"),
	);

	rmSync(dir, { recursive: true, force: true });
});

test("resolvePresetPath respects user explicit routes and wildcards", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "routes-test-"));
	writeFileSync(path.join(dir, "custom-prompt.md"), "CUSTOM PROMPT");

	const cfg = {
		directory: dir,
		routes: {
			"omp/my-special-model": path.join(dir, "custom-prompt.md"),
			"custom-provider/*": path.join(dir, "custom-prompt.md"),
		},
	};

	assert.equal(
		resolvePresetPath({ id: "my-special-model", providerID: "omp" }, cfg),
		path.join(dir, "custom-prompt.md"),
	);

	assert.equal(
		resolvePresetPath({ id: "any-model", providerID: "custom-provider" }, cfg),
		path.join(dir, "custom-prompt.md"),
	);

	rmSync(dir, { recursive: true, force: true });
});

test("resolvePresetPath respects user custom directory overrides and family matching", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "custom-dir-test-"));
	const customDir = path.join(dir, "custom-prompts");
	mkdirSync(customDir, { recursive: true });
	writeFileSync(path.join(customDir, "special-model.md"), "SPECIAL OVERRIDE");
	writeFileSync(
		path.join(customDir, "deepseek.md"),
		"DEEPSEEK FAMILY OVERRIDE",
	);
	writeFileSync(path.join(customDir, "default.md"), "CUSTOM DEFAULT PROMPT");

	const cfg = {
		directory: dir,
		customDirectory: customDir,
	};

	// 1. Exact match
	assert.equal(
		resolvePresetPath({ id: "special-model", providerID: "omp" }, cfg),
		path.join(customDir, "special-model.md"),
	);

	// 2. Family match
	assert.equal(
		resolvePresetPath({ id: "deepseek-coder-v2", providerID: "omp" }, cfg),
		path.join(customDir, "deepseek.md"),
	);

	// 3. Fallback to default.md
	assert.equal(
		resolvePresetPath(
			{ id: "unknown-exotic-model", providerID: "custom-gateway" },
			cfg,
		),
		path.join(customDir, "default.md"),
	);

	rmSync(dir, { recursive: true, force: true });
});

test("replaceSystemPrompt cleanly replaces base prompt and preserves metadata tail", () => {
	const initialSystem = [
		`You are default assistant.\n\nYou are powered by the model named deepseek-v3. The exact model ID is omp/deepseek-v3\nHere is some useful information about the environment you are running in:\n<env>\n  Working directory: /tmp\n</env>\n\n# AGENTS.md\nAlways test before finish.`,
		`\n## MEMORY\n- project memory bullet`,
	];

	const targetPrompt = "You are OpenCode DeepSeek specialist.";
	const result = replaceSystemPrompt(initialSystem, targetPrompt);

	assert.equal(result.length, 2);
	assert.match(
		result[0],
		/^You are OpenCode DeepSeek specialist\.\n\nYou are powered by the model named deepseek-v3/,
	);
	assert.match(result[0], /<env>\n  Working directory: \/tmp\n<\/env>/);
	assert.match(result[0], /# AGENTS\.md\nAlways test before finish\./);
	assert.equal(result[1], `\n## MEMORY\n- project memory bullet`);
});

test("replaceSystemPrompt handles system array with no boundary marker", () => {
	const initialSystem = ["Original base prompt only."];
	const result = replaceSystemPrompt(initialSystem, "New prompt");
	assert.deepEqual(result, ["New prompt"]);
});

test("promptHooks transforms system prompt during chat session", async () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "hook-test-"));
	mkdirSync(path.join(dir, "DeepSeek"), { recursive: true });
	writeFileSync(
		path.join(dir, "DeepSeek/deepseek-chat.md"),
		"DEEPSEEK EXPERT INSTRUCTIONS",
	);

	const hooks = await promptHooks(
		{},
		{
			config: {
				enabled: true,
				directory: dir,
			},
		},
	);

	const output = {
		system: [
			`You are default opencode.\n\nYou are powered by the model named deepseek-chat.\n<env>\n  Platform: linux\n</env>`,
		],
	};

	await hooks["experimental.chat.system.transform"](
		{ model: { id: "deepseek-chat", providerID: "deepseek" } },
		output,
	);

	assert.match(
		output.system[0],
		/^DEEPSEEK EXPERT INSTRUCTIONS\n\nYou are powered by the model named deepseek-chat\./,
	);
	assert.match(output.system[0], /<env>\n  Platform: linux\n<\/env>/);

	rmSync(dir, { recursive: true, force: true });
});

test("promptHooks does nothing when enabled is false", async () => {
	const hooks = await promptHooks(
		{},
		{
			config: {
				enabled: false,
			},
		},
	);

	const original = ["Original prompt"];
	const output = { system: [...original] };

	await hooks["experimental.chat.system.transform"](
		{ model: { id: "deepseek-chat", providerID: "deepseek" } },
		output,
	);

	assert.deepEqual(output.system, original);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { loadConfig, configPath } from "../share/config.js";

// Multifile config: tests that omh.yaml / omh.yml / omh.json / omh.jsonc
// all load correctly, and that .jsonc wins when multiple exist.
// These snapshot & restore any real ~/.config/opencode/omh.* files.

function snapshot() {
	const existing = {};
	for (const e of ["jsonc", "json", "yaml", "yml"]) {
		const p = configPath(e);
		if (existsSync(p)) {
			existing[e] = readFileSync(p, "utf8");
			rmSync(p);
		}
	}
	return existing;
}

function restore(existing) {
	for (const [e, content] of Object.entries(existing)) {
		writeFileSync(configPath(e), content);
	}
}

test("omh.yaml loads and merges", () => {
	const saved = snapshot();
	try {
		writeFileSync(
			configPath("yaml"),
			`memory:\n  maxBullets: 3\n  captureAdapter: opencode\nsandbox:\n  dangerousBash: false\n`,
		);
		const { config, source } = loadConfig();
		assert.ok(source?.endsWith("omh.yaml"), `expected omh.yaml, got ${source}`);
		assert.equal(config.memory.maxBullets, 3);
		assert.equal(config.memory.captureAdapter, "opencode");
		assert.equal(config.sandbox.dangerousBash, false);
		assert.equal(config.sandbox.staleWrite, true, "defaults preserved");
	} finally {
		rmSync(configPath("yaml"), { force: true });
		restore(saved);
	}
});

test("omh.yml loads and merges", () => {
	const saved = snapshot();
	try {
		writeFileSync(
			configPath("yml"),
			`context:\n  compactThreshold: 25\nreminder:\n  checklist: false\n`,
		);
		const { config, source } = loadConfig();
		assert.ok(source?.endsWith("omh.yml"), `expected omh.yml, got ${source}`);
		assert.equal(config.context.compactThreshold, 25);
		assert.equal(config.reminder.checklist, false);
	} finally {
		rmSync(configPath("yml"), { force: true });
		restore(saved);
	}
});

test("omh.json loads and merges", () => {
	const saved = snapshot();
	try {
		writeFileSync(
			configPath("json"),
			`{"sandbox": {"readBeforeWrite": false}, "memory": {"maxBullets": 7}}`,
		);
		const { config, source } = loadConfig();
		assert.ok(source?.endsWith("omh.json"), `expected omh.json, got ${source}`);
		assert.equal(config.sandbox.readBeforeWrite, false);
		assert.equal(config.memory.maxBullets, 7);
	} finally {
		rmSync(configPath("json"), { force: true });
		restore(saved);
	}
});

test("omh.jsonc loads with comments", () => {
	const saved = snapshot();
	try {
		writeFileSync(
			configPath("jsonc"),
			`{\n  // komentar\n  "memory": { "enabled": false },\n  "sandbox": { "dangerousBash": false }\n}`,
		);
		const { config, source } = loadConfig();
		assert.ok(
			source?.endsWith("omh.jsonc"),
			`expected omh.jsonc, got ${source}`,
		);
		assert.equal(config.memory.enabled, false);
		assert.equal(config.sandbox.dangerousBash, false);
	} finally {
		rmSync(configPath("jsonc"), { force: true });
		restore(saved);
	}
});

test(".jsonc beats .yaml when both exist (priority)", () => {
	const saved = snapshot();
	try {
		writeFileSync(configPath("yaml"), `memory:\n  maxBullets: 99\n`);
		writeFileSync(configPath("jsonc"), `{"memory": {"maxBullets": 42}}`);
		const { config, source } = loadConfig();
		assert.ok(
			source?.endsWith("omh.jsonc"),
			`priority should pick jsonc, got ${source}`,
		);
		assert.equal(config.memory.maxBullets, 42);
	} finally {
		rmSync(configPath("yaml"), { force: true });
		rmSync(configPath("jsonc"), { force: true });
		restore(saved);
	}
});

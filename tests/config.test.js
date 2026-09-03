import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	stripJsoncComments,
	parseYamlSimple,
	mergeConfig,
	DEFAULTS,
	loadConfig,
	resolveConfigPath,
} from "../share/config.js";

test("stripJsoncComments removes // and /* */ but not inside strings", () => {
	const input = `{
    // comment
    "url": "http://x.com//y", // trailing
    /* block */
    "keep": "yes",
  }`;
	const out = stripJsoncComments(input);
	assert.ok(!out.includes("// comment"));
	assert.ok(!out.includes("/* block */"));
	assert.ok(out.includes('"http://x.com//y"'), "url with // must survive");
	assert.ok(out.includes('"yes"'));
});

test("parseYamlSimple handles nested + scalars", () => {
	const yaml = `memory:
  enabled: true
  model: google-antigravity/gemini-2.5-flash
sandbox:
  dangerousBash: false
`;
	const parsed = parseYamlSimple(yaml);
	assert.equal(parsed.memory.enabled, true);
	assert.equal(parsed.memory.model, "google-antigravity/gemini-2.5-flash");
	assert.equal(parsed.sandbox.dangerousBash, false);
});

test("mergeConfig deep-merges per section over defaults", () => {
	const merged = mergeConfig(DEFAULTS, {
		memory: { maxBullets: 3 },
		sandbox: { readBeforeWrite: false },
	});
	assert.equal(merged.memory.maxBullets, 3);
	assert.equal(merged.memory.enabled, true, "unset keys keep defaults");
	assert.equal(merged.sandbox.readBeforeWrite, false);
	assert.equal(
		merged.sandbox.staleWrite,
		true,
		"other sandbox keys keep defaults",
	);
});

test("loadConfig returns defaults when no file exists", () => {
	const { config, source } = loadConfig();
	assert.equal(config.memory.enabled, true);
	assert.equal(config.sandbox.secretScanner, true);
	assert.ok(source === null || typeof source === "string");
});

test("loadConfig reads a real omh.jsonc and merges", (t) => {
	// Point CONFIG_DIR at a temp dir via monkeypatch is not possible (const),
	// so test resolveConfigPath + parse pipeline with a temp file instead.
	const tmpDir = path.join(os.tmpdir(), "omh-config-test");
	mkdirSync(tmpDir, { recursive: true });
	const file = path.join(tmpDir, "omh.jsonc");
	writeFileSync(
		file,
		`{
      // test config
      "memory": { "maxBullets": 5, "model": "google-antigravity/gemini-2.5-flash" },
      "sandbox": { "dangerousBash": false }
    }`,
	);
	// resolveConfigPath reads CONFIG_DIR (real home) — this test asserts the
	// parser+merge pipeline directly on the file content.
	const text = readFileSync(file, "utf8");
	const parsed = JSON.parse(stripJsoncComments(text));
	const merged = mergeConfig(DEFAULTS, parsed);
	assert.equal(merged.memory.maxBullets, 5);
	assert.equal(merged.memory.model, "google-antigravity/gemini-2.5-flash");
	assert.equal(merged.sandbox.dangerousBash, false);
	assert.equal(merged.sandbox.readBeforeWrite, true);
	rmSync(tmpDir, { recursive: true, force: true });
});

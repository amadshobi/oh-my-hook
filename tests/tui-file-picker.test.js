/**
 * tests/tui-file-picker.test.js — unit tests for the quick file picker helpers:
 * file discovery (git + BFS fallback, TTL cache) and clipboard write (OSC 52 +
 * native fallback). Keeps ephemeral state (temp dirs, TMUX env) restored in
 * finally blocks so tests never leak into the host environment.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	discoverFiles,
	clearDiscoveryCache,
} from "../tui/src/lib/file-discovery.js";
import { writeClipboard, formatOsc52 } from "../tui/src/lib/clipboard-write.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("discoverFiles returns non-empty array in current repo workspace", () => {
	const files = discoverFiles(process.cwd());
	assert.ok(Array.isArray(files), "Should return an array");
	assert.ok(files.length > 0, "Should discover files in the repo");
});

test("discoverFiles includes package.json and excludes node_modules", () => {
	const files = discoverFiles(process.cwd());
	assert.ok(files.includes("package.json"), "Should include package.json");
	assert.ok(
		!files.some((f) => f.includes("node_modules/")),
		"Should not include node_modules files",
	);
});

test("discoverFiles caps results at maxFiles option", () => {
	clearDiscoveryCache();
	const files = discoverFiles(process.cwd(), { maxFiles: 5 });
	assert.equal(files.length, 5, "Should return exactly maxFiles entries");
});

test("discoverFiles uses TTL cache returning identical array reference", () => {
	clearDiscoveryCache();
	const first = discoverFiles(process.cwd());
	const second = discoverFiles(process.cwd());
	assert.strictEqual(first, second, "Cached call should reuse the array");
});

test("clearDiscoveryCache forces fresh evaluation", () => {
	clearDiscoveryCache();
	const first = discoverFiles(process.cwd());
	clearDiscoveryCache();
	const second = discoverFiles(process.cwd());
	assert.notStrictEqual(
		first,
		second,
		"After clearing, next call should evaluate fresh",
	);
});

test("discoverFiles BFS fallback finds files in non-git temp dir", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "omh-picker-"));
	try {
		mkdirSync(path.join(dir, "src"));
		mkdirSync(path.join(dir, "node_modules"));
		writeFileSync(path.join(dir, "package.json"), "{}");
		writeFileSync(path.join(dir, "src", "index.ts"), "export {};");
		writeFileSync(
			path.join(dir, "node_modules", "dep.js"),
			"ignored dependency",
		);

		const files = discoverFiles(dir);
		assert.ok(files.includes("package.json"), "Should include root file");
		assert.ok(files.includes("src/index.ts"), "Should include nested file");
		assert.ok(
			!files.some((f) => f.includes("node_modules")),
			"Should skip ignored dependency dirs",
		);
		assert.ok(
			files.every((f) => !f.includes(path.sep) || f.includes("/")),
			"Paths should use POSIX separators",
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("formatOsc52 encodes base64 into OSC 52 payload", () => {
	const previous = process.env.TMUX;
	try {
		// Unset TMUX so the assertion checks the bare OSC 52 prefix (not the
		// tmux passthrough wrapper) regardless of the host environment.
		delete process.env.TMUX;
		const osc = formatOsc52("test/path.js");
		const expectedB64 = Buffer.from("test/path.js", "utf8").toString("base64");
		assert.ok(osc.includes(expectedB64), "Should contain base64 encoded text");
		assert.ok(osc.startsWith("\x1b]52;c;"), "Should start with OSC 52 prefix");
	} finally {
		if (previous === undefined) delete process.env.TMUX;
		else process.env.TMUX = previous;
	}
});

test("formatOsc52 wraps payload for tmux passthrough", () => {
	const previous = process.env.TMUX;
	try {
		process.env.TMUX = "1";
		const osc = formatOsc52("test/path.js");
		assert.ok(osc.startsWith("\x1bPtmux;"), "Should wrap in tmux passthrough");
		assert.ok(osc.includes("\x1b]52;c;"), "Should contain OSC 52 payload");
	} finally {
		if (previous === undefined) delete process.env.TMUX;
		else process.env.TMUX = previous;
	}
});

test("formatOsc52 returns empty string for empty/invalid input", () => {
	assert.equal(formatOsc52(""), "");
	assert.equal(formatOsc52(undefined), "");
	assert.equal(formatOsc52(null), "");
});

test("writeClipboard never throws for empty or valid strings", () => {
	assert.doesNotThrow(() => writeClipboard(""));
	assert.doesNotThrow(() => writeClipboard(undefined));
	assert.doesNotThrow(() => writeClipboard(null));
	assert.doesNotThrow(() => writeClipboard("test-path/file.ts"));
	assert.doesNotThrow(() => writeClipboard("console.log('x');"));
});

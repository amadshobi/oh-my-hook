/**
 * tests/boundary.test.js — architectural boundary guard (issue #11, milestone A).
 *
 * Enforces the adapter contract documented in AGENTS.md:
 *   1. Modules contain pure logic — only `node:` builtins and relative imports.
 *   2. `share/` is the ONLY shared dependency layer: a module may import from
 *      itself or share/, never from another module directory.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Logic modules — must stay framework-free and share/-coupled only.
const MODULE_DIRS = [
	"sandbox",
	"compress",
	"memory",
	"plans",
	"prompts",
	"reminder",
	"context",
	"imgsee",
	"share",
];

// Backward-compat shims intentionally redirect old import paths to the new
// home; they are adapters, not logic, so the share/-only rule doesn't apply.
const SHIM_ALLOWLIST = ["context/index.js"];

function listJsFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...listJsFiles(full));
		} else if (entry.endsWith(".js")) {
			out.push(full);
		}
	}
	return out;
}

function parseImports(source) {
	return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

test("boundary: module imports are node builtins, self-references, or share/ only", () => {
	const violations = [];

	for (const dir of MODULE_DIRS) {
		const files = listJsFiles(path.join(ROOT, dir));
		for (const file of files) {
			if (SHIM_ALLOWLIST.includes(path.relative(ROOT, file))) continue;
			const source = readFileSync(file, "utf8");
			for (const spec of parseImports(source)) {
				if (spec.startsWith("node:") || spec.startsWith("./")) continue;

				if (spec.startsWith("../")) {
					const resolved = path
						.relative(ROOT, path.resolve(path.dirname(file), spec))
						.split(path.sep)[0];
					// Cross-directory import: only the shared layer is allowed.
					if (resolved !== "share") {
						violations.push(
							`${path.relative(ROOT, file)} -> "${spec}" (only share/ may be imported cross-module)`,
						);
					}
					continue;
				}

				// Bare specifier: external package dependency in logic layer.
				violations.push(
					`${path.relative(ROOT, file)} -> "${spec}" (external deps are not allowed in logic modules)`,
				);
			}
		}
	}

	assert.deepEqual(violations, []);
});

test("boundary: root index.js is the sole OpenCode hook assembler", () => {
	const indexSource = readFileSync(path.join(ROOT, "index.js"), "utf8");

	// Root composes every module factory — this is what makes it the adapter layer.
	for (const factory of [
		"sandboxHooks",
		"compressModule",
		"reminderModule",
		"memoryHooks",
		"planHooks",
		"promptHooks",
		"imgseeModule",
	]) {
		assert.ok(
			indexSource.includes(factory),
			`root index.js should compose ${factory}`,
		);
	}
});

#!/usr/bin/env node
/**
 * scripts/install-opencode.js — standalone installer for the OpenCode adapter.
 *
 * Registers/unregisters oh-my-hook in the user's OpenCode config files using
 * marker-scoped text surgery so existing jsonc comments are never destroyed:
 *
 *   install   → inject a managed entry into "plugin" arrays of
 *               opencode.jsonc + tui.jsonc; create omh.jsonc defaults if absent
 *   uninstall → remove ONLY installer-managed blocks (marker-scoped)
 *   status    → report current registration state (feeds future `omh doctor`)
 *
 * Zero external dependencies. Machine-readable output: --json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { DEFAULTS } from "../share/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REPO_ENTRY = REPO_ROOT; // directory plugin: OpenCode resolves index.js

const MARKER = "// oh-my-hook:managed";
const MANAGED_FILES = ["opencode.jsonc", "tui.jsonc"];

// ── helpers ──────────────────────────────────────────────────────────────────

function defaultConfigDir() {
	if (process.env.OPENCODE_CONFIG_DIR)
		return path.resolve(process.env.OPENCODE_CONFIG_DIR);
	const xdg = process.env.XDG_CONFIG_HOME;
	return path.join(xdg ? xdg : path.join(os.homedir(), ".config"), "opencode");
}

function createReport(action) {
	return {
		action,
		configDir: null,
		files: [],
		linked: 0,
		unchanged: 0,
		removed: 0,
		errors: [],
		warnings: [],
	};
}

/** Split a line into [code, comment] respecting double-quoted strings. */
function splitLineComment(line) {
	let inString = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"' && line[i - 1] !== "\\") inString = !inString;
		if (!inString && ch === "/" && line[i + 1] === "/")
			return [line.slice(0, i), line.slice(i)];
	}
	return [line, ""];
}

/** True when `needle` occurs on a line's CODE portion (not inside a comment). */
function mentionedInCode(line, needle) {
	const [code] = splitLineComment(line);
	return code.includes(needle);
}

/** Locate the span of the `"plugin"` array (single- or multi-line).
 * Returns {start,end} line indexes (inclusive) or null when absent. */
function findPluginArrayLines(lines) {
	const start = lines.findIndex((l) =>
		/"plugin"\s*:\s*\[/.test(splitLineComment(l)[0]),
	);
	if (start === -1) return null;

	for (let i = start; i < lines.length; i++) {
		const code = splitLineComment(lines[i])[0];
		// Single-line array closes on the same line it opens.
		const open = code.indexOf("[");
		const close = code.lastIndexOf("]");
		if (i === start && open !== -1 && close > open) return { start, end: i };
		if (i > start && close !== -1) return { start, end: i };
	}
	return null;
}

/** Inspect one config file. Returns state without mutating anything. */
function inspectFile(filePath, repoEntry) {
	const state = {
		file: filePath,
		exists: false,
		installed: false,
		managedBlock: false,
		staleMention: false,
	};
	if (!existsSync(filePath)) return state;

	state.exists = true;
	const lines = readFileSync(filePath, "utf8").split("\n");
	const span = findPluginArrayLines(lines);
	if (!span) return state;

	for (let i = span.start; i <= span.end; i++) {
		const line = lines[i];
		if (line.includes(MARKER)) state.managedBlock = true;
		if (mentionedInCode(line, repoEntry)) state.installed = true;
		else if (splitLineComment(line)[1].includes(repoEntry))
			state.staleMention = true;
	}
	return state;
}

/**
 * Inject a managed entry as the FIRST element of the "plugin" array.
 * First-position insertion avoids comma-surgery on unknown trailing tokens:
 * we always append our own comma after the injected entry.
 * Returns null when no change is needed.
 */
function injectManagedEntry(source, repoEntry) {
	const lines = source.split("\n");
	const span = findPluginArrayLines(lines);
	if (!span) return null;

	for (let i = span.start; i <= span.end; i++) {
		if (mentionedInCode(lines[i], repoEntry)) return null; // already active
	}

	const indent = lines[span.start].match(/^\s*/)[0] + "  ";
	const inject = [
		`${indent}${MARKER} (do not edit; run uninstall to remove)`,
		`${indent}"${repoEntry}",`,
	];
	lines.splice(span.start + 1, 0, ...inject);
	return lines.join("\n");
}

/** Remove ONLY the marker-scoped managed block. Returns null when nothing matched. */
function removeManagedBlock(source) {
	const lines = source.split("\n");
	const idx = lines.findIndex((l) => l.includes(MARKER));
	if (idx === -1) return null;
	let end = idx;
	while (end < lines.length && !lines[end].trimEnd().endsWith(",")) end++;
	lines.splice(idx, end - idx + 1);
	return lines.join("\n");
}

/** Append a minimal top-level "plugin" array when the key is entirely absent. */
function appendPluginKey(source, repoEntry) {
	const lines = source.split("\n");
	// Find last line that is real object content (not a comment/blank/closing).
	let anchor = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		const [code] = splitLineComment(lines[i]);
		const trimmed = code.trim();
		if (!trimmed || trimmed === "}") continue;
		anchor = i;
		break;
	}
	if (anchor === -1) return null;
	if (!lines[anchor].trimEnd().endsWith(","))
		lines[anchor] = `${lines[anchor].trimEnd()},`;
	const indent = lines[anchor].match(/^\s*/)[0];
	lines.splice(
		anchor + 1,
		0,
		`${indent}${MARKER}`,
		`${indent}"plugin": [`,
		`${indent}  "${repoEntry}"`,
		`${indent}]`,
	);
	return lines.join("\n");
}

// ── actions ──────────────────────────────────────────────────────────────────

function mutateFile(filePath, transform, report, okLabel) {
	if (!existsSync(filePath)) {
		report.files.push({ file: path.basename(filePath), status: "missing" });
		report.warnings.push(
			`${path.basename(filePath)} not found — skipping (agent may not be initialized yet)`,
		);
		return;
	}
	const source = readFileSync(filePath, "utf8");
	const result = transform(source);
	if (result === null) {
		report.files.push({ file: path.basename(filePath), status: "unchanged" });
		report.unchanged++;
		return;
	}
	// Cheap rollback insurance: timestamped backup next to the original.
	writeFileSync(`${filePath}.omh-bak`, source, "utf8");
	writeFileSync(filePath, result, "utf8");
	report.files.push({ file: path.basename(filePath), status: okLabel });
	report[okLabel === "installed" ? "linked" : "removed"]++;
}
/** Install transform: inject into existing "plugin" array, or append the key
 * when entirely absent. Returns null when the entry is already active. */
function installTransform(source) {
	if (findPluginArrayLines(source.split("\n"))) {
		return injectManagedEntry(source, REPO_ENTRY);
	}
	return appendPluginKey(source, REPO_ENTRY);
}

function actionInstall(configDir, report) {
	for (const name of MANAGED_FILES) {
		mutateFile(
			path.join(configDir, name),
			installTransform,
			report,
			"installed",
		);
	}

	// Default omh.jsonc: created once, never overwritten (user-owned afterwards).
	const omhConfig = path.join(configDir, "omh.jsonc");
	if (!existsSync(omhConfig)) {
		try {
			const header =
				"// oh-my-hook configuration — generated by installer, safe to edit.\n";
			writeFileSync(omhConfig, header + JSON.stringify(DEFAULTS, null, 2));
			report.files.push({ file: "omh.jsonc", status: "created" });
		} catch (err) {
			report.errors.push(`failed to generate omh.jsonc: ${err.message}`);
		}
	}
}

function actionUninstall(configDir, report) {
	for (const name of MANAGED_FILES) {
		mutateFile(
			path.join(configDir, name),
			removeManagedBlock,
			report,
			"removed",
		);
	}
}

function actionStatus(configDir, report) {
	for (const name of MANAGED_FILES) {
		const st = inspectFile(path.join(configDir, name), REPO_ENTRY);
		delete st.file;
		report.files.push({
			file: name,
			status: !st.exists
				? "missing"
				: st.installed
					? "installed"
					: st.staleMention
						? "commented-out"
						: "not-installed",
			managed: st.managedBlock,
		});
	}
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const HELP = `omh-installer — register/unregister oh-my-hook in OpenCode configs

Usage: node scripts/install-opencode.js <command> [flags]

Commands:
  install     Register plugin entries + create omh.jsonc defaults
  uninstall   Remove only installer-managed entries (safe, marker-scoped)
  status      Show registration state of each config file

Flags:
  --json      Machine-readable output (no colors/emojis)
  --config-dir <dir>   Override OpenCode config directory
  --help      Show this help`;

function main() {
	const args = process.argv.slice(2);
	const command = args.find((a) => !a.startsWith("--"));
	const jsonMode = args.includes("--json");
	const dirFlagIdx = args.indexOf("--config-dir");
	const configDir =
		dirFlagIdx !== -1 ? path.resolve(args[dirFlagIdx + 1]) : defaultConfigDir();

	if (!command || command === "--help" || args.includes("--help")) {
		console.log(HELP);
		process.exit(command ? 0 : 1);
	}
	if (!["install", "uninstall", "status"].includes(command)) {
		console.error(
			`error: unknown command "${command}" — try install|uninstall|status`,
		);
		process.exit(1);
	}

	const report = createReport(command);
	report.configDir = configDir;
	({
		install: actionInstall,
		uninstall: actionUninstall,
		status: actionStatus,
	})[command](configDir, report);

	if (jsonMode) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(`\n🪝 oh-my-hook installer — ${command} (${configDir})`);
		for (const f of report.files)
			console.log(`  ${f.status.padEnd(15)} ${f.file}`);
		for (const w of report.warnings) console.log(`  ⚠️  ${w}`);
		for (const e of report.errors) console.log(`  ❌ ${e}`);
		const ok = report.errors.length === 0;
		console.log(
			`\n${ok ? "✅ done" : "❌ failed"} — linked=${report.linked} unchanged=${report.unchanged} removed=${report.removed}\n`,
		);
	}
	process.exit(report.errors.length === 0 ? 0 : 1);
}

main();

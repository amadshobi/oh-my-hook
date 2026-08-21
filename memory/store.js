/**
 * memory/store.js — memory file store.
 *
 * Memory lives in markdown files, one bullet per topic (easy to parse and
 * hand-edit):
 *
 *   ~/.config/opencode/memory/MEMORY.md                      (global)
 *   ~/.config/opencode/memory/projects/<slug>/MEMORY.md      (per-project)
 *
 * Only curated content goes here — /remember (manual) or /capture (AI
 * distill). Never auto-log raw conversation.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export const MEMORY_ROOT =
	process.env.OMH_MEMORY_ROOT ||
	path.join(os.homedir(), ".config", "opencode", "memory");

export const GLOBAL_FILE = path.join(MEMORY_ROOT, "MEMORY.md");

/**
 * Slugify a project directory into a stable relative path fragment.
 * ~/projects/my-app → "home/projects/my-app" (no leading slash).
 */
export function projectSlug(projectDir) {
	if (!projectDir) return "";
	const normalized = path
		.resolve(projectDir)
		.split(path.sep)
		.join("/")
		.replace(/^\/+/, "");
	return normalized;
}

export function projectMemoryFile(projectDir) {
	return path.join(
		MEMORY_ROOT,
		"projects",
		projectSlug(projectDir),
		"MEMORY.md",
	);
}

export function ensureMemoryDir() {
	mkdirSync(MEMORY_ROOT, { recursive: true });
}

/** Read a memory file, returning the raw markdown (empty string if none). */
export function readMemory(file) {
	try {
		if (existsSync(file)) return readFileSync(file, "utf8");
	} catch {}
	return "";
}

/**
 * Check if a directory is home, root, or unspecified (should target Global memory).
 * @param {string} dir
 * @returns {boolean}
 */
export function isGlobalDirectory(dir) {
	if (!dir) return true;
	const resolved = path.resolve(dir);
	const home = path.resolve(os.homedir());
	return resolved === home || resolved === "/" || resolved === "";
}

/**
 * Resolve target memory file path based on directory.
 * If running in home (~), returns global MEMORY.md.
 * If in a project, returns projects/<slug>/MEMORY.md.
 * @param {string} [projectDir]
 * @returns {string}
 */
export function resolveTargetMemoryFile(projectDir) {
	if (isGlobalDirectory(projectDir)) {
		return GLOBAL_FILE;
	}
	return projectMemoryFile(projectDir);
}

/**
 * Read global + project memory, concatenated (global first, then project).
 */
export function readAllMemory(projectDir) {
	const global = readMemory(GLOBAL_FILE).trim();
	const parts = [];
	if (global) parts.push(`# Global Memory\n\n${global}`);

	if (!isGlobalDirectory(projectDir)) {
		const project = readMemory(projectMemoryFile(projectDir)).trim();
		if (project) parts.push(`# Project Memory\n\n${project}`);
	}

	return parts.join("\n\n");
}

/**
 * Append a bullet entry to a memory file (creates dir/file if needed).
 * Returns the entry text that was added.
 */
export function appendMemory(file, entry) {
	ensureMemoryDir();
	mkdirSync(path.dirname(file), { recursive: true });
	const existing = readMemory(file).trim();
	const line = `- ${entry.replace(/\n/g, " ").trim()}`;
	const next = existing ? `${existing}\n${line}` : `# Memory\n\n${line}`;
	writeFileSync(file, next + "\n");
	return line;
}

/** List parsed bullets (topic lines) from a memory file. */
export function parseBullets(markdown) {
	return markdown
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.startsWith("- "))
		.map((l) => l.slice(2).trim())
		.filter(Boolean);
}

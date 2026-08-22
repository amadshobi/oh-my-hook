/**
 * memory/store.js — Pure Markdown Memory File Store.
 *
 * Memory lives strictly in markdown files, one bullet per topic:
 *   ~/.config/opencode/memory/MEMORY.md                      (global)
 *   ~/.config/opencode/memory/projects/<slug>/MEMORY.md      (per-project)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/** Dynamic memory root path (honors process.env.OMH_MEMORY_ROOT for test isolation). */
export function getMemoryRoot() {
	return (
		process.env.OMH_MEMORY_ROOT ||
		path.join(os.homedir(), ".config", "opencode", "memory")
	);
}

/** Dynamic global memory file path. */
export function getGlobalFile() {
	return path.join(getMemoryRoot(), "MEMORY.md");
}

export const MEMORY_ROOT = path.join(
	os.homedir(),
	".config",
	"opencode",
	"memory",
);
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
		getMemoryRoot(),
		"projects",
		projectSlug(projectDir),
		"MEMORY.md",
	);
}

export function ensureMemoryDir() {
	mkdirSync(getMemoryRoot(), { recursive: true });
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
		return getGlobalFile();
	}
	return projectMemoryFile(projectDir);
}

/**
 * Read global + project memory, concatenated (global first, then project).
 */
export function readAllMemory(projectDir) {
	const globalFile = getGlobalFile();
	const global = readMemory(globalFile).trim();
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

/**
 * Replace an existing bullet in a memory markdown file by substring match.
 * @param {string} file
 * @param {string} oldMatch
 * @param {string} newEntry
 * @returns {boolean}
 */
export function replaceMemory(file, oldMatch, newEntry) {
	if (!existsSync(file)) return false;
	const content = readMemory(file);
	const lines = content.split("\n");
	const needle = oldMatch.toLowerCase();
	let replaced = false;

	const nextLines = lines.map((line) => {
		if (
			!replaced &&
			line.trim().startsWith("- ") &&
			line.toLowerCase().includes(needle)
		) {
			replaced = true;
			return `- ${newEntry.replace(/\n/g, " ").trim()}`;
		}
		return line;
	});

	if (replaced) {
		writeFileSync(file, nextLines.join("\n"));
		return true;
	}
	return false;
}

/**
 * Remove an existing bullet from a memory markdown file by substring match.
 * @param {string} file
 * @param {string} oldMatch
 * @returns {boolean}
 */
export function removeMemory(file, oldMatch) {
	if (!existsSync(file)) return false;
	const content = readMemory(file);
	const lines = content.split("\n");
	const needle = oldMatch.toLowerCase();
	let removed = false;

	const nextLines = lines.filter((line) => {
		if (
			!removed &&
			line.trim().startsWith("- ") &&
			line.toLowerCase().includes(needle)
		) {
			removed = true;
			return false;
		}
		return true;
	});

	if (removed) {
		writeFileSync(file, nextLines.join("\n"));
		return true;
	}
	return false;
}

/**
 * List all memory bullet entries with scope metadata.
 * @param {string} [projectDir]
 * @param {"global" | "project"} [scope]
 * @returns {Array<{ content: string, scope: "global" | "project", file: string }>}
 */
export function listMemoryEntries(projectDir, scope) {
	const entries = [];
	const globalFile = getGlobalFile();

	if (!scope || scope === "global") {
		const rawGlobal = readMemory(globalFile);
		for (const bullet of parseBullets(rawGlobal)) {
			entries.push({ content: bullet, scope: "global", file: globalFile });
		}
	}

	if ((!scope || scope === "project") && !isGlobalDirectory(projectDir)) {
		const projFile = projectMemoryFile(projectDir);
		const rawProj = readMemory(projFile);
		for (const bullet of parseBullets(rawProj)) {
			entries.push({ content: bullet, scope: "project", file: projFile });
		}
	}

	return entries;
}

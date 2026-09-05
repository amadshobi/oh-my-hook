/**
 * memory/store.js — Hermes-Style Pure Markdown Memory File Store.
 *
 * Memory lives strictly in markdown files across 3 distinct targets:
 *   ~/.config/opencode/memory/USER.md                      (user profile)
 *   ~/.config/opencode/memory/MEMORY.md                    (global technical notes)
 *   ~/.config/opencode/memory/projects/<slug>/MEMORY.md    (per-project conventions)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export const DEFAULT_BUDGETS = {
	user: 1500,
	global: 2500,
	project: 3500,
};

/** Dynamic memory root path (honors process.env.OMH_MEMORY_ROOT for test isolation). */
export function getMemoryRoot() {
	return (
		process.env.OMH_MEMORY_ROOT ||
		path.join(os.homedir(), ".config", "opencode", "memory")
	);
}

/** Dynamic user profile memory file path (USER.md). */
export function getUserFile() {
	return path.join(getMemoryRoot(), "USER.md");
}

/** Dynamic global technical memory file path (MEMORY.md). */
export function getGlobalFile() {
	return path.join(getMemoryRoot(), "MEMORY.md");
}

export const MEMORY_ROOT = path.join(
	os.homedir(),
	".config",
	"opencode",
	"memory",
);
export const USER_FILE = path.join(MEMORY_ROOT, "USER.md");
export const GLOBAL_FILE = path.join(MEMORY_ROOT, "MEMORY.md");

/**
 * Slugify a project directory into a clean, flat name.
 * ~/civil/projects/civil-api → "civil-api"
 */
export function projectSlug(projectDir) {
	if (!projectDir) return "";
	const resolved = path.resolve(projectDir);
	return path.basename(resolved);
}

/** Dynamic per-project memory file path. */
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
 * Normalize target name to "user", "global", or "project".
 * @param {string} [target]
 * @returns {"user" | "global" | "project"}
 */
export function normalizeTarget(target) {
	if (!target) return "project";
	const lower = String(target).toLowerCase().trim();
	if (lower === "user" || lower === "profile") return "user";
	if (lower === "global" || lower === "memory") return "global";
	return "project";
}

/**
 * Resolve target memory file path based on target and directory.
 * @param {string} [targetOrDir] Target scope or project directory.
 * @param {string} [dirOrTarget] Project directory when target is first arg.
 * @returns {string}
 */
export function resolveTargetMemoryFile(targetOrDir, dirOrTarget) {
	const first = String(targetOrDir || "").trim();
	const second = String(dirOrTarget || "").trim();

	let target = "project";
	let dir = process.cwd();

	if (first === "user" || first === "global" || first === "project") {
		target = first;
		dir = second || process.cwd();
	} else if (second === "user" || second === "global" || second === "project") {
		target = second;
		dir = first || process.cwd();
	} else if (first) {
		dir = first;
	}

	if (target === "user") return getUserFile();
	if (target === "global") return getGlobalFile();
	if (isGlobalDirectory(dir)) return getGlobalFile();
	return projectMemoryFile(dir);
}

/**
 * Get memory character budget for a target.
 * @param {"user" | "global" | "project"} target
 * @param {object} [customBudgets]
 * @returns {number}
 */
export function getMemoryBudget(target, customBudgets = {}) {
	const norm = normalizeTarget(target);
	return customBudgets?.[norm] ?? DEFAULT_BUDGETS[norm] ?? 2500;
}

/**
 * Calculate usage metrics for a target file.
 * @param {string} file
 * @param {"user" | "global" | "project"} target
 * @param {object} [customBudgets]
 * @returns {{ current: number, limit: number, pct: number, usage: string }}
 */
export function getMemoryUsage(file, target, customBudgets = {}) {
	const content = readMemory(file).trim();
	const current = content.length;
	const limit = getMemoryBudget(target, customBudgets);
	const pct =
		limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
	return {
		current,
		limit,
		pct,
		usage: `${pct}% — ${current.toLocaleString()}/${limit.toLocaleString()} chars`,
	};
}

/**
 * Check if adding or replacing content exceeds the target's character budget.
 * @param {string} file
 * @param {string} candidateContent
 * @param {"user" | "global" | "project"} target
 * @param {object} [customBudgets]
 * @returns {{ ok: boolean, current: number, next: number, limit: number, pct: number, error?: string }}
 */
export function checkMemoryBudget(
	file,
	candidateContent,
	target,
	customBudgets = {},
) {
	const limit = getMemoryBudget(target, customBudgets);
	const next = candidateContent.trim().length;
	const current = readMemory(file).trim().length;
	const pct = limit > 0 ? Math.round((next / limit) * 100) : 0;

	if (next > limit) {
		return {
			ok: false,
			current,
			next,
			limit,
			pct,
			error: `Target '${target}' memory budget exceeded (${next}/${limit} chars, ${pct}%). Please consolidate or remove older memories first.`,
		};
	}

	return { ok: true, current, next, limit, pct };
}

/**
 * Read all memory files across user, global, and project scopes concatenated.
 * @param {string} [projectDir]
 * @returns {string}
 */
export function readAllMemory(projectDir) {
	const parts = [];

	const user = readMemory(getUserFile()).trim();
	if (user) parts.push(`# User Profile\n\n${user}`);

	const global = readMemory(getGlobalFile()).trim();
	if (global) parts.push(`# Global Memory\n\n${global}`);

	if (!isGlobalDirectory(projectDir)) {
		const project = readMemory(projectMemoryFile(projectDir)).trim();
		if (project) parts.push(`# Project Memory\n\n${project}`);
	}

	return parts.join("\n\n");
}

/**
 * Render a Hermes-style visual system prompt block with usage indicators.
 * @param {string} title
 * @param {string} rawContent
 * @param {number} limit
 * @returns {string}
 */
function renderHermesBlock(title, rawContent, limit) {
	const content = rawContent.trim();
	if (!content) return "";
	const current = content.length;
	const pct =
		limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
	const header = `${title} [${pct}% — ${current.toLocaleString()}/${limit.toLocaleString()} chars]`;
	const separator = "═".repeat(46);
	return `${separator}\n${header}\n${separator}\n${content}`;
}

/**
 * Format curated memory for system prompt injection with visual headers and budgets.
 * @param {string} [projectDir]
 * @param {object} [customBudgets]
 * @returns {string}
 */
export function formatSystemMemory(projectDir, customBudgets = {}) {
	const blocks = [];

	const userContent = readMemory(getUserFile());
	const userLimit = getMemoryBudget("user", customBudgets);
	const userBlock = renderHermesBlock(
		"USER PROFILE (who the user is)",
		userContent,
		userLimit,
	);
	if (userBlock) blocks.push(userBlock);

	const globalContent = readMemory(getGlobalFile());
	const globalLimit = getMemoryBudget("global", customBudgets);
	const globalBlock = renderHermesBlock(
		"GLOBAL MEMORY (environment & tools)",
		globalContent,
		globalLimit,
	);
	if (globalBlock) blocks.push(globalBlock);

	if (!isGlobalDirectory(projectDir)) {
		const slug = projectSlug(projectDir).split("/").pop() || "workspace";
		const projectContent = readMemory(projectMemoryFile(projectDir));
		const projectLimit = getMemoryBudget("project", customBudgets);
		const projectBlock = renderHermesBlock(
			`PROJECT MEMORY (${slug})`,
			projectContent,
			projectLimit,
		);
		if (projectBlock) blocks.push(projectBlock);
	}

	return blocks.join("\n\n");
}

/**
 * Append a bullet entry to a memory file (creates dir/file if needed).
 * @param {string} file
 * @param {string} entry
 * @returns {string}
 */
export function appendMemory(file, entry) {
	ensureMemoryDir();
	mkdirSync(path.dirname(file), { recursive: true });
	const existing = readMemory(file).trim();
	const cleanEntry = entry.replace(/\n/g, " ").trim();
	const line = `- ${cleanEntry}`;

	// Anti-redundancy guard: skip if bullet already exists (case-insensitive)
	const existingBullets = parseBullets(existing).map((b) => b.toLowerCase().trim());
	if (existingBullets.includes(cleanEntry.toLowerCase())) {
		return line;
	}

	let defaultHeader = "# Memory";
	if (file.endsWith("USER.md")) {
		defaultHeader = "# User Profile";
	} else if (file === getGlobalFile()) {
		defaultHeader = "# Global Memory";
	} else if (file.includes("/projects/")) {
		defaultHeader = "# Project Memory";
	}

	const next = existing
		? `${existing}\n${line}`
		: `${defaultHeader}\n\n${line}`;
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
 * List all memory bullet entries with target & scope metadata.
 * @param {string} [projectDir]
 * @param {"all" | "user" | "global" | "project"} [filter]
 * @returns {Array<{ content: string, scope: string, target: string, file: string }>}
 */
export function listMemoryEntries(projectDir, filter) {
	const entries = [];
	const normFilter = filter ? normalizeTarget(filter) : null;
	const showAll = !filter || filter === "all";

	const userFile = getUserFile();
	if (showAll || normFilter === "user") {
		for (const bullet of parseBullets(readMemory(userFile))) {
			entries.push({
				content: bullet,
				scope: "user",
				target: "user",
				file: userFile,
			});
		}
	}

	const globalFile = getGlobalFile();
	if (showAll || normFilter === "global") {
		for (const bullet of parseBullets(readMemory(globalFile))) {
			entries.push({
				content: bullet,
				scope: "global",
				target: "global",
				file: globalFile,
			});
		}
	}

	if ((showAll || normFilter === "project") && !isGlobalDirectory(projectDir)) {
		const projFile = projectMemoryFile(projectDir);
		for (const bullet of parseBullets(readMemory(projFile))) {
			entries.push({
				content: bullet,
				scope: "project",
				target: "project",
				file: projFile,
			});
		}
	}

	return entries;
}

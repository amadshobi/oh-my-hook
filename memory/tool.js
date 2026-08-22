/**
 * memory/tool.js — Native OpenCode agent tool for memory management.
 *
 * Provides a single 4-action tool (`memory`) operating directly on Markdown stores:
 *   - add: Save new durable memory bullet
 *   - replace: Update existing memory bullet using substring matching
 *   - remove: Delete memory bullet using substring matching
 *   - list: Inspect active memory bullets
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	appendMemory,
	replaceMemory,
	removeMemory,
	resolveTargetMemoryFile,
	listMemoryEntries,
	GLOBAL_FILE,
} from "./store.js";
import { scanContentForSecrets } from "../sandbox/security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESCRIPTION_FILE = path.join(__dirname, "memory.txt");

export function loadToolDescription() {
	try {
		if (existsSync(DESCRIPTION_FILE)) {
			return readFileSync(DESCRIPTION_FILE, "utf8").trim();
		}
	} catch {}
	return "Manage persistent curated memory across sessions (add, replace, remove, list).";
}

/**
 * Execute memory tool action on Markdown stores.
 *
 * @param {object} args
 * @param {"add" | "replace" | "remove" | "list"} args.action
 * @param {string} [args.content]
 * @param {string} [args.old_text]
 * @param {"project" | "global"} [args.scope]
 * @param {object} [context] Tool execution context from OpenCode
 * @param {string} [context.directory] Project directory
 * @returns {Promise<{ output: string }>}
 */
export async function executeMemoryTool(args, context = {}) {
	const action = args?.action;
	const content = typeof args?.content === "string" ? args.content.trim() : "";
	const oldText =
		typeof args?.old_text === "string" ? args.old_text.trim() : "";
	const scope = args?.scope === "global" ? "global" : "project";
	const directory = context?.directory || process.cwd();

	const targetFile =
		scope === "global" ? GLOBAL_FILE : resolveTargetMemoryFile(directory);

	// --- 1. ACTION: ADD ---
	if (action === "add") {
		if (!content) {
			return {
				output: "Error: `content` is required when adding a memory entry.",
			};
		}

		// Security check: scan for leaked secrets
		const findings = scanContentForSecrets(content);
		if (findings.length > 0) {
			return {
				output: `Error: Memory content blocked by security scanner. Secrets detected: ${findings.map((f) => f.type).join(", ")}.`,
			};
		}

		// Append directly to target Markdown file
		appendMemory(targetFile, content);

		return {
			output: `Memory added successfully (${scope} scope): "${content}"`,
		};
	}

	// --- 2. ACTION: REPLACE ---
	if (action === "replace") {
		if (!oldText) {
			return {
				output:
					"Error: `old_text` is required to identify the memory entry to replace.",
			};
		}
		if (!content) {
			return {
				output:
					"Error: `content` (replacement text) is required when replacing a memory entry.",
			};
		}

		// Security check
		const findings = scanContentForSecrets(content);
		if (findings.length > 0) {
			return {
				output: `Error: Replacement memory content blocked by security scanner: ${findings.map((f) => f.type).join(", ")}.`,
			};
		}

		// Find matching active entries across target scope
		const targetScope = args?.scope ? scope : undefined;
		const entries = listMemoryEntries(directory, targetScope);

		const needle = oldText.toLowerCase();
		const matches = entries.filter((e) =>
			e.content.toLowerCase().includes(needle),
		);

		if (matches.length === 0) {
			return {
				output: `Error: No active memory found matching "${oldText}". Use action 'list' to view available memories.`,
			};
		}

		if (matches.length > 1) {
			const preview = matches
				.slice(0, 3)
				.map((m) => `  - (${m.scope}) "${m.content}"`)
				.join("\n");
			return {
				output: `Error: Ambiguous match: "${oldText}" matches ${matches.length} memory entries. Please provide a more specific substring.\nMatches:\n${preview}`,
			};
		}

		const match = matches[0];
		replaceMemory(match.file, match.content, content);

		return {
			output: `Memory replaced successfully (${match.scope} scope):\n  Old: "${match.content}"\n  New: "${content}"`,
		};
	}

	// --- 3. ACTION: REMOVE ---
	if (action === "remove") {
		if (!oldText) {
			return {
				output:
					"Error: `old_text` is required to identify the memory entry to remove.",
			};
		}

		const targetScope = args?.scope ? scope : undefined;
		const entries = listMemoryEntries(directory, targetScope);

		const needle = oldText.toLowerCase();
		const matches = entries.filter((e) =>
			e.content.toLowerCase().includes(needle),
		);

		if (matches.length === 0) {
			return {
				output: `Error: No active memory found matching "${oldText}". Use action 'list' to view available memories.`,
			};
		}

		if (matches.length > 1) {
			const preview = matches
				.slice(0, 3)
				.map((m) => `  - (${m.scope}) "${m.content}"`)
				.join("\n");
			return {
				output: `Error: Ambiguous match: "${oldText}" matches ${matches.length} memory entries. Please provide a more specific substring.\nMatches:\n${preview}`,
			};
		}

		const match = matches[0];
		removeMemory(match.file, match.content);

		return {
			output: `Memory removed successfully (${match.scope} scope): "${match.content}"`,
		};
	}

	// --- 4. ACTION: LIST ---
	if (action === "list" || !action) {
		const targetScope = args?.scope ? scope : undefined;
		const entries = listMemoryEntries(directory, targetScope);

		if (entries.length === 0) {
			return {
				output:
					"Memory is currently empty. Use action 'add' to save new memories.",
			};
		}

		const lines = entries.map((e) => `• [${e.scope}] ${e.content}`);

		return {
			output: `Active Memories (${entries.length} entries):\n${lines.join("\n")}`,
		};
	}

	return {
		output: `Error: Unknown action "${action}". Valid actions: 'add', 'replace', 'remove', 'list'.`,
	};
}

/**
 * Factory for the OpenCode memory tool definition.
 *
 * @param {object} [opts]
 * @param {string} [opts.directory]
 * @returns {object} OpenCode tool definition
 */
export function createMemoryTool(opts = {}) {
	const description = loadToolDescription();

	return {
		description,
		args: {
			action: {
				type: "string",
				enum: ["add", "replace", "remove", "list"],
				description:
					"The memory operation to perform: 'add', 'replace', 'remove', or 'list'.",
			},
			content: {
				type: "string",
				description:
					"Memory content text to save or replace with (required for 'add' and 'replace').",
			},
			old_text: {
				type: "string",
				description:
					"Unique substring of an existing memory entry to identify it (required for 'replace' and 'remove').",
			},
			scope: {
				type: "string",
				enum: ["project", "global"],
				description:
					"Memory scope: 'project' (repo-specific convention, default) or 'global' (user preference).",
			},
		},
		async execute(args, toolCtx) {
			const ctx = {
				directory: toolCtx?.directory || opts.directory || process.cwd(),
				...toolCtx,
			};
			const res = await executeMemoryTool(args, ctx);
			return res.output;
		},
	};
}

/**
 * memory/tool.js — Native OpenCode agent tool for memory management.
 *
 * Hermes-style multi-target memory tool supporting atomic batch operations
 * and legacy single-op calls across user, global, and project stores:
 *   - user: USER.md (user profile, communication habits, persona)
 *   - global: MEMORY.md (global environment notes, CLI quirks, tools)
 *   - project: projects/<slug>/MEMORY.md (codebase rules, test commands, architecture)
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
	normalizeTarget,
	getMemoryUsage,
	getMemoryBudget,
	checkMemoryBudget,
	readMemory,
	parseBullets,
	isGlobalDirectory,
	DEFAULT_BUDGETS,
} from "./store.js";
import { scanContentForSecrets } from "../share/security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESCRIPTION_FILE = path.join(__dirname, "memory.txt");

export function loadToolDescription() {
	try {
		if (existsSync(DESCRIPTION_FILE)) {
			return readFileSync(DESCRIPTION_FILE, "utf8").trim();
		}
	} catch {}
	return "Manage persistent curated memory across sessions (user, global, and project targets).";
}

/**
 * Explicit JSON Schema definition to override OpenCode's legacyJsonSchema
 * which mistakenly marks all arguments as required.
 */
export const MEMORY_JSON_SCHEMA = {
	type: "object",
	properties: {
		target: {
			type: "string",
			enum: ["user", "global", "project"],
			description:
				"Target memory store: 'user' for user profile, 'global' for personal/environment notes, 'project' for repo conventions.",
		},
		scope: {
			type: "string",
			enum: ["user", "global", "project"],
			description: "Alias for target.",
		},
		action: {
			type: "string",
			enum: ["add", "replace", "remove", "list"],
			description:
				"The memory operation to perform (single-op shape). Omit when using 'operations'.",
		},
		content: {
			type: "string",
			description:
				"Memory content to save or replace with (single-op shape). Alias: 'new_text'.",
		},
		new_text: {
			type: "string",
			description: "Alias for content.",
		},
		old_text: {
			type: "string",
			description:
				"Unique substring of existing memory entry to identify it (required for 'replace' and 'remove').",
		},
		operations: {
			type: "array",
			description:
				"Hermes batch shape: list of atomic operations applied together [{ action, content?, old_text?, target? }].",
			items: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["add", "replace", "remove"],
					},
					content: {
						type: "string",
						description: "Entry content for add/replace.",
					},
					new_text: {
						type: "string",
						description: "Alias for content.",
					},
					old_text: {
						type: "string",
						description: "Substring identifying entry for replace/remove.",
					},
					target: {
						type: "string",
						enum: ["user", "global", "project"],
					},
				},
				required: ["action"],
			},
		},
	},
	required: [],
};

/**
 * Execute atomic batch operations across memory targets.
 * Validates all actions, secret patterns, and budget limits before modifying disk.
 */
async function executeBatchOperations(
	operations,
	rootTarget,
	directory,
	budgets,
) {
	if (!Array.isArray(operations) || operations.length === 0) {
		return { output: "Error: 'operations' array must not be empty." };
	}

	// 1. Pre-validation pass
	const prepared = [];
	for (let i = 0; i < operations.length; i++) {
		const op = operations[i];
		const action = op?.action;
		const target = normalizeTarget(op?.target || rootTarget);
		const content = String(op?.content ?? op?.new_text ?? "").trim();
		const oldText = String(op?.old_text ?? "").trim();

		if (!["add", "replace", "remove"].includes(action)) {
			return {
				output: `Error: Operation #${i + 1} has invalid action '${action}'. Must be 'add', 'replace', or 'remove'.`,
			};
		}

		if (action === "add" && !content) {
			return {
				output: `Error: Operation #${i + 1} ('add') requires non-empty 'content'.`,
			};
		}

		if ((action === "replace" || action === "remove") && !oldText) {
			return {
				output: `Error: Operation #${i + 1} ('${action}') requires 'old_text' to identify existing memory.`,
			};
		}

		if (action === "replace" && !content) {
			return {
				output: `Error: Operation #${i + 1} ('replace') requires non-empty replacement 'content'.`,
			};
		}

		if (content) {
			const findings = scanContentForSecrets(content);
			if (findings.length > 0) {
				return {
					output: `Error: Operation #${i + 1} blocked by security scanner. Secrets detected: ${findings.map((f) => f.type).join(", ")}.`,
				};
			}
		}

		prepared.push({ action, target, content, oldText, index: i });
	}

	// 2. Simulation pass to verify substring matches and character budgets
	const simulatedStores = new Map();
	function getSimulated(target) {
		if (!simulatedStores.has(target)) {
			const file = resolveTargetMemoryFile(target, directory);
			const raw = readMemory(file);
			const bullets = parseBullets(raw);
			simulatedStores.set(target, { file, bullets: [...bullets] });
		}
		return simulatedStores.get(target);
	}

	for (const op of prepared) {
		const sim = getSimulated(op.target);
		if (op.action === "add") {
			sim.bullets.push(op.content);
		} else {
			const needle = op.oldText.toLowerCase();
			const matchIndices = sim.bullets
				.map((b, idx) => (b.toLowerCase().includes(needle) ? idx : -1))
				.filter((idx) => idx !== -1);

			if (matchIndices.length === 0) {
				return {
					output: `Error: Operation #${op.index + 1} ('${op.action}'): No active memory found matching "${op.oldText}" in target '${op.target}'.`,
				};
			}
			if (matchIndices.length > 1) {
				return {
					output: `Error: Operation #${op.index + 1} ('${op.action}'): Ambiguous match: "${op.oldText}" matches ${matchIndices.length} entries in target '${op.target}'. Provide a more specific substring.`,
				};
			}

			const targetIdx = matchIndices[0];
			if (op.action === "replace") {
				sim.bullets[targetIdx] = op.content;
			} else if (op.action === "remove") {
				sim.bullets.splice(targetIdx, 1);
			}
		}
	}

	// 3. Check final character budget for all touched targets
	for (const [target, sim] of simulatedStores.entries()) {
		const simulatedText = sim.bullets.map((b) => `- ${b}`).join("\n");
		const budgetCheck = checkMemoryBudget(
			sim.file,
			simulatedText,
			target,
			budgets,
		);
		if (!budgetCheck.ok) {
			return { output: `Error: ${budgetCheck.error}` };
		}
	}

	// 4. Execution pass (apply changes sequentially)
	let addedCount = 0;
	let replacedCount = 0;
	let removedCount = 0;
	const touchedTargets = new Set();

	for (const op of prepared) {
		const file = resolveTargetMemoryFile(op.target, directory);
		touchedTargets.add(op.target);
		if (op.action === "add") {
			appendMemory(file, op.content);
			addedCount++;
		} else if (op.action === "replace") {
			replaceMemory(file, op.oldText, op.content);
			replacedCount++;
		} else if (op.action === "remove") {
			removeMemory(file, op.oldText);
			removedCount++;
		}
	}

	const targetsList = Array.from(touchedTargets).join(", ");
	const summaryParts = [];
	if (addedCount > 0) summaryParts.push(`${addedCount} added`);
	if (replacedCount > 0) summaryParts.push(`${replacedCount} replaced`);
	if (removedCount > 0) summaryParts.push(`${removedCount} removed`);

	const usageReports = Array.from(touchedTargets)
		.map((t) => {
			const file = resolveTargetMemoryFile(t, directory);
			const u = getMemoryUsage(file, t, budgets);
			return `${t}: ${u.usage}`;
		})
		.join("; ");

	return {
		output:
			`✓ Batch memory update applied (${summaryParts.join(", ")}) across targets [${targetsList}].\n` +
			`Usage: ${usageReports}.\n` +
			`Note: Write saved. This update is complete — do not repeat it.`,
	};
}

/**
 * Execute single memory tool action on Markdown stores.
 */
export async function executeMemoryTool(args, context = {}) {
	const directory = context?.directory || process.cwd();
	const budgets = context?.budgets || DEFAULT_BUDGETS;

	// Resolve target: explicit target || explicit scope || default by directory
	let target = "project";
	if (args?.target || args?.scope) {
		target = normalizeTarget(args.target || args.scope);
	} else if (isGlobalDirectory(directory)) {
		target = "global";
	}

	// 1. Hermes Batch Execution
	if (Array.isArray(args?.operations) && args.operations.length > 0) {
		return executeBatchOperations(args.operations, target, directory, budgets);
	}

	const action = args?.action;
	const content = String(args?.content ?? args?.new_text ?? "").trim();
	const oldText = String(args?.old_text ?? "").trim();
	const targetFile = resolveTargetMemoryFile(target, directory);

	// 2. ACTION: ADD
	if (action === "add") {
		if (!content) {
			return {
				output: "Error: `content` is required when adding a memory entry.",
			};
		}

		const findings = scanContentForSecrets(content);
		if (findings.length > 0) {
			return {
				output: `Error: Memory content blocked by security scanner. Secrets detected: ${findings.map((f) => f.type).join(", ")}.`,
			};
		}

		const existing = readMemory(targetFile);
		const candidate = `${existing}\n- ${content}`;
		const budgetCheck = checkMemoryBudget(
			targetFile,
			candidate,
			target,
			budgets,
		);
		if (!budgetCheck.ok) {
			return { output: `Error: ${budgetCheck.error}` };
		}

		appendMemory(targetFile, content);
		const usage = getMemoryUsage(targetFile, target, budgets);

		return {
			output:
				`Memory added successfully (${target} store, ${usage.usage}): "${content}"\n` +
				`Note: Write saved. This update is complete — do not repeat it.`,
		};
	}

	// 3. ACTION: REPLACE
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

		const findings = scanContentForSecrets(content);
		if (findings.length > 0) {
			return {
				output: `Error: Replacement memory content blocked by security scanner: ${findings.map((f) => f.type).join(", ")}.`,
			};
		}

		const entries = listMemoryEntries(directory, target);
		const needle = oldText.toLowerCase();
		const matches = entries.filter((e) =>
			e.content.toLowerCase().includes(needle),
		);

		if (matches.length === 0) {
			return {
				output: `Error: No active memory found matching "${oldText}" in target '${target}'. Use action 'list' to inspect available memories.`,
			};
		}

		if (matches.length > 1) {
			const preview = matches
				.slice(0, 3)
				.map((m) => `  - (${m.target}) "${m.content}"`)
				.join("\n");
			return {
				output: `Error: Ambiguous match: "${oldText}" matches ${matches.length} memory entries. Please provide a more specific substring.\nMatches:\n${preview}`,
			};
		}

		const match = matches[0];
		replaceMemory(match.file, match.content, content);
		const usage = getMemoryUsage(match.file, match.target, budgets);

		return {
			output:
				`Memory replaced successfully (${match.target} store, ${usage.usage}):\n` +
				`  Old: "${match.content}"\n` +
				`  New: "${content}"\n` +
				`Note: Write saved. This update is complete — do not repeat it.`,
		};
	}

	// 4. ACTION: REMOVE
	if (action === "remove") {
		if (!oldText) {
			return {
				output:
					"Error: `old_text` is required to identify the memory entry to remove.",
			};
		}

		const entries = listMemoryEntries(directory, target);
		const needle = oldText.toLowerCase();
		const matches = entries.filter((e) =>
			e.content.toLowerCase().includes(needle),
		);

		if (matches.length === 0) {
			return {
				output: `Error: No active memory found matching "${oldText}" in target '${target}'. Use action 'list' to inspect available memories.`,
			};
		}

		if (matches.length > 1) {
			const preview = matches
				.slice(0, 3)
				.map((m) => `  - (${m.target}) "${m.content}"`)
				.join("\n");
			return {
				output: `Error: Ambiguous match: "${oldText}" matches ${matches.length} memory entries. Please provide a more specific substring.\nMatches:\n${preview}`,
			};
		}

		const match = matches[0];
		removeMemory(match.file, match.content);
		const usage = getMemoryUsage(match.file, match.target, budgets);

		return {
			output:
				`Memory removed successfully (${match.target} store, ${usage.usage}): "${match.content}"\n` +
				`Note: Write saved. This update is complete — do not repeat it.`,
		};
	}

	// 5. ACTION: LIST
	if (action === "list" || !action) {
		const targetFilter = args?.target || args?.scope ? target : "all";
		const entries = listMemoryEntries(directory, targetFilter);

		if (entries.length === 0) {
			return {
				output:
					"Memory is currently empty. Use action 'add' or 'operations' to save memories.",
			};
		}

		const lines = entries.map((e) => `• [${e.target}] ${e.content}`);
		return {
			output: `Active Memories (${entries.length} entries):\n${lines.join("\n")}`,
		};
	}

	return {
		output: `Error: Unknown action "${action}". Valid actions: 'add', 'replace', 'remove', 'list', or batch 'operations'.`,
	};
}

/**
 * Factory for OpenCode memory tool definition.
 */
export function createMemoryTool(opts = {}) {
	const description = loadToolDescription();

	return {
		description,
		args: {
			target: {
				type: "string",
				enum: ["user", "global", "project"],
				description:
					"Target memory store: 'user' for user profile, 'global' for personal/environment notes, 'project' for repo conventions.",
			},
			scope: {
				type: "string",
				enum: ["user", "global", "project"],
				description: "Alias for target.",
			},
			action: {
				type: "string",
				enum: ["add", "replace", "remove", "list"],
				description:
					"The memory operation to perform (single-op shape). Omit when using 'operations'.",
			},
			content: {
				type: "string",
				description:
					"Memory content text to save or replace with (required for 'add' and 'replace').",
			},
			new_text: {
				type: "string",
				description: "Alias for content.",
			},
			old_text: {
				type: "string",
				description:
					"Unique substring of an existing memory entry to identify it (required for 'replace' and 'remove').",
			},
			operations: {
				type: "array",
				description:
					"Hermes batch operations applied atomically [{ action, content?, old_text?, target? }].",
			},
		},
		async execute(args, toolCtx) {
			const ctx = {
				directory: toolCtx?.directory || opts.directory || process.cwd(),
				budgets: opts?.budgets || opts?.config?.memory?.budgets,
				...toolCtx,
			};
			const res = await executeMemoryTool(args, ctx);
			return res.output;
		},
	};
}

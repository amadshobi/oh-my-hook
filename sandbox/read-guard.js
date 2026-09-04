/**
 * sandbox/read-guard.js — Command Code-style read-before-write & stale-write
 * enforcement.
 *
 * - Tracks files the model has read (via tool.execute.after on `read`).
 * - Blocks `write`/`edit`/`patch` on existing files that were never read
 *   this session (read-before-write).
 * - Intercepts file mutation attempts in bash (cat >, echo >, tee, sed -i).
 * - Blocks writes when the on-disk file changed after the model read it
 *   (stale-write).
 * - New files (that don't exist yet) are always allowed.
 * - Auto-updates ledger on successful write/edit/patch to avoid self-stale lockout.
 * - Exports a `refreshReads` helper so other plugins can re-mark files.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { formatBlockMessage } from "../share/messages.js";
import {
	loadLedger,
	saveLedger,
	markRead,
	wasRead,
	isStale,
	statOf,
	cleanupSessionLedger,
} from "../share/state.js";
import { toolArgs, filePathOf, bashCommand } from "../share/hook.js";
import { normalizeSandboxConfig } from "../share/config.js";

// Tools that mutate file content (write path).
const WRITE_TOOLS = new Set(["write", "edit", "patch", "create"]);

// Tools that count as "reading" a file for the ledger.
const READ_TOOLS = new Set(["read"]);

// Skip enforcing for files outside the workspace root (config files etc.).
function isInsideWorkspace(filePath, cwd) {
	try {
		const normalized = path.resolve(filePath).split(path.sep).join("/");
		const root = path
			.resolve(cwd ?? process.cwd())
			.split(path.sep)
			.join("/");
		return normalized.startsWith(root + "/") || normalized === root;
	} catch {
		return false;
	}
}

function existsOnDisk(filePath) {
	try {
		return existsSync(filePath);
	} catch {
		return false;
	}
}

/**
 * Extract target file paths from mutating bash commands (>, >>, tee, sed -i).
 *
 * @param {string} command
 * @returns {string[]}
 */
export function extractBashMutationTargets(command) {
	if (!command || typeof command !== "string") return [];
	const targets = [];
	let match;

	// 1. Redirections: > file or >> file (excluding > /dev/null, 2>&1)
	const REDIRECT_OUT_RE = />{1,2}\s*([^\s|;&\n]+)/g;
	while ((match = REDIRECT_OUT_RE.exec(command)) !== null) {
		const raw = match[1].replace(/^["']|["']$/g, "").trim();
		if (
			raw &&
			!raw.startsWith("/dev/") &&
			!raw.startsWith("&") &&
			!raw.startsWith("$")
		) {
			targets.push(raw);
		}
	}

	// 2. tee [-a] file
	const TEE_RE = /\btee\s+(?:-[a-zA-Z]+\s+)*([^\s|;&\n]+)/gi;
	while ((match = TEE_RE.exec(command)) !== null) {
		const raw = match[1].replace(/^["']|["']$/g, "").trim();
		if (
			raw &&
			!raw.startsWith("-") &&
			!raw.startsWith("/dev/") &&
			!raw.startsWith("$")
		) {
			targets.push(raw);
		}
	}

	// 3. sed -i [suffix] ... file
	const SED_RE = /\bsed\s+.*?-i[^\s]*\s+.*?\s+([^\s|;&\n]+)$/gi;
	while ((match = SED_RE.exec(command)) !== null) {
		const raw = match[1].replace(/^["']|["']$/g, "").trim();
		if (raw && !raw.startsWith("-") && !raw.startsWith("$")) {
			targets.push(raw);
		}
	}

	return targets;
}

export function createReadGuard({ directory, config, messages } = {}) {
	const rawCfg = config?.guard ?? config?.sandbox ?? config ?? {};
	const cfg = normalizeSandboxConfig(rawCfg);
	const readCfg = cfg.readGuard;
	const readBeforeWrite = readCfg?.readBeforeWrite ?? true;
	const staleWrite = readCfg?.staleWrite ?? true;
	const interceptBash = readCfg?.interceptBashMutation ?? true;
	const messagesConfig = messages ?? config?.messages ?? {};

	return {
		event: async ({ event }) => {
			if (event?.type === "session.deleted") {
				const sessionID = event.properties?.sessionID;
				if (sessionID) {
					const ledger = loadLedger();
					cleanupSessionLedger(ledger, sessionID);
					saveLedger(ledger);
				}
			}
		},

		"tool.execute.after": async (input, output) => {
			const tool = input?.tool;
			const args = toolArgs(input, output);
			const sessionID = input?.sessionID || "global";

			// 1. Reading file -> mark in ledger
			if (READ_TOOLS.has(tool)) {
				const filePath = filePathOf(args);
				if (!filePath) return;
				const ledger = loadLedger();
				const st = statOf(filePath);
				markRead(
					ledger,
					filePath,
					{ mtimeMs: st?.mtimeMs, size: st?.size },
					sessionID,
				);
				saveLedger(ledger);
				return;
			}

			// 2. Successful mutation via tool -> update ledger mtime to prevent self-stale lockout
			if (WRITE_TOOLS.has(tool)) {
				const filePath = filePathOf(args);
				if (!filePath) return;
				const ledger = loadLedger();
				const st = statOf(filePath);
				if (st) {
					markRead(
						ledger,
						filePath,
						{ mtimeMs: st?.mtimeMs, size: st?.size },
						sessionID,
					);
					saveLedger(ledger);
				}
				return;
			}

			// 3. Successful mutation via bash -> update ledger mtime
			if (tool === "bash" && interceptBash) {
				const command = bashCommand(args);
				if (!command) return;
				const mutatedFiles = extractBashMutationTargets(command);
				if (mutatedFiles.length > 0) {
					const ledger = loadLedger();
					for (const rawFile of mutatedFiles) {
						const filePath = path.isAbsolute(rawFile)
							? path.normalize(rawFile)
							: path.resolve(directory || process.cwd(), rawFile);
						const st = statOf(filePath);
						if (st) {
							markRead(
								ledger,
								filePath,
								{ mtimeMs: st.mtimeMs, size: st.size },
								sessionID,
							);
						}
					}
					saveLedger(ledger);
				}
			}
		},

		"tool.execute.before": async (input, output) => {
			const tool = input?.tool;
			const sessionID = input?.sessionID || "global";

			// 1. Mutating tool guard (write, edit, patch)
			if (WRITE_TOOLS.has(tool)) {
				const args = toolArgs(input, output);
				const filePath = filePathOf(args);
				if (!filePath) return;

				if (!isInsideWorkspace(filePath, directory)) return;
				if (!existsOnDisk(filePath)) return;

				const ledger = loadLedger();

				if (readBeforeWrite && !wasRead(ledger, filePath, sessionID)) {
					throw new Error(
						formatBlockMessage(
							"readGuardUnread",
							{ file: filePath, path: filePath },
							messagesConfig,
						),
					);
				}

				if (staleWrite && isStale(ledger, filePath, sessionID)) {
					throw new Error(
						formatBlockMessage(
							"readGuardStale",
							{ file: filePath, path: filePath },
							messagesConfig,
						),
					);
				}

				saveLedger(ledger);
			}

			// 2. Intercept bash file mutations (cat >, echo >, sed -i, tee)
			if (tool === "bash" && interceptBash) {
				const args = toolArgs(input, output);
				const command = bashCommand(args);
				if (!command) return;

				const mutatedFiles = extractBashMutationTargets(command);
				if (mutatedFiles.length === 0) return;

				const ledger = loadLedger();
				for (const rawFile of mutatedFiles) {
					const filePath = path.isAbsolute(rawFile)
						? path.normalize(rawFile)
						: path.resolve(directory || process.cwd(), rawFile);

					if (!isInsideWorkspace(filePath, directory)) continue;
					if (!existsOnDisk(filePath)) continue;

					if (readBeforeWrite && !wasRead(ledger, filePath, sessionID)) {
						throw new Error(
							formatBlockMessage(
								"readGuardUnread",
								{ file: path.basename(filePath), path: filePath },
								messagesConfig,
							),
						);
					}

					if (staleWrite && isStale(ledger, filePath, sessionID)) {
						throw new Error(
							formatBlockMessage(
								"readGuardStale",
								{ file: path.basename(filePath), path: filePath },
								messagesConfig,
							),
						);
					}
				}
				saveLedger(ledger);
			}
		},
	};
}

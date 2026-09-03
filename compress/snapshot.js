/**
 * compress/snapshot.js — Compaction snapshot, session tracking, and prompt analysis.
 *
 * Injects git status + pending todos into the compaction prompt so the model
 * retains awareness of repo state and unfinished tasks after compaction.
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { readJson, writeJson, statePath } from "../share/state.js";
import { createNotifier } from "../share/notify.js";
import { appendDebugEvent } from "./debug.js";

// State files live in the XDG data dir (~/.local/share/opencode) so
// ~/.opencode stays clean — same convention as other oh-my-hook state.
const CONTEXT_FILE = statePath("session-context.json");
const LEARNINGS_DIR = statePath("learnings");

export function loadContext() {
	return readJson(CONTEXT_FILE, {});
}

export function saveContext(context) {
	writeJson(CONTEXT_FILE, context);
}

export function detectPackageManager(cwd) {
	const markers = [
		["pnpm-lock.yaml", "pnpm"],
		["yarn.lock", "yarn"],
		["bun.lock", "bun"],
		["bun.lockb", "bun"],
		["Pipfile.lock", "pipenv"],
		["poetry.lock", "poetry"],
		["go.sum", "go"],
		["Cargo.lock", "cargo"],
	];
	for (const [file, name] of markers) {
		if (existsSync(path.join(cwd, file))) return name;
	}
	return "npm";
}

export function gitSnapshot(cwd) {
	if (!existsSync(path.join(cwd, ".git"))) {
		return { info: "Not a git repository / No active branch", status: "" };
	}
	try {
		const branch = execFileSync("git", ["branch", "--show-current"], {
			cwd,
			stdio: "pipe",
		})
			.toString()
			.trim();
		const status = execFileSync("git", ["status", "--short"], {
			cwd,
			stdio: "pipe",
		})
			.toString()
			.trim();
		return { info: `Branch: \`${branch || "HEAD"}\``, status };
	} catch {
		return { info: "Git error", status: "" };
	}
}

export function pendingTodos(cwd) {
	const todoFile = path.join(cwd, ".opencode", "todos.json");
	if (!existsSync(todoFile)) return null;
	try {
		const todos = JSON.parse(readFileSync(todoFile, "utf8"));
		if (!Array.isArray(todos)) return null;
		const pending = todos.filter((t) => !t.done);
		if (pending.length === 0) return "  - All tasks completed.";
		return pending
			.map((t) => `  - [ ] ${t.task || t.content || JSON.stringify(t)}`)
			.join("\n");
	} catch {
		return null;
	}
}

const VAGUE_WORDS = ["fix", "update", "change", "modify", "improve", "do"];

export function analyzePrompt(prompt) {
	const words = prompt.split(/\s+/).filter(Boolean);
	const warnings = [];
	if (words.length < 3) {
		warnings.push(
			"Very short prompt. Consider adding more context about what you want to achieve.",
		);
	}
	const lowered = words.map((w) => w.toLowerCase());
	if (words.length < 5 && VAGUE_WORDS.some((w) => lowered.includes(w))) {
		warnings.push("Prompt may be vague. Specify what to fix/update and where.");
	}
	if (prompt.includes("everything") || prompt.includes("all files")) {
		warnings.push(
			"Broad scope detected. Consider narrowing to specific files or modules.",
		);
	}
	return { warnings, wordCount: words.length };
}

export const snapshotHooks = async ({ client, directory }, opts = {}) => {
	const cfg = opts?.config ?? {};
	const snapCfg = cfg.snapshot ?? cfg;
	const compactionSnapshot =
		snapCfg.compactionSnapshot ?? cfg.compactionSnapshot ?? true;
	const promptCheck = snapCfg.promptCheck ?? cfg.promptCheck ?? true;
	const compactThreshold =
		snapCfg.compactThreshold ?? cfg.compactThreshold ?? 50;

	const notify = createNotifier(client, "compress", "info");
	const editCounter = { count: 0 };
	const remindersFile = path.join(
		directory || os.homedir(),
		".opencode",
		"reminders.md",
	);

	const readReminders = () => {
		try {
			if (existsSync(remindersFile))
				return readFileSync(remindersFile, "utf8").trim();
		} catch {}
		return "";
	};

	return {
		event: async ({ event }) => {
			if (!event) return;
			const cwd = directory || process.cwd();

			if (event.type === "session.created") {
				const context = loadContext();
				const lastSession = context[cwd];
				const pkgManager = detectPackageManager(cwd);

				const sessionInfo = {
					packageManager: pkgManager,
					startedAt: new Date().toISOString(),
				};
				if (lastSession) {
					sessionInfo.previousSession = {
						lastActive: lastSession.lastActive,
						editCount: lastSession.editCount || 0,
						notes: lastSession.notes || "",
					};
				}
				context[cwd] = { ...context[cwd], ...sessionInfo };
				saveContext(context);

				await notify(`Session started in ${cwd} (pkg: ${pkgManager})`);
			}

			if (event.type === "session.idle" || event.type === "session.deleted") {
				const context = loadContext();
				const sessionData = context[cwd] || {};
				sessionData.lastActive = new Date().toISOString();
				sessionData.sessionEnd = new Date().toISOString();
				sessionData.editCount = editCounter.count;
				context[cwd] = sessionData;
				saveContext(context);

				try {
					mkdirSync(LEARNINGS_DIR, { recursive: true });
					const today = new Date().toISOString().slice(0, 10);
					const logFile = path.join(LEARNINGS_DIR, `${today}.json`);
					const learnings = readJson(logFile, []);
					const entry = {
						timestamp: new Date().toISOString(),
						project: path.basename(cwd),
						path: cwd,
						editCount: editCounter.count,
					};
					try {
						const log = execFileSync(
							"git",
							["log", "--oneline", "-5", "--since=4 hours ago"],
							{ cwd, stdio: "pipe" },
						)
							.toString()
							.trim();
						if (log) entry.recentCommits = log.split("\n").map((l) => l.trim());
						const diff = execFileSync("git", ["diff", "--stat"], {
							cwd,
							stdio: "pipe",
						})
							.toString()
							.trim();
						if (diff) entry.uncommittedChanges = diff.split("\n").length;
					} catch {}
					learnings.push(entry);
					writeJson(logFile, learnings.slice(-100));
				} catch {}
			}
		},

		"experimental.session.compacting": async (input, output) => {
			if (!compactionSnapshot) return;
			const cwd = directory || process.cwd();
			const git = gitSnapshot(cwd);
			const todos = pendingTodos(cwd);
			const reminders = readReminders();

			const contextBlock = [
				"## Current Session Snapshot",
				`- **Project Path:** \`${cwd}\``,
				`- **Git Context:** ${git.info}`,
				"",
				"### Modified / Uncommitted Files:",
				git.status
					? git.status
							.split("\n")
							.map((l) => `  - ${l}`)
							.join("\n")
					: "  - Clean working tree",
				"",
				"### Pending Tasks:",
				todos ?? "  - No pending todos recorded.",
			];

			if (reminders) {
				contextBlock.push("", "### Standing Reminders:", reminders);
			}

			output.context = output.context || [];
			output.context.push(contextBlock.join("\n"));
			await notify("Injected session snapshot into compaction prompt");
			appendDebugEvent(
				input?.sessionID || "global",
				{
					kind: "compact",
					type: "COMPACT (session.compacting)",
					detail: `Snapshot injected into compaction prompt (${cwd})`,
				},
				cfg,
				{
					enabled: snapCfg.debug?.enabled !== false,
					maxSessions: snapCfg.debug?.maxSessions,
				},
			);
		},

		"chat.message": async (input, output) => {
			if (!promptCheck) return;
			try {
				const text = output?.message?.text || output?.message?.content || "";
				if (typeof text === "string" && text.trim()) {
					const analysis = analyzePrompt(text);
					if (analysis.warnings.length > 0) {
						await notify(
							`Prompt check (${analysis.wordCount} words): ${analysis.warnings.join(" | ")}`,
						);
					}
				}
			} catch {}
		},

		"tool.execute.after": async (input) => {
			if (input.tool !== "write" && input.tool !== "edit") return;
			editCounter.count += 1;
			const cwd = directory || process.cwd();

			const context = loadContext();
			const sessionData = context[cwd] || {};
			sessionData.editCount = editCounter.count;
			sessionData.lastActive = new Date().toISOString();
			context[cwd] = sessionData;
			saveContext(context);

			if (editCounter.count > 0 && editCounter.count % compactThreshold === 0) {
				await notify(
					`You have made ${editCounter.count} edits this session. Consider running /compress to free up context window space.`,
				);
			}

			if (editCounter.count > 5) {
				const hasTestCmd = ["package.json", "pyproject.toml", "Makefile"].some(
					(f) => existsSync(path.join(cwd, f)),
				);
				if (hasTestCmd) {
					await notify(
						`${editCounter.count} files modified. Consider running the test suite before wrapping up.`,
					);
				}
			}
		},

		dispose: async () => {
			const cwd = directory || process.cwd();
			const context = loadContext();
			const sessionData = context[cwd] || {};
			sessionData.lastActive = new Date().toISOString();
			sessionData.sessionEnd = new Date().toISOString();
			sessionData.editCount = editCounter.count;
			context[cwd] = sessionData;
			saveContext(context);
		},
	};
};

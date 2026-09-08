/**
 * compress/automation.js — Post-push milestone detection and idle auto-compaction.
 *
 * Automatically triggers compaction snapshots when a successful git push
 * is detected, once the session enters an idle state.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { recordCompaction } from "./stats.js";
import { appendDebugEvent } from "./debug.js";
import { createNotifier } from "../share/notify.js";

const MAX_AUTOMATION_SESSIONS = 100;
const pushMilestones = new Map();
const sessionAutoCompactState = new Map();

/**
 * Set a key-value pair in a Map, evicting the oldest key if size exceeds maxSize.
 */
function setBounded(map, key, value, maxSize = MAX_AUTOMATION_SESSIONS) {
	if (map.size >= maxSize && !map.has(key)) {
		const oldestKey = map.keys().next().value;
		if (oldestKey !== undefined) {
			map.delete(oldestKey);
		}
	}
	map.set(key, value);
}

/**
 * Reset module-level automation state (for test isolation).
 */
export function _resetAutomationState() {
	pushMilestones.clear();
	sessionAutoCompactState.clear();
}

/**
 * Get current sizes of module-level automation state (for test verification).
 */
export function _getAutomationMapSizes() {
	return {
		pushMilestones: pushMilestones.size,
		sessionAutoCompactState: sessionAutoCompactState.size,
	};
}

/**
 * Check if a command is a successful, non-dry-run git push.
 */
export function isGitPushCommand(command) {
	if (!command || typeof command !== "string") return false;
	return /\bgit\s+push\b/i.test(command) && !/--dry-run/i.test(command);
}

/**
 * Build milestone snapshot string for transcript.
 */
export function buildMilestoneSnapshot(cwd, maxChars = 2500) {
	if (!cwd || !existsSync(path.join(cwd, ".git"))) {
		return "── MILESTONE SNAPSHOT ──\nGit push completed.";
	}

	try {
		const branch = execFileSync("git", ["branch", "--show-current"], {
			cwd,
			stdio: "pipe",
		})
			.toString()
			.trim();
		const recentCommits = execFileSync("git", ["log", "-n", "3", "--oneline"], {
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

		const text = [
			"── MILESTONE SNAPSHOT (Post-Push) ──",
			`Branch: ${branch || "HEAD"}`,
			"Recent Commits:",
			recentCommits || "  No recent commits",
			"Working Tree Status:",
			status
				? status
						.split("\n")
						.map((l) => `  ${l}`)
						.join("\n")
				: "  Clean working tree",
		].join("\n");

		if (text.length > maxChars) {
			return `${text.slice(0, maxChars)}\n... (snapshot truncated)`;
		}
		return text;
	} catch {
		return "── MILESTONE SNAPSHOT ──\nGit push completed.";
	}
}

/**
 * Automation factory for push detection and idle auto-compaction.
 */
export async function automationHooks({ client, directory }, opts = {}) {
	const notify = createNotifier(client, "compress");
	const cfg = opts?.config?.milestones ?? {};
	const enabled = cfg.enabled ?? true;
	const pushAutoCompress = cfg.pushAutoCompress ?? true;
	const minTurnsAfterPush = cfg.minTurnsAfterPush ?? 2;
	const idleCooldownMs = cfg.idleCooldownMs ?? 600000;
	const maxAutoCompressPerSession = cfg.maxAutoCompressPerSession ?? 2;
	const snapshotMaxChars = cfg.snapshotMaxChars ?? 2500;

	const lastIdleBySession = new Map();

	return {
		"tool.execute.after": async (input, output) => {
			if (!enabled || !pushAutoCompress) return;
			const toolName = input?.tool;
			const cmd = input?.args?.command || input?.state?.input?.command || "";
			const sessionID = input?.sessionID || "default";

			if (toolName === "bash" && isGitPushCommand(cmd)) {
				// Record push milestone
				setBounded(pushMilestones, sessionID, {
					pushedAt: Date.now(),
					turnCountAfterPush: 0,
					pushPending: true,
				});
			} else if (pushMilestones.has(sessionID)) {
				const state = pushMilestones.get(sessionID);
				if (state.pushPending) {
					state.turnCountAfterPush += 1;
				}
			}
		},

		event: async (input) => {
			const eventType = input?.event?.type || input?.type;
			const sessionID =
				input?.sessionID ||
				input?.event?.properties?.sessionID ||
				input?.properties?.sessionID ||
				"default";

			// Clean up state when a session is explicitly deleted
			if (eventType === "session.deleted") {
				pushMilestones.delete(sessionID);
				sessionAutoCompactState.delete(sessionID);
				lastIdleBySession.delete(sessionID);
				return;
			}

			if (!enabled || !pushAutoCompress) return;
			if (eventType !== "session.status" && eventType !== "session.idle")
				return;

			const status =
				input?.event?.properties?.status || input?.properties?.status;
			if (eventType === "session.status" && status !== "idle") return;

			// Dedup fast repeated idle events per session
			const now = Date.now();
			const lastIdle = lastIdleBySession.get(sessionID) || 0;
			const throttleMs = Math.min(5000, idleCooldownMs);
			if (throttleMs > 0 && now - lastIdle < throttleMs) return;
			lastIdleBySession.set(sessionID, now);

			const milestone = pushMilestones.get(sessionID);

			if (!milestone || !milestone.pushPending) return;
			if (milestone.turnCountAfterPush < minTurnsAfterPush) return;

			const autoState = sessionAutoCompactState.get(sessionID) || {
				count: 0,
				lastCompactAt: 0,
			};

			if (autoState.count >= maxAutoCompressPerSession) return;
			if (now - autoState.lastCompactAt < idleCooldownMs) return;

			// Execute milestone automation
			milestone.pushPending = false;
			autoState.count += 1;
			autoState.lastCompactAt = now;
			setBounded(sessionAutoCompactState, sessionID, autoState);

			const cwd = directory || process.cwd();
			const snapshotText = buildMilestoneSnapshot(cwd, snapshotMaxChars);

			try {
				// 1. Deliver milestone snapshot to transcript (0 token LLM)
				if (client?.session?.prompt) {
					await client.session.prompt({
						path: { sessionID },
						body: {
							noReply: true,
							parts: [{ type: "text", text: snapshotText, ignored: true }],
						},
					});
				}

				// 2. Trigger auto-compaction
				if (client?.session?.compact) {
					await client.session.compact({
						path: { sessionID },
					});
				}

				recordCompaction(sessionID, { type: "post-push" });
				appendDebugEvent(
					sessionID,
					{
						kind: "compact",
						type: "AUTO-COMPACT (post-push)",
						detail: `Milestone snapshot delivered + compaction triggered (count: ${autoState.count})`,
					},
					cfg,
					{
						enabled: cfg.debug?.enabled !== false,
						maxSessions: cfg.debug?.maxSessions,
					},
				);
				await notify(
					"Post-push milestone reached: session snapshot preserved & compacted",
				);
			} catch (err) {
				// Fail-open: compaction failure should never break session
			}
		},
	};
}

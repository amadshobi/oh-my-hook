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
import { createNotifier } from "../share/notify.js";

const pushMilestones = new Map();
const sessionAutoCompactState = new Map();

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
				pushMilestones.set(sessionID, {
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
			if (!enabled || !pushAutoCompress) return;
			const eventType = input?.event?.type || input?.type;
			if (eventType !== "session.status" && eventType !== "session.idle")
				return;

			const status =
				input?.event?.properties?.status || input?.properties?.status;
			if (eventType === "session.status" && status !== "idle") return;

			const sessionID =
				input?.sessionID ||
				input?.event?.properties?.sessionID ||
				input?.properties?.sessionID ||
				"default";

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
			sessionAutoCompactState.set(sessionID, autoState);

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
				await notify(
					"Post-push milestone reached: session snapshot preserved & compacted",
				);
			} catch (err) {
				// Fail-open: compaction failure should never break session
			}
		},
	};
}

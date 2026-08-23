/**
 * compress/commands.js — Slash command handler for /compress.
 *
 * Deterministic command execution with zero-token transcript delivery
 * and handled sentinel termination.
 */
import { deliverCommandOutput, createHandledError } from "../share/handled.js";
import { getCompressMetrics } from "./stats.js";

/**
 * Format stats markdown for /compress stats output.
 */
export function formatCompressStats(sessionID) {
	const metrics = getCompressMetrics(sessionID);
	const s = metrics.session;
	const g = metrics.global;

	const sessionKb = (s.bytesSaved / 1024).toFixed(1);
	const globalKb = (g.totalBytesSaved / 1024).toFixed(1);

	return [
		"## Context Compression & Pruning Metrics",
		"",
		"### Current Session:",
		`- Pruned Outputs: **${s.prunedCount}**`,
		`- Bytes Saved: **${sessionKb} KB** (${s.bytesSaved.toLocaleString()} bytes)`,
		`- Estimated Tokens Saved: **~${s.tokensSaved.toLocaleString()} tokens**`,
		`- Compactions: **${s.compactions}**`,
		"",
		"### Global Aggregate (Recent Sessions):",
		`- Total Pruned Outputs: **${g.totalPrunedCount}**`,
		`- Total Bytes Saved: **${globalKb} KB**`,
		`- Total Tokens Saved: **~${g.totalTokensSaved.toLocaleString()} tokens**`,
		`- Total Compactions: **${g.totalCompactions}**`,
		g.lastPrunedAt ? `- Last Prune Event: \`${g.lastPrunedAt}\`` : "",
		g.lastCompactedAt ? `- Last Compact Event: \`${g.lastCompactedAt}\`` : "",
	]
		.filter(Boolean)
		.join("\n");
}

/**
 * Format help markdown for /compress help output.
 */
export function formatCompressHelp() {
	return [
		"## Context Compression Commands",
		"",
		"- `/compress`: Trigger immediate session context compaction.",
		"- `/compress stats`: View token savings and pruned output statistics.",
		"- `/compress help`: Display this help guide.",
	].join("\n");
}

/**
 * Slash command hooks factory for /compress.
 */
export async function commandHooks({ client }, opts = {}) {
	const cfg = opts?.config?.commands ?? {};
	const enabled = cfg.compress ?? true;

	return {
		config: async (config) => {
			if (!enabled) return;
			config.command = config.command || {};
			config.command.compress = {
				template: "/compress $ARGUMENTS",
				description:
					"Manage context compaction & pruning (/compress stats, /compress)",
			};
		},

		"command.execute.before": async (input, output) => {
			if (!enabled) return;
			const cmd = input?.command || input?.name;
			if (cmd !== "compress") return;

			const args = (input?.arguments || input?.args || "").trim();
			const sessionID = input?.sessionID || input?.session?.id;

			let text = "";

			if (args === "stats" || args === "--stats" || args === "-s") {
				text = formatCompressStats(sessionID);
			} else if (args === "help" || args === "--help" || args === "-h") {
				text = formatCompressHelp();
			} else {
				// Default /compress: trigger compaction
				if (client?.session?.compact && sessionID) {
					try {
						await client.session.compact({ path: { sessionID } });
					} catch {}
				}
				text = [
					"## Context Compaction Triggered",
					"",
					"Session context compaction requested. Historical messages will be summarized to free context space.",
				].join("\n");
			}

			await deliverCommandOutput(client, sessionID, text, output);
			throw createHandledError();
		},
	};
}

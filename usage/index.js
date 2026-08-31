/**
 * usage/index.js — hook assembler for the usage module.
 *
 * Slash command `/usage` (deterministic, 0-token LLM):
 * - Registered via `config` hook (cfg.command).
 * - Handled in `command.execute.before` → output delivered to the transcript
 *   as an IGNORED part (`noReply: true` + `ignored: true`) — the LLM never
 *   reads it; it is command-style output for the user's eyes only.
 */
import { loadConfig } from "../share/config.js";
import { createHandledError, deliverCommandOutput } from "../share/handled.js";
import { createNotifier } from "../share/notify.js";
import {
	fetchAllQuota,
	resolveProviderFilter,
	PROVIDER_KEYS,
} from "./quota/index.js";
import { renderQuotaBox } from "./format.js";
import { getAgentTree, getSessionTokens } from "./tokens/tracker.js";
import { opencodeDbPath, openReadonly } from "./store-db.js";

/** Map user input to a quota filter (aliases resolved). */
export function parseUsageArgs(rawArgs = "") {
	const trimmed = rawArgs.trim().toLowerCase();
	if (!trimmed || trimmed === "quota") return { mode: "quota", filter: null };
	if (trimmed === "help" || trimmed === "--help" || trimmed === "-h") {
		return { mode: "help", filter: null };
	}
	if (trimmed === "tokens") return { mode: "tokens", filter: null };

	const filter = resolveProviderFilter(trimmed);
	if (filter) return { mode: "quota", filter };
	return { mode: "error", filter: null, raw: trimmed };
}

/** Build the help text listing valid subcommands. */
function buildHelp() {
	return [
		"USAGE — subcommands:",
		"  /usage              all providers",
		"  /usage quota        all providers (alias)",
		"  /usage ollama       Ollama Cloud only",
		"  /usage agy          Google Antigravity only (alias: antigravity, google)",
		"  /usage openrouter   OpenRouter only (alias: or, router)",
		"  /usage tokens       session token breakdown",
		"  /usage help         this list",
		"Data: read-only from agent.db / opencode.db (0-token LLM)",
	].join("\n");
}

/** Build the token breakdown text (Phase 2). */
async function buildTokensText(sessionID) {
	if (!sessionID) return "No active session.";
	const handle = await openReadonly(opencodeDbPath());
	try {
		const { db } = handle;
		const main = getSessionTokens(db, sessionID);
		if (!main) return "Session not found in opencode.db.";
		const tree = getAgentTree(db, sessionID);
		const lines = [`TOKENS — active session`];
		lines.push(
			`  \u2022 Main Agent : in ${main.input} / out ${main.output} / cost ${main.cost}`,
		);
		for (const sub of tree.subagents) {
			lines.push(
				`  \u2022 ${sub.agent || "subagent"} : in ${sub.input} / out ${sub.output}`,
			);
		}
		return lines.join("\n");
	} finally {
		handle.close();
	}
}

/**
 * usage/usage.js factory.
 *
 * @param {object} input OpenCode plugin input (client, etc.)
 * @param {object} opts { config }
 * @returns {object} hooks object
 */
export function usageModule(input, opts = {}) {
	const { config: fullConfig } = loadConfig();
	const cfg = opts.config || fullConfig.usage || fullConfig;
	const enabled = cfg?.enabled !== false;
	const { client } = input;

	async function respond(sessionID, text, variant = "info") {
		const delivered = await deliverCommandOutput(client, sessionID, text);
		if (!delivered) {
			await createNotifier({ config: fullConfig })(text, variant);
		}
		throw createHandledError();
	}

	return {
		config: async (c) => {
			if (!enabled) return;
			c.command = c.command || {};
			c.command["usage"] = {
				description:
					"Live multi-provider quota (ollama/agy/openrouter) & session tokens — 0-token LLM",
				template: "Fetching live quota...",
			};
		},

		"command.execute.before": async (inputHook, output) => {
			if (!enabled) return;
			const cmd = inputHook.command?.toLowerCase();
			if (cmd !== "usage" && cmd !== "quota") return;

			const sessionID = inputHook.sessionID || "default";
			const rawArgs = inputHook.arguments ?? "";
			const parsed = parseUsageArgs(rawArgs);

			if (parsed.mode === "help") {
				return respond(sessionID, buildHelp(), "info");
			}
			if (parsed.mode === "error") {
				const valid = PROVIDER_KEYS.join(", ");
				return respond(
					sessionID,
					`Unknown provider "${parsed.raw}". Valid: ${valid} (or 'tokens', 'help').`,
					"warn",
				);
			}
			if (parsed.mode === "tokens") {
				const text = await buildTokensText(sessionID);
				return respond(sessionID, text, "info");
			}

			// quota mode
			try {
				const data = await fetchAllQuota({
					config: cfg,
					filter: parsed.filter,
				});
				const text = renderQuotaBox(data, { filter: parsed.filter });
				return respond(sessionID, text, "info");
			} catch (err) {
				const msg =
					err?.cause?.code === "ERR_SQLITE_ERROR" ||
					/cannot open read-only DB|no such file|ENOENT/i.test(
						err.message || "",
					)
						? "agent.db not found or unreadable — login to a provider first (omp / antigravity / ollama / openrouter), then retry /usage"
						: `Usage fetch failed: ${err.message}`;
				return respond(sessionID, msg, "warn");
			}
		},
	};
}

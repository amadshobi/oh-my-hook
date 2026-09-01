/**
 * compress/index.js — Comprehensive context compression & dynamic pruning suite.
 *
 * Focus: Dynamic tool-output pruning (preventing bloated test/build logs from bloating context),
 * Hermes-standard compaction template override via experimental.session.compacting,
 * post-push idle auto-compaction, and /compress commands.
 */
import { pruneMessages } from "./pruner.js";
import { commandHooks } from "./commands.js";
import { automationHooks } from "./automation.js";
import { snapshotHooks } from "./snapshot.js";
import { buildHermesCompactionPrompt } from "./template.js";

export { pruneMessages } from "./pruner.js";
export { commandHooks } from "./commands.js";
export { automationHooks } from "./automation.js";
export { snapshotHooks } from "./snapshot.js";
export { buildHermesCompactionPrompt } from "./template.js";

// Alias for backward compatibility in E2E tests
export { compressHooks as compressModule };

/**
 * Context compression hook assembler.
 */
export async function compressHooks({ client, directory }, opts = {}) {
	// Support opts.config directly or opts.config.compress (nested)
	const cfg = opts?.config?.compress ?? opts?.config ?? {};
	if (cfg.enabled === false) {
		return {};
	}

	const cmdHooks = await commandHooks({ client }, opts);
	const autoHooks = await automationHooks({ client }, opts);
	const snapHooks = await snapshotHooks({ client, directory }, opts);

	return {
		config: async (config) => {
			if (cmdHooks.config) await cmdHooks.config(config);
		},

		"command.execute.before": async (input) => {
			if (cmdHooks["command.execute.before"]) {
				await cmdHooks["command.execute.before"](input);
			}
		},

		"tool.execute.after": async (input, output) => {
			if (autoHooks["tool.execute.after"]) {
				await autoHooks["tool.execute.after"](input, output);
			}
		},

		event: async (input) => {
			if (autoHooks.event) {
				await autoHooks.event(input);
			}
		},

		"session.idle": async (input) => {
			if (autoHooks["session.idle"]) {
				await autoHooks["session.idle"](input);
			}
			if (autoHooks.event) {
				await autoHooks.event({ type: "session.idle", ...input });
			}
		},

		/**
		 * Override native OpenCode compaction prompt with Hermes-standard
		 * high-density 8-section handoff schema.
		 */
		"experimental.session.compacting": async (input, output) => {
			if (snapHooks["experimental.session.compacting"]) {
				await snapHooks["experimental.session.compacting"](input, output);
			}

			if (cfg.template?.enabled === false) return;

			// Extract prior summary if present in incoming context
			const priorSummary = input?.previousSummary || output?.previousSummary;
			const conversation = output?.context ? output.context.join("\n\n") : "";

			// Replace default OpenCode prompt with Hermes handoff specification
			output.prompt = buildHermesCompactionPrompt({
				previousSummary: priorSummary,
				conversation,
			});
		},

		/**
		 * Dynamic tool-output pruning before context ingestion.
		 */
		"experimental.chat.messages.transform": async (input, output) => {
			if (!output?.messages || !Array.isArray(output.messages)) {
				return;
			}
			const sessionID = input?.sessionID || input?.session?.id;
			pruneMessages(
				output.messages,
				{
					enabled: cfg.pruning?.enabled !== false,
					...cfg.pruning,
					recentTurns: cfg.pruning?.recentTurns ?? 2,
				},
				sessionID,
			);
		},
	};
}

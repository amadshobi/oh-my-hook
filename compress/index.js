/**
 * compress/index.js — Comprehensive context compression & dynamic pruning suite.
 *
 * Combines dynamic tool-output pruning, post-push idle auto-compaction,
 * compaction snapshotting, scoped agent context, and deterministic /compress commands.
 */
import { mergeHooks } from "../share/merge.js";
import { pruneMessages } from "./pruner.js";
import { automationHooks } from "./automation.js";
import { snapshotHooks } from "./snapshot.js";
import { agentContextHooks } from "./agent-context.js";
import { commandHooks } from "./commands.js";

export async function compressModule(input, opts = {}) {
	const cfg = opts?.config ?? {};
	const enabled = cfg.enabled ?? true;

	if (!enabled) {
		return {};
	}

	const [automation, snapshot, agentContext, commands] = await Promise.all([
		automationHooks(input, { config: cfg }),
		snapshotHooks(input, { config: cfg }),
		agentContextHooks(input, { config: cfg }),
		commandHooks(input, { config: cfg }),
	]);

	const prunerHook = {
		"experimental.chat.messages.transform": async (hookInput, hookOutput) => {
			const pruningCfg = cfg.pruning ?? { enabled: true };
			if (pruningCfg.enabled === false) return;
			if (!hookOutput?.messages || !Array.isArray(hookOutput.messages)) return;
			try {
				pruneMessages(hookOutput.messages, pruningCfg, hookInput?.sessionID);
			} catch {}
		},
	};

	return mergeHooks(automation, snapshot, agentContext, commands, prunerHook);
}

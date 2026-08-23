/**
 * compress/pruner.js — Dynamic tool output pruning engine.
 *
 * Intercepts experimental.chat.messages.transform to prune historical bloated
 * tool outputs (test suites, build logs, file listings) from earlier turns,
 * while safeguarding recent turns, critical tools, and failure signals.
 */
import {
	isProtectedTool,
	isEligibleTool,
	matchesCommandPattern,
	hasFailureSignal,
	buildCollapseMarker,
	isAlreadyPruned,
} from "./rules.js";
import { recordPruning } from "./stats.js";

/**
 * Calculate the cutoff index in messages array before which messages are eligible for pruning.
 * Everything from cutoffIndex to messages.length - 1 is strictly protected.
 */
export function calculateCutoffIndex(messages, recentTurns = 2) {
	if (!Array.isArray(messages) || messages.length === 0) return 0;
	if (recentTurns <= 0) return messages.length;

	let userTurnCount = 0;
	let cutoffIndex = messages.length;

	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg?.info?.role === "user") {
			userTurnCount++;
			if (userTurnCount >= recentTurns) {
				cutoffIndex = i;
				break;
			}
		}
	}

	// If fewer than recentTurns user messages exist, protect everything
	if (userTurnCount < recentTurns) {
		return 0;
	}

	return cutoffIndex;
}

/**
 * Transform messages by pruning eligible bloated tool outputs.
 */
export function pruneMessages(messages, cfg = {}, sessionID = null) {
	if (!cfg?.enabled || !Array.isArray(messages) || messages.length === 0) {
		return { prunedCount: 0, totalBytesPruned: 0 };
	}

	const recentTurns = cfg.recentTurns ?? 2;
	const minOutputChars = cfg.minOutputChars ?? 8000;
	const keepHeadChars = cfg.keepHeadChars ?? 1000;
	const keepTailChars = cfg.keepTailChars ?? 1500;

	const cutoffIndex = calculateCutoffIndex(messages, recentTurns);
	if (cutoffIndex <= 0) {
		return { prunedCount: 0, totalBytesPruned: 0 };
	}

	let prunedCount = 0;
	let totalBytesPruned = 0;

	for (let i = 0; i < cutoffIndex; i++) {
		const msg = messages[i];
		if (msg?.info?.role !== "assistant" || !Array.isArray(msg.parts)) {
			continue;
		}

		for (const part of msg.parts) {
			if (part?.type !== "tool" || part?.state?.status !== "completed") {
				continue;
			}

			const toolName = part.tool;
			if (isProtectedTool(toolName, cfg)) {
				continue;
			}

			if (!isEligibleTool(toolName, cfg)) {
				continue;
			}

			const rawOutput =
				typeof part.state.output === "string" ? part.state.output : "";
			if (rawOutput.length < minOutputChars) {
				continue;
			}

			if (isAlreadyPruned(rawOutput)) {
				continue;
			}

			const cmd = part.state?.input?.command || part.args?.command || "";
			if (!matchesCommandPattern(cmd, cfg)) {
				continue;
			}

			if (hasFailureSignal(rawOutput, cfg)) {
				continue;
			}

			// Perform deterministic collapse
			const head = rawOutput.slice(0, keepHeadChars);
			const tail = rawOutput.slice(-keepTailChars);
			const collapsedChars = rawOutput.length - (head.length + tail.length);

			if (collapsedChars <= 0) {
				continue;
			}

			const marker = buildCollapseMarker(collapsedChars);
			part.state.output = `${head}${marker}${tail}`;

			prunedCount += 1;
			totalBytesPruned += collapsedChars;

			try {
				recordPruning(sessionID, {
					charsPruned: collapsedChars,
					tool: toolName,
					commandClass: cmd.slice(0, 50),
				});
			} catch {}
		}
	}

	return { prunedCount, totalBytesPruned };
}

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
	isEligibleCommand,
	matchesCommandPattern,
	hasFailureSignal,
	buildCollapseMarker,
	isAlreadyPruned,
} from "./rules.js";
import { recordPruning } from "./stats.js";
import { appendDebugEvent } from "./debug.js";

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

	const recentTurns = cfg.recentTurns ?? 1;
	const minOutputChars = cfg.minOutputChars ?? 2000;
	const massiveOutputChars = cfg.massiveOutputChars ?? 10000;
	const keepHeadChars = cfg.keepHeadChars ?? 500;
	const keepTailChars = cfg.keepTailChars ?? 1500;
	const keepImportantLines = cfg.keepImportantLines ?? true;

	const cutoffIndex = calculateCutoffIndex(messages, recentTurns);

	let prunedCount = 0;
	let totalBytesPruned = 0;

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		if (msg?.info?.role !== "assistant" || !Array.isArray(msg.parts)) {
			continue;
		}

		// Messages at or after cutoffIndex are within the protected recent window
		const isRecent = cutoffIndex <= 0 || i >= cutoffIndex;

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

			// In recent turns, only prune if output is massive
			if (isRecent && rawOutput.length < massiveOutputChars) {
				continue;
			}

			if (rawOutput.length < minOutputChars) {
				continue;
			}

			if (isAlreadyPruned(rawOutput)) {
				continue;
			}

			const cmd = part.state?.input?.command || part.args?.command || "";
			if (!isEligibleCommand(cmd, cfg)) {
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

			let extraSummary = "";
			if (keepImportantLines && collapsedChars > 0) {
				const middle = rawOutput.slice(
					keepHeadChars,
					rawOutput.length - keepTailChars,
				);
				const lines = middle.split("\n");
				const highlights = lines
					.map((l) => l.trim())
					.filter(
						(l) =>
							l.length > 5 &&
							/\b(passed|pass|ok|status|summary|duration|elapsed|total|complete)\b/i.test(
								l,
							) &&
							!/^[─=\-_*]+$/.test(l),
					)
					.slice(0, 3);
				if (highlights.length > 0) {
					extraSummary = `── Highlights: ${highlights.join(" | ")} ──`;
				}
			}

			const marker = buildCollapseMarker(collapsedChars, extraSummary);
			part.state.output = `${head}${marker}${tail}`;

			prunedCount += 1;
			totalBytesPruned += collapsedChars;

			const partId =
				part.id ||
				part.callID ||
				`${msg.info?.id || i}:${toolName}:${cmd.slice(0, 30)}:${rawOutput.length}`;

			try {
				const isNewPrune = recordPruning(sessionID, {
					charsPruned: collapsedChars,
					tool: toolName,
					commandClass: cmd.slice(0, 50),
					partId,
				});

				if (isNewPrune) {
					appendDebugEvent(
						sessionID,
						{
							kind: "prune",
							type: "PRUNE",
							detail: `Pruned ${collapsedChars} chars (~${Math.round(collapsedChars / 4)} tok) from ${toolName}${cmd ? ` ("${cmd.slice(0, 30)}")` : ""}`,
						},
						cfg,
					);
				}
			} catch {}
		}
	}

	return { prunedCount, totalBytesPruned };
}

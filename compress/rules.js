/**
 * compress/rules.js — Pruning rules, regex pattern matchers, and safety signal detectors.
 *
 * All matching functions are pure and fail-safe.
 */

export const PRUNE_MARKER_PREFIX = "── OMH-PRUNE ──";
export const PRUNE_MARKER_REGEX = /──\s*OMH-PRUNE\s*──/;

/**
 * Check if tool is protected from pruning (read, write, edit, etc.).
 */
export function isProtectedTool(toolName, cfg = {}) {
	if (!toolName) return true;
	const protectedMap = cfg.protectedTools || {
		read: true,
		write: true,
		edit: true,
		patch: true,
		grep: true,
		glob: true,
		find: true,
		ls: true,
		todowrite: true,
		webfetch: true,
	};
	return Boolean(protectedMap[toolName]);
}

/**
 * Check if tool is eligible for output pruning (bash, etc.).
 */
export function isEligibleTool(toolName, cfg = {}) {
	if (!toolName) return false;
	const eligibleMap = cfg.eligibleTools || { bash: true };
	return Boolean(eligibleMap[toolName]);
}

/**
 * Check if a command matches eligible noise patterns (npm test, go build, etc.).
 */
export function matchesCommandPattern(command, cfg = {}) {
	if (!command || typeof command !== "string") return false;
	const patterns = cfg.commandPatterns || {};

	for (const pattern of Object.values(patterns)) {
		if (!pattern) continue;
		try {
			const re = new RegExp(pattern, "i");
			if (re.test(command)) return true;
		} catch {}
	}
	return false;
}

/**
 * Check if tool output contains failure signals (errors, panics, test failures).
 * If a failure signal is present, output MUST NOT be pruned.
 */
export function hasFailureSignal(output, cfg = {}) {
	if (!output || typeof output !== "string") return false;
	const signals = cfg.failureSignals || {};

	// Sample the output: head 4000 chars + tail 4000 chars for fast, accurate scanning
	const head = output.slice(0, 4000);
	const tail = output.length > 4000 ? output.slice(-4000) : "";
	const sample = `${head}\n${tail}`;

	for (const signal of Object.values(signals)) {
		if (!signal) continue;
		try {
			const re = new RegExp(signal, "i");
			if (re.test(sample)) return true;
		} catch {}
	}
	return false;
}

/**
 * Build deterministic, clean collapse marker.
 */
export function buildCollapseMarker(collapsedChars) {
	const countStr =
		typeof collapsedChars === "number"
			? collapsedChars.toLocaleString("en-US")
			: "content";
	return `\n\n── OMH-PRUNE ── ${countStr} chars collapsed ── head/tail preserved ──\n\n`;
}

/**
 * Check if output is already pruned (idempotency guard).
 */
export function isAlreadyPruned(output) {
	if (!output || typeof output !== "string") return false;
	return PRUNE_MARKER_REGEX.test(output);
}

/**
 * Estimate token count from character count (~4 chars per token).
 */
export function estimateTokens(chars) {
	if (typeof chars !== "number" || chars <= 0) return 0;
	return Math.round(chars / 4);
}

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
 * Check if a command matches any regex in a pattern list (array or single string).
 */
function matchesAnyPattern(command, list) {
	if (!command || !list) return false;
	const items = Array.isArray(list) ? list : [list];
	for (const item of items) {
		if (!item || typeof item !== "string") continue;
		try {
			const re = new RegExp(item, "i");
			if (re.test(command)) return true;
		} catch {}
	}
	return false;
}

/**
 * Check if a command is explicitly excluded from pruning (neverPrune list).
 */
export function isNeverPruned(command, cfg = {}) {
	if (!command || typeof command !== "string") return false;
	const neverList = cfg.commandPatterns?.neverPrune;
	return matchesAnyPattern(command, neverList);
}

/**
 * Check if a command is explicitly marked to always prune.
 */
export function isAlwaysPruned(command, cfg = {}) {
	if (!command || typeof command !== "string") return false;
	const alwaysList = cfg.commandPatterns?.alwaysPrune;
	return matchesAnyPattern(command, alwaysList);
}

/**
 * Check if a command is eligible for pruning under generic size-based rules.
 * Under generic rules, all tool commands are eligible UNLESS they match neverPrune.
 */
export function isEligibleCommand(command, cfg = {}) {
	if (!command || typeof command !== "string") return true;

	// Explicit neverPrune exclusion takes precedence over everything
	if (isNeverPruned(command, cfg)) {
		return false;
	}

	const patterns = cfg.commandPatterns;
	// Support legacy flat object where all values were patterns that MUST match
	if (
		patterns &&
		!patterns.alwaysPrune &&
		!patterns.neverPrune &&
		typeof patterns === "object"
	) {
		return matchesLegacyCommandPattern(command, patterns);
	}

	// In generic mode, any command not in neverPrune is eligible
	return true;
}

/**
 * Legacy command pattern matcher for backwards compatibility with flat pattern maps.
 */
function matchesLegacyCommandPattern(command, patterns) {
	for (const val of Object.values(patterns)) {
		if (matchesAnyPattern(command, val)) return true;
	}
	return false;
}

/**
 * Check if a command matches eligible noise patterns (npm test, go build, etc.).
 * Backwards compatible with legacy string pattern maps and modern { alwaysPrune, neverPrune }.
 */
export function matchesCommandPattern(command, cfg = {}) {
	if (!command || typeof command !== "string") return false;
	const patterns = cfg.commandPatterns || {};

	// If legacy flat map (e.g. { test: "npm test" })
	if (!patterns.alwaysPrune && !patterns.neverPrune) {
		return matchesLegacyCommandPattern(command, patterns);
	}

	// Modern map: neverPrune is never eligible
	if (isNeverPruned(command, cfg)) return false;
	// alwaysPrune is definitely eligible
	if (isAlwaysPruned(command, cfg)) return true;

	// In modern mode, generic commands are eligible
	return true;
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
export function buildCollapseMarker(collapsedChars, extra = "") {
	const countStr =
		typeof collapsedChars === "number"
			? collapsedChars.toLocaleString("en-US")
			: "content";
	const suffix = extra ? `${extra}\n` : "";
	return `\n\n── OMH-PRUNE ── ${countStr} chars collapsed ── head/tail preserved ──\n${suffix}\n`;
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

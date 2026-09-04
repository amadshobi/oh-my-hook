/**
 * block.js — concise, authoritative guardrail message builders.
 */

/**
 * Build a hard-block error message (thrown from tool.execute.before).
 */
export function blockMessage(title, reason, hint) {
	let cleanTitle = String(title || "Operation Blocked").trim();
	cleanTitle = cleanTitle.replace(/^[^\w\s\(\)"'`]+\s*/, "");

	let msg = `🛑 BLOCKED: ${cleanTitle}`;
	if (reason) {
		msg += `\nReason: ${String(reason).trim()}`;
	}
	if (hint) {
		msg += `\nAction: ${String(hint).trim()}`;
	}
	return msg;
}

/**
 * Build a warn message (non-blocking) thrown or logged to surface a warning.
 */
export function warnMessage(title, reason) {
	let cleanTitle = String(title || "Warning").trim();
	cleanTitle = cleanTitle.replace(/^[^\w\s\(\)"'`]+\s*/, "");
	let msg = `⚠️ WARN: ${cleanTitle}`;
	if (reason) {
		msg += `\nReason: ${String(reason).trim()}`;
	}
	return msg;
}

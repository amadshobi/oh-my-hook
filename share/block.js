/**
 * block.js — concise, clean guardrail message builders.
 */

/**
 * Build a hard-block error message (thrown from tool.execute.before).
 */
export function blockMessage(title, reason, hint) {
	let msg = `#### 🚫 ${title}\n> *${reason}*`;
	if (hint) {
		msg += `\n> *${hint}*`;
	}
	return msg;
}

/**
 * Build a warn message (non-blocking) thrown or logged to surface a warning.
 */
export function warnMessage(title, reason) {
	return `#### ⚠️ ${title}\n> *${reason}*`;
}

/**
 * share/handled.js — Command-handled sentinel and output delivery helper.
 *
 * Thrown by slash-command handlers to signal that output has been delivered
 * and no LLM turn should be created.
 */
export const COMMAND_HANDLED_SENTINEL = "__OMH_COMMAND_HANDLED__";
const HANDLED_BRAND = Symbol.for("oh-my-hook/command-handled");

export function createHandledError() {
	const err = new Error(COMMAND_HANDLED_SENTINEL);
	err[HANDLED_BRAND] = true;
	return err;
}

export function isHandledError(err) {
	if (!err) return false;
	return (
		err[HANDLED_BRAND] === true || err.message === COMMAND_HANDLED_SENTINEL
	);
}

/**
 * Deliver slash command output to session transcript with noReply (0 token LLM).
 * @param {object} client OpenCode client
 * @param {string} sessionID Session ID
 * @param {string} text Output text
 */
export async function deliverCommandOutput(client, sessionID, text) {
	if (client?.session?.prompt && sessionID) {
		try {
			await client.session.prompt({
				path: { id: sessionID },
				body: {
					noReply: true,
					parts: [{ type: "text", text, ignored: true }],
				},
			});
			return true;
		} catch {}
	}
	return false;
}

/**
 * usage/tokens/store.js — read-only access to `~/.local/share/opencode/opencode.db`.
 *
 * Session rows carry aggregated token columns; per-message details live in
 * `message.data` JSON. Subagents are sessions with `parent_id` set.
 */
import { queryAll } from "../store-db.js";

/**
 * Get a session row by id (undefined when missing).
 *
 * @param {object} db open opencode.db handle
 * @param {string} sessionID
 * @returns {object|undefined}
 */
export function getSessionRow(db, sessionID) {
	const rows = queryAll(
		db,
		"SELECT id, parent_id, agent, model, title, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated FROM session WHERE id = ?",
		[sessionID],
	);
	return rows.length > 0 ? rows[0] : undefined;
}

/**
 * Get subagent session rows for a parent session.
 *
 * @param {object} db open opencode.db handle
 * @param {string} sessionID
 * @returns {Array<object>}
 */
export function getSubagentRows(db, sessionID) {
	return queryAll(
		db,
		"SELECT id, parent_id, agent, model, title, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write FROM session WHERE parent_id = ? ORDER BY time_updated DESC",
		[sessionID],
	);
}

/**
 * Get the most recent message row (message.data JSON) for a session.
 *
 * @param {object} db open opencode.db handle
 * @param {string} sessionID
 * @returns {object|undefined} parsed message data
 */
export function getLastMessage(db, sessionID) {
	const rows = queryAll(
		db,
		"SELECT data FROM message WHERE session_id = ? ORDER BY time_created DESC LIMIT 1",
		[sessionID],
	);
	if (rows.length === 0) return undefined;
	try {
		return JSON.parse(rows[0].data);
	} catch {
		return undefined;
	}
}

/**
 * usage/tokens/tracker.js — aggregate session & subagent token consumption.
 *
 * Reads aggregated token columns from opencode.db `session` rows; parses the
 * JSON-string `agent`/`model` columns into readable labels.
 */
import { getSessionRow, getSubagentRows, getLastMessage } from "./store.js";

/** Parse JSON-string agent/model columns safely. */
function parseAgentModel(row) {
	let agent = row?.agent || null;
	let model = row?.model || null;
	try {
		if (typeof agent === "string") agent = JSON.parse(agent);
	} catch {}
	try {
		if (typeof model === "string") model = JSON.parse(model);
	} catch {}
	return { agent, model };
}

/** Normalize a session row into a compact token summary. */
export function normalizeSession(row) {
	if (!row) return null;
	const { agent, model } = parseAgentModel(row);
	return {
		id: row.id,
		parentId: row.parent_id || null,
		agent: agent?.id || agent || null,
		provider: model?.providerID || null,
		model: model?.id || null,
		title: row.title || "",
		cost: Number(row.cost) || 0,
		input: Number(row.tokens_input) || 0,
		output: Number(row.tokens_output) || 0,
		reasoning: Number(row.tokens_reasoning) || 0,
		cacheRead: Number(row.tokens_cache_read) || 0,
		cacheWrite: Number(row.tokens_cache_write) || 0,
	};
}

/**
 * Token summary for a single session (main agent).
 *
 * @param {object} db open opencode.db handle
 * @param {string} sessionID
 * @returns {object|null} normalized session or null when missing
 */
export function getSessionTokens(db, sessionID) {
	return normalizeSession(getSessionRow(db, sessionID));
}

/**
 * Full agent tree: main session + subagents (child sessions).
 *
 * @param {object} db open opencode.db handle
 * @param {string} sessionID
 * @returns {{ main: object|null, subagents: Array<object> }}
 */
export function getAgentTree(db, sessionID) {
	const main = normalizeSession(getSessionRow(db, sessionID));
	const subagents = getSubagentRows(db, sessionID)
		.map(normalizeSession)
		.filter(Boolean);
	return { main, subagents };
}

/**
 * Token delta since a given message (for the floating toast).
 * Falls back to the full session row when no lastMessageId is available.
 *
 * @param {object} db open opencode.db handle
 * @param {string} sessionID
 * @param {string} [lastMessageId]
 * @returns {object|null} { input, output, reasoning, cacheRead, cacheWrite, cost, durationMs } | null
 */
export function getTurnDelta(db, sessionID, lastMessageId) {
	const last = getLastMessage(db, sessionID);
	if (!last) return null;

	const tokens = last.tokens || {};
	const delta = {
		input: tokens.input || 0,
		output: tokens.output || 0,
		reasoning: tokens.reasoning || 0,
		cacheRead: tokens.cache?.read || 0,
		cacheWrite: tokens.cache?.write || 0,
		cost: Number(last.cost) || 0,
		durationMs:
			last.time?.completed && last.time?.created
				? last.time.completed - last.time.created
				: null,
	};
	return delta;
}

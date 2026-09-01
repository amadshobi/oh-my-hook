/**
 * compress/stats.js — Persistent compression & pruning metrics ledger.
 *
 * Tracks tokens saved, pruned outputs, and compaction milestones.
 * Bounded to 50 sessions maximum to prevent unbounded disk growth.
 */
import { statePath, readJson, writeJson } from "../share/state.js";
import { estimateTokens } from "./rules.js";

const STATS_FILE = statePath("oh-my-hook-compress.json");
const MAX_SESSIONS = 50;

const DEFAULT_STATS = {
	totalPrunedCount: 0,
	totalBytesSaved: 0,
	totalTokensSaved: 0,
	totalCompactions: 0,
	lastPrunedAt: null,
	lastCompactedAt: null,
	sessions: {},
};

export function loadCompressStats() {
	const raw = readJson(STATS_FILE, DEFAULT_STATS);
	return {
		totalPrunedCount: raw?.totalPrunedCount ?? 0,
		totalBytesSaved: raw?.totalBytesSaved ?? 0,
		totalTokensSaved: raw?.totalTokensSaved ?? 0,
		totalCompactions: raw?.totalCompactions ?? 0,
		lastPrunedAt: raw?.lastPrunedAt ?? null,
		lastCompactedAt: raw?.lastCompactedAt ?? null,
		lastPruneEvent: raw?.lastPruneEvent ?? null,
		avgTokensPerPrune: raw?.avgTokensPerPrune ?? 0,
		sessions: raw?.sessions ?? {},
	};
}

export function saveCompressStats(stats) {
	writeJson(STATS_FILE, stats);
}

/**
 * Record a pruning event for a session.
 */
export function recordPruning(
	sessionID,
	{ charsPruned = 0, tool = "bash", commandClass = "command" } = {},
) {
	if (charsPruned <= 0) return;

	const stats = loadCompressStats();
	const tokensSaved = estimateTokens(charsPruned);
	const now = new Date().toISOString();

	const sid = sessionID || "global";
	const currentSession = stats.sessions[sid] || {
		prunedCount: 0,
		bytesSaved: 0,
		tokensSaved: 0,
		compactions: 0,
		lastUpdated: now,
		tools: {},
	};

	currentSession.prunedCount += 1;
	currentSession.bytesSaved += charsPruned;
	currentSession.tokensSaved += tokensSaved;
	currentSession.lastUpdated = now;
	currentSession.tools[tool] = (currentSession.tools[tool] || 0) + 1;

	// Global aggregates
	stats.totalPrunedCount += 1;
	stats.totalBytesSaved += charsPruned;
	stats.totalTokensSaved += tokensSaved;
	stats.lastPrunedAt = now;
	stats.lastPruneEvent = {
		count: currentSession.prunedCount,
		tokens: tokensSaved,
		tool,
		command: commandClass,
		at: now,
	};

	// Rolling prune rate: tokens saved per pruning event (global average)
	const totalEvents = stats.totalPrunedCount;
	stats.avgTokensPerPrune =
		totalEvents > 0 ? Math.round(stats.totalTokensSaved / totalEvents) : 0;

	// Bounding session map
	stats.sessions[sid] = currentSession;
	const sessionKeys = Object.keys(stats.sessions);
	if (sessionKeys.length > MAX_SESSIONS) {
		const oldest = sessionKeys.slice(0, sessionKeys.length - MAX_SESSIONS);
		for (const key of oldest) {
			delete stats.sessions[key];
		}
	}

	saveCompressStats(stats);
}

/**
 * Record a compaction event for a session.
 */
export function recordCompaction(sessionID, { type = "milestone" } = {}) {
	const stats = loadCompressStats();
	const now = new Date().toISOString();
	const sid = sessionID || "global";

	const currentSession = stats.sessions[sid] || {
		prunedCount: 0,
		bytesSaved: 0,
		tokensSaved: 0,
		compactions: 0,
		lastUpdated: now,
		tools: {},
	};

	currentSession.compactions += 1;
	currentSession.lastUpdated = now;

	stats.totalCompactions += 1;
	stats.lastCompactedAt = now;
	stats.sessions[sid] = currentSession;

	saveCompressStats(stats);
}

/**
 * Get metrics summary for a specific session or global.
 */
export function getCompressMetrics(sessionID) {
	const stats = loadCompressStats();
	const sessionStats = sessionID ? stats.sessions[sessionID] : null;

	return {
		session: sessionStats || {
			prunedCount: 0,
			bytesSaved: 0,
			tokensSaved: 0,
			compactions: 0,
			tools: {},
		},
		global: {
			totalPrunedCount: stats.totalPrunedCount,
			totalBytesSaved: stats.totalBytesSaved,
			totalTokensSaved: stats.totalTokensSaved,
			totalCompactions: stats.totalCompactions,
			lastPrunedAt: stats.lastPrunedAt,
			lastCompactedAt: stats.lastCompactedAt,
			lastPruneEvent: stats.lastPruneEvent,
			avgTokensPerPrune: stats.avgTokensPerPrune,
		},
	};
}

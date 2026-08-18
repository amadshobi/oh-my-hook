/**
 * memory/ctx.js — in-memory per-session context tracker.
 *
 * Keeps track of the most recent user prompt, invoked tools, and modified files
 * per session to build sharp, high-relevance search queries for the BM25 matcher.
 */

class SessionContextTracker {
	constructor() {
		/** @type {Map<string, { lastUserMessage: string, recentTools: string[], recentFiles: string[], lastCorrectionAt: number, ts: number }>} */
		this.sessions = new Map();
	}

	/**
	 * Record a user message or tool call for a session.
	 * @param {string} sessionID
	 * @param {object} data
	 */
	record(sessionID, data = {}) {
		if (!sessionID) return;
		const current = this.sessions.get(sessionID) || {
			lastUserMessage: "",
			recentTools: [],
			recentFiles: [],
			lastCorrectionAt: 0,
			ts: Date.now(),
		};

		if (typeof data.userMessage === "string" && data.userMessage.trim()) {
			current.lastUserMessage = data.userMessage.trim();
		}

		if (typeof data.toolName === "string" && data.toolName.trim()) {
			current.recentTools = [
				data.toolName.trim(),
				...current.recentTools.filter((t) => t !== data.toolName.trim()),
			].slice(0, 5);
		}

		if (typeof data.filePath === "string" && data.filePath.trim()) {
			current.recentFiles = [
				data.filePath.trim(),
				...current.recentFiles.filter((f) => f !== data.filePath.trim()),
			].slice(0, 5);
		}

		if (data.isCorrection) {
			current.lastCorrectionAt = Date.now();
		}

		current.ts = Date.now();
		this.sessions.set(sessionID, current);
	}

	/**
	 * Get synthesized query string for a session.
	 * @param {string} sessionID
	 * @param {string} [fallback]
	 * @returns {string}
	 */
	getQuery(sessionID, fallback = "") {
		const ctx = this.sessions.get(sessionID);
		if (!ctx) return fallback || "";

		const parts = [];
		if (ctx.lastUserMessage) parts.push(ctx.lastUserMessage);
		if (ctx.recentTools.length > 0) parts.push(ctx.recentTools.join(" "));
		if (ctx.recentFiles.length > 0) {
			const fileKeywords = ctx.recentFiles
				.map((f) => f.split("/").pop())
				.join(" ");
			parts.push(fileKeywords);
		}

		return parts.join(" ") || fallback || "";
	}

	/**
	 * Clean up sessions older than maxAgeMs (default: 6 hours).
	 * @param {number} [maxAgeMs=21600000]
	 */
	prune(maxAgeMs = 6 * 60 * 60 * 1000) {
		const now = Date.now();
		for (const [id, data] of this.sessions.entries()) {
			if (now - data.ts > maxAgeMs) {
				this.sessions.delete(id);
			}
		}
	}
}

export const sessionTracker = new SessionContextTracker();

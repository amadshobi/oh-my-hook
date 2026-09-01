/**
 * tui/src/lib/compress-watch.js — Reactive watcher for tool output pruning events.
 *
 * Bridges server-side pruning events to TUI toast notifications via the
 * shared stats file (oh-my-hook-compress.json).
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { statePath } from "../../../share/state.js";
import { loadCompressStats } from "../../../compress/stats.js";

const STATS_FILE = "oh-my-hook-compress.json";

export function watchCompressStats(onPrune, options = {}) {
	const defaultDir = path.dirname(statePath(STATS_FILE));
	const dir = options.stateDir || defaultDir;
	const cooldownMs = options.cooldownMs ?? 3000;

	if (!existsSync(dir)) {
		try {
			mkdirSync(dir, { recursive: true });
		} catch {}
	}

	let disposed = false;
	let lastEventAt = Date.now();
	let lastEventKey = null;

	const pollTimer = setInterval(() => {
		if (disposed) return;
		try {
			const stats = loadCompressStats();
			const evt = stats.lastPruneEvent;
			if (!evt) return;

			// Ignore events that occurred before this watcher was initialized
			const eventTime = evt.at ? new Date(evt.at).getTime() : 0;
			if (eventTime <= lastEventAt) return;

			const key = `${evt.at}|${evt.count}|${evt.tool}|${evt.command || ""}`;
			if (key === lastEventKey) return;
			lastEventKey = key;

			const now = Date.now();
			if (cooldownMs > 0 && now - lastEventAt < cooldownMs) {
				return;
			}
			lastEventAt = now;

			// Extract clean command target for toast (compact 1-2 words, e.g. "npm test", "git push")
			let target = evt.tool || "tool";
			if (evt.command && typeof evt.command === "string") {
				const trimmed = evt.command.trim();
				const words = trimmed.split(/\s+/);
				target = words.slice(0, 2).join(" ");
			}

			onPrune({
				tool: evt.tool || "tool",
				target,
				tokens: evt.tokens || 0,
			});
		} catch {}
	}, 1500);

	return () => {
		disposed = true;
		clearInterval(pollTimer);
	};
}

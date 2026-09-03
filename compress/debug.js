/**
 * compress/debug.js — Safe lazy per-session debug event recorder.
 *
 * Lazily records pruning/compaction audit trail to:
 * ~/.local/share/opencode/compress/<sessionID>/snapshot.md
 */
import {
	existsSync,
	mkdirSync,
	appendFileSync,
	readdirSync,
	statSync,
	rmSync,
} from "node:fs";
import path from "node:path";
import { statePath } from "../share/state.js";

export function snapshotPath(sessionID = "global", customRoot = null) {
	const base =
		customRoot || path.dirname(statePath("oh-my-hook-compress.json"));
	return path.join(base, "compress", sessionID, "snapshot.md");
}

/**
 * Enforce maxSessions retention policy by removing oldest session directories.
 */
export function cleanOldDebugSessions(compressDir, maxSessions = 20) {
	if (!compressDir || maxSessions <= 0 || !existsSync(compressDir)) return;
	try {
		const entries = readdirSync(compressDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => {
				const full = path.join(compressDir, d.name);
				try {
					return {
						name: d.name,
						path: full,
						mtime: statSync(full).mtimeMs,
					};
				} catch {
					return null;
				}
			})
			.filter(Boolean);

		if (entries.length > maxSessions) {
			entries.sort((a, b) => a.mtime - b.mtime);
			const toRemove = entries.slice(0, entries.length - maxSessions);
			for (const item of toRemove) {
				try {
					rmSync(item.path, { recursive: true, force: true });
				} catch {}
			}
		}
	} catch {}
}

export function appendDebugEvent(sessionID, event, cfg = {}, opts = {}) {
	if (opts?.enabled === false || cfg?.debug?.enabled === false) return;
	const file = snapshotPath(sessionID, cfg?.debug?.rootDir);
	const dir = path.dirname(file);
	const compressBase = path.dirname(dir);

	try {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
			const maxSessions = cfg?.debug?.maxSessions ?? opts?.maxSessions ?? 20;
			cleanOldDebugSessions(compressBase, maxSessions);
		}
		const timestamp = new Date().toISOString();
		const line = `- [${timestamp}] **${event.type || event.kind || "EVENT"}**: ${event.detail || JSON.stringify(event)}\n`;
		appendFileSync(file, line, "utf8");
	} catch {}
}

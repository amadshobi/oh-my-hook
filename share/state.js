/**
 * state.js — shared persisted state + read-ledger.
 *
 * Read-ledger tracks files the model has actually read this session so
 * read-before-write and stale-write guards can enforce the Command
 * Code-style workflow: never edit a file you haven't read; never write a
 * file that changed on disk after you read it.
 */
import {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
	statSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";

const OLD_STATE_DIR = path.join(os.homedir(), ".config", "opencode");
const STATE_DIR = process.env.XDG_DATA_HOME
	? path.join(process.env.XDG_DATA_HOME, "opencode")
	: path.join(os.homedir(), ".local", "share", "opencode");

export function statePath(name) {
	return path.join(STATE_DIR, name);
}

export function readJson(file, fallback) {
	try {
		if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
		// Fallback check to legacy .config location if exists
		const oldFile = path.join(OLD_STATE_DIR, path.basename(file));
		if (existsSync(oldFile)) return JSON.parse(readFileSync(oldFile, "utf8"));
	} catch {}
	return fallback;
}

export function writeJson(file, data) {
	try {
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, JSON.stringify(data, null, 2));
	} catch {}
}

// ---- read-ledger ----

const LEDGER_FILE = statePath("oh-my-hook-read-ledger.json");

export function loadLedger() {
	return readJson(LEDGER_FILE, {});
}

export function saveLedger(ledger) {
	writeJson(LEDGER_FILE, ledger);
}

/**
 * Record that a file was read in a session. `meta` carries mtime/size so
 * stale-write can detect disk changes later.
 */
export function markRead(ledger, filePath, meta, sessionID = "global") {
	const sessionKey = sessionID || "global";
	ledger[sessionKey] = ledger[sessionKey] || {};
	ledger[sessionKey][filePath] = { readAt: Date.now(), ...meta };
}

/**
 * Lookup read entry for a file in the ledger.
 * Prioritizes direct session match, then falls back to newest match across other sessions.
 *
 * @param {object} ledger
 * @param {string} filePath
 * @param {string} [sessionID="global"]
 * @returns {{ entry: object, sourceSession: string, isDirect: boolean } | null}
 */
export function getReadRecord(ledger, filePath, sessionID = "global") {
	if (!ledger || !filePath) return null;
	const sessionKey = sessionID || "global";

	// 1. Direct session key lookup
	if (ledger[sessionKey]?.[filePath]) {
		return {
			entry: ledger[sessionKey][filePath],
			sourceSession: sessionKey,
			isDirect: true,
		};
	}

	// 2. Legacy root-level key lookup
	if (
		ledger[filePath] &&
		typeof ledger[filePath] === "object" &&
		!Array.isArray(ledger[filePath])
	) {
		return {
			entry: ledger[filePath],
			sourceSession: "legacy",
			isDirect: true,
		};
	}

	// 3. Cross-session lookup: find the newest read entry across all other sessions
	let newestEntry = null;
	let newestSession = null;

	for (const key of Object.keys(ledger)) {
		if (key === sessionKey) continue;
		const candidate = ledger[key]?.[filePath];
		if (candidate && typeof candidate === "object") {
			if (!newestEntry || (candidate.readAt || 0) > (newestEntry.readAt || 0)) {
				newestEntry = candidate;
				newestSession = key;
			}
		}
	}

	if (newestEntry) {
		return {
			entry: newestEntry,
			sourceSession: newestSession,
			isDirect: false,
		};
	}

	return null;
}

export function wasRead(ledger, filePath, sessionID = "global") {
	const sessionKey = sessionID || "global";
	const match = getReadRecord(ledger, filePath, sessionKey);
	if (!match) return false;

	// Direct session hit is always considered read
	if (match.isDirect) return true;

	// Cross-session fallback: verify file freshness on disk
	try {
		const st = statSync(filePath);
		const entry = match.entry;
		const mtimeMatch =
			entry.mtimeMs === undefined || Math.abs(st.mtimeMs - entry.mtimeMs) <= 1;
		const sizeMatch = entry.size === undefined || st.size === entry.size;

		if (mtimeMatch && sizeMatch) {
			// Re-sync to active session so subsequent checks are direct
			if (sessionKey) {
				ledger[sessionKey] = ledger[sessionKey] || {};
				ledger[sessionKey][filePath] = { ...entry, readAt: Date.now() };
			}
			return true;
		}
	} catch {}

	return false;
}

/**
 * True when the on-disk mtime/size no longer matches what the model read.
 */
export function isStale(ledger, filePath, sessionID = "global") {
	const sessionKey = sessionID || "global";
	const match = getReadRecord(ledger, filePath, sessionKey);
	if (!match) return false;

	const entry = match.entry;
	try {
		const st = statSync(filePath);
		if (entry.mtimeMs !== undefined && Math.abs(st.mtimeMs - entry.mtimeMs) > 1)
			return true;
		if (entry.size !== undefined && st.size !== entry.size) return true;
	} catch {
		return false; // file gone — let the write path decide
	}
	return false;
}

export function cleanupSessionLedger(ledger, sessionID) {
	if (sessionID && ledger[sessionID]) {
		delete ledger[sessionID];
	}
}

export function statOf(filePath) {
	try {
		const st = statSync(filePath);
		return { mtimeMs: st.mtimeMs, size: st.size };
	} catch {
		return null;
	}
}

/**
 * Re-mark files as freshly read with current disk state. Call after another
 * tool mutates a file so stale-write guards don't false-positive.
 */
export function refreshReads(filePaths, sessionID = "global") {
	const ledger = loadLedger();
	for (const filePath of filePaths) {
		const st = statOf(filePath);
		markRead(
			ledger,
			filePath,
			{ mtimeMs: st?.mtimeMs, size: st?.size },
			sessionID,
		);
	}
	saveLedger(ledger);
}

// ---- mode-state ----

const MODE_FILE = statePath("oh-my-hook-mode.json");
export const DEFAULT_PLANS_DIR = path.join(os.homedir(), ".opencode", "plans");

export function resolvePlansDir(config, directory) {
	const custom =
		config?.plans?.directory ||
		config?.guard?.plansDirectory ||
		config?.directory ||
		config?.plansDirectory;
	if (custom) {
		if (typeof custom === "string" && custom.startsWith("~"))
			return path.join(os.homedir(), custom.slice(1));
		return path.isAbsolute(custom)
			? custom
			: path.resolve(directory || process.cwd(), custom);
	}
	return DEFAULT_PLANS_DIR;
}

export function loadModeState() {
	return readJson(MODE_FILE, {});
}

export function saveModeState(state) {
	writeJson(MODE_FILE, state);
}

export function currentMode(state, sessionID) {
	return state[sessionID]?.mode ?? "execute";
}

export function setSessionMode(state, sessionID, mode, meta = {}) {
	const existing = state[sessionID] || {};
	state[sessionID] = {
		...existing,
		mode,
		...meta,
		updatedAt: new Date().toISOString(),
	};
	return state[sessionID];
}

export function currentPlan(state, sessionID) {
	const entry = state[sessionID];
	if (!entry?.planFile) return null;
	return {
		file: entry.planFile,
		name: entry.planName || "",
		kind: entry.planKind || "plan",
		updatedAt: entry.updatedAt,
	};
}

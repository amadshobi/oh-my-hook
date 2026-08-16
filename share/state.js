/**
 * state.js — shared persisted state + read-ledger.
 *
 * Read-ledger tracks files the model has actually read this session so
 * read-before-write and stale-write guards can enforce the Command
 * Code-style workflow: never edit a file you haven't read; never write a
 * file that changed on disk after you read it.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const STATE_DIR = path.join(os.homedir(), ".config", "opencode");

export function statePath(name) {
  return path.join(STATE_DIR, name);
}

export function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
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

export function wasRead(ledger, filePath, sessionID = "global") {
  const sessionKey = sessionID || "global";
  return Boolean(ledger[sessionKey]?.[filePath] || ledger[filePath]);
}

/**
 * True when the on-disk mtime/size no longer matches what the model read.
 */
export function isStale(ledger, filePath, sessionID = "global") {
  const sessionKey = sessionID || "global";
  const entry = ledger[sessionKey]?.[filePath] || ledger[filePath];
  if (!entry) return false;
  try {
    const st = statSync(filePath);
    if (entry.mtimeMs !== undefined && Math.abs(st.mtimeMs - entry.mtimeMs) > 1) return true;
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

// ---- mode-state ----

const MODE_FILE = statePath("oh-my-hook-mode.json");
export const DEFAULT_PLANS_DIR = path.join(os.homedir(), ".opencode", "plans");

export function resolvePlansDir(config, directory) {
  const custom = config?.plans?.directory || config?.guard?.plansDirectory;
  if (custom) {
    if (custom.startsWith("~")) return path.join(os.homedir(), custom.slice(1));
    return path.isAbsolute(custom) ? custom : path.resolve(directory || process.cwd(), custom);
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

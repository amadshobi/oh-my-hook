/**
 * guard/read-guard.js — Command Code-style read-before-write & stale-write
 * enforcement.
 *
 * - Tracks files the model has read (via tool.execute.after on `read`).
 * - Blocks `write`/`edit`/`patch` on existing files that were never read
 *   this session (read-before-write).
 * - Blocks writes when the on-disk file changed after the model read it
 *   (stale-write).
 * - New files (that don't exist yet) are always allowed.
 * - Exports a `refreshReads` helper so other plugins (e.g. dev-loop's
 *   auto-fix) can re-mark files after mutating them, preventing false
 *   stale loops.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { formatBlockMessage } from "../share/messages.js";
import { loadLedger, saveLedger, markRead, wasRead, isStale, statOf, cleanupSessionLedger } from "../share/state.js";
import { toolArgs, filePathOf } from "../share/hook.js";

// Tools that mutate file content (write path).
const WRITE_TOOLS = new Set(["write", "edit", "patch", "create"]);

// Tools that count as "reading" a file for the ledger.
const READ_TOOLS = new Set(["read"]);

// Skip enforcing for files outside the workspace root (config files etc.).
function isInsideWorkspace(filePath, cwd) {
  try {
    const normalized = path.resolve(filePath).split(path.sep).join("/");
    const root = path.resolve(cwd ?? process.cwd()).split(path.sep).join("/");
    return normalized.startsWith(root + "/") || normalized === root;
  } catch {
    return false;
  }
}

function existsOnDisk(filePath) {
  try {
    return existsSync(filePath);
  } catch {
    return false;
  }
}

export function createReadGuard({ directory, config, messages }) {
  const readBeforeWrite = config?.readBeforeWrite ?? true;
  const staleWrite = config?.staleWrite ?? true;
  const messagesConfig = messages ?? config?.messages ?? {};

  return {
    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const sessionID = event.properties?.sessionID;
        if (sessionID) {
          const ledger = loadLedger();
          cleanupSessionLedger(ledger, sessionID);
          saveLedger(ledger);
        }
      }
    },

    "tool.execute.after": async (input) => {
      const tool = input.tool;
      if (!READ_TOOLS.has(tool)) return;

      const args = toolArgs(input);
      const filePath = filePathOf(args);
      if (!filePath) return;

      const sessionID = input.sessionID || "global";
      const ledger = loadLedger();
      const st = statOf(filePath);
      markRead(ledger, filePath, { mtimeMs: st?.mtimeMs, size: st?.size }, sessionID);
      saveLedger(ledger);
    },

    "tool.execute.before": async (input) => {
      const tool = input.tool;
      if (!WRITE_TOOLS.has(tool)) return;

      const args = toolArgs(input);
      const filePath = filePathOf(args);
      if (!filePath) return;

      // Only enforce inside the workspace.
      if (!isInsideWorkspace(filePath, directory)) return;

      // New files are always fine.
      if (!existsOnDisk(filePath)) return;

      const sessionID = input.sessionID || "global";
      const ledger = loadLedger();

      // Read-before-write: never edit a file the model hasn't read.
      if (readBeforeWrite && !wasRead(ledger, filePath, sessionID)) {
        throw new Error(
          formatBlockMessage("readGuardUnread", { file: filePath, path: filePath }, messagesConfig)
        );
      }

      // Stale-write: file changed on disk after the model read it.
      if (staleWrite && isStale(ledger, filePath, sessionID)) {
        throw new Error(
          formatBlockMessage("readGuardStale", { file: filePath, path: filePath }, messagesConfig)
        );
      }
    },
  };
}

/**
 * Re-mark a file as freshly read with current disk state. Call this after
 * another tool mutates a file (e.g. dev-loop auto-fix) so read-guard
 * doesn't treat it as stale.
 */
export function refreshReads(filePaths, sessionID = "global") {
  const ledger = loadLedger();
  for (const filePath of filePaths) {
    const st = statOf(filePath);
    markRead(ledger, filePath, { mtimeMs: st?.mtimeMs, size: st?.size }, sessionID);
  }
  saveLedger(ledger);
}

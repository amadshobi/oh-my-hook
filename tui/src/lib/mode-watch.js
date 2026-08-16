/**
 * mode-watch.js — reactive watcher for oh-my-hook-mode.json
 *
 * Watches the configuration directory (rather than the individual file)
 * to remain robust across atomic file write/rename operations on Linux.
 * Uses a trailing debounce (default 50ms) to coalesce bursts of change events.
 */
import { watch, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { statePath, loadModeState, currentMode } from "../../../share/state.js";

const DEFAULT_TARGET_FILE = "oh-my-hook-mode.json";

/**
 * Watch for changes to the mode state file.
 *
 * @param {(state: Record<string, any>) => void} onUpdate Callback invoked with fresh state.
 * @param {object} [options]
 * @param {string} [options.stateDir] Custom directory to watch (defaults to ~/.config/opencode).
 * @param {string} [options.filename] Custom filename (defaults to oh-my-hook-mode.json).
 * @param {number} [options.debounceMs] Debounce delay in ms (defaults to 50ms).
 * @param {boolean} [options.immediate] Whether to invoke onUpdate immediately (defaults to true).
 * @returns {() => void} Dispose/cleanup function.
 */
export function watchModeState(onUpdate, options = {}) {
  const defaultDir = path.dirname(statePath(DEFAULT_TARGET_FILE));
  const dir = options.stateDir || defaultDir;
  const targetFile = options.filename || DEFAULT_TARGET_FILE;
  const debounceMs = options.debounceMs ?? 50;

  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {}
  }

  let debounceTimer = null;
  let watcher = null;
  let disposed = false;

  const triggerUpdate = () => {
    if (disposed) return;
    try {
      const state = loadModeState();
      onUpdate(state || {});
    } catch {
      onUpdate({});
    }
  };

  // Immediate first tick
  if (options.immediate !== false) {
    triggerUpdate();
  }

  try {
    watcher = watch(dir, (eventType, filename) => {
      if (disposed) return;
      // Handle both specific filename and null/undefined filename in some OSes
      if (!filename || filename === targetFile || filename.includes("mode")) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          triggerUpdate();
        }, debounceMs);
      }
    });

    watcher.on("error", () => {
      // Ignore watcher errors (e.g. temporary unlinks)
    });
  } catch {
    // Fallback if directory cannot be watched
  }

  return () => {
    disposed = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (watcher) {
      try {
        watcher.close();
      } catch {}
      watcher = null;
    }
  };
}

export { currentMode };

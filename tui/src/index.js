/**
 * tui/src/index.js — OpenCode TUI Plugin Entrypoint for oh-my-hook.
 *
 * Registers:
 *   1. `session_prompt_right` slot: `🔒 [plan mode]` badge.
 *   2. `sidebar_content` slot: `▼ oh-my-hook` collapsible status widget.
 */
import { watchModeState } from "./lib/mode-watch.js";
import { createSessionSubscriber, resolveActiveSessionID } from "./lib/session.js";
import { createModeBadge } from "./components/mode-badge.js";
import { createSidebarWidget } from "./components/sidebar-widget.js";

/**
 * OpenCode TUI plugin implementation.
 *
 * @param {object} api OpenCode TUI Plugin API
 * @param {object} [options] Plugin options
 * @param {object} [meta] Plugin metadata
 */
export async function tui(api, options = {}, meta = {}) {
  if (!api || !api.slots) return;

  let modeState = {};
  let activeSessionID = resolveActiveSessionID(api);
  const directory = options?.directory || process.cwd();

  // 1. Reactive file watcher for mode changes
  const unwatchMode = watchModeState((nextState) => {
    modeState = nextState;
  });

  // 2. Reactive session tracker for focused tab changes
  const unsubSession = createSessionSubscriber(api, (nextSessionID) => {
    activeSessionID = nextSessionID;
  });

  const getState = () => modeState;
  const getSessionID = () => activeSessionID;

  // 3. Register slots
  const ModeBadge = createModeBadge({ api, getState, getSessionID });
  const SidebarWidget = createSidebarWidget({ api, getState, getSessionID, directory });

  if (typeof api.slots.register === "function") {
    try {
      // Modern OpenCode V2 slot plugin registration
      api.slots.register({
        id: "oh-my-hook-tui-slots",
        slots: {
          session_prompt_right: ModeBadge,
          sidebar_content: SidebarWidget,
        },
      });
    } catch {}
  }

  const cleanup = () => {
    unwatchMode();
    unsubSession();
  };

  // 4. Lifecycle cleanup hook
  if (api.lifecycle?.onDispose) {
    api.lifecycle.onDispose(cleanup);
  }

  return cleanup;
}

export default {
  id: "oh-my-hook-tui",
  tui,
};

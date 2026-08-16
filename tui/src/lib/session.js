/**
 * session.js — resolves and subscribes to active OpenCode TUI session.
 *
 * Coordinates between `api.route.current` and `tui.session.select` events
 * to ensure UI components always bind to the tab currently focused by the user.
 */

/**
 * Resolve the current session ID from TUI route or state.
 *
 * @param {object} api OpenCode TUI Plugin API
 * @returns {string|null} Active session ID or null if not in session route.
 */
export function resolveActiveSessionID(api) {
  if (!api) return null;

  // 1. Check api.route.current (most accurate for focused tab)
  const currentRoute = api.route?.current;
  if (currentRoute?.name === "session" && currentRoute.params?.sessionID) {
    return String(currentRoute.params.sessionID);
  }

  // 2. Fallback to api.state.session
  if (api.state?.session?.id) {
    return String(api.state.session.id);
  }

  return null;
}

/**
 * Subscribe to session selection changes in OpenCode TUI.
 *
 * @param {object} api OpenCode TUI Plugin API
 * @param {(sessionID: string|null) => void} onChange Callback invoked when active session switches.
 * @returns {() => void} Unsubscribe cleanup function.
 */
export function createSessionSubscriber(api, onChange) {
  if (!api) return () => {};

  let lastSessionID = resolveActiveSessionID(api);
  let disposed = false;

  // Notify initial session ID
  onChange(lastSessionID);

  const checkAndUpdate = (nextID) => {
    if (disposed) return;
    const resolved = nextID || resolveActiveSessionID(api);
    if (resolved !== lastSessionID) {
      lastSessionID = resolved;
      onChange(resolved);
    }
  };

  const unsubs = [];

  // Listen for tui.session.select
  if (api.event?.on) {
    try {
      const unsubEvent = api.event.on("tui.session.select", (event) => {
        const sid = event?.sessionID || event?.properties?.sessionID;
        checkAndUpdate(sid);
      });
      if (typeof unsubEvent === "function") unsubs.push(unsubEvent);
    } catch {}

    // Also listen for route changes if emitted
    try {
      const unsubRoute = api.event.on("tui.route.change", (event) => {
        const sid = event?.params?.sessionID || event?.properties?.params?.sessionID;
        checkAndUpdate(sid);
      });
      if (typeof unsubRoute === "function") unsubs.push(unsubRoute);
    } catch {}
  }

  return () => {
    disposed = true;
    for (const unsub of unsubs) {
      try {
        unsub();
      } catch {}
    }
  };
}

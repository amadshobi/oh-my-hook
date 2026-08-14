/**
 * notify.js — shared structured logging helper.
 * Thin wrapper over `client.app.log` with safe fallback.
 */
export function createNotifier(client, defaultService = "oh-my-hook", defaultLevel = "info") {
  return async (message, level = defaultLevel, service = defaultService) => {
    try {
      await client?.app?.log?.({
        body: { service, level, message },
      });
    } catch {
      // logging must never break a hook
    }
  };
}

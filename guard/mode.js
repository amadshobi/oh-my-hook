/**
 * guard/mode.js — mode enforcement (plan vs execute), ported from the old
 * plugins/mode.js. Persists mode per-session to state, detects intent from
 * user prompts, and blocks mutating tools/commands while in plan mode.
 */
import { formatBlockMessage } from "../share/messages.js";
import { loadModeState, saveModeState, currentMode } from "../share/state.js";
import { createNotifier } from "../share/notify.js";

const PLAN_TRIGGERS = [
  "plan", "planning", "mikir", "arsitektur", "design", "rancang",
  "pikirkan", "analisis", "review dulu", "jangan edit", "jangan sentuh",
  "cuma bahas", "bahas dulu", "konsep", "skema", "alur",
];

const EXECUTE_TRIGGERS = [
  "gas", "approve", "lanjut", "eksekusi", "implement", "bikin", "kerjain",
  "mulai", "go ahead", "proceed", "jalanin", "kerjakan", "tulis",
];

const MUTATING_TOOLS = new Set(["edit", "write", "patch", "create", "delete", "rename"]);

const MUTATING_BASH_PATTERNS = [
  /git\s+(commit|push|merge|rebase|reset|checkout\s+-|switch\s+-c|branch\s+-d|tag\s+-)/,
  /git\s+(add|rm|mv)\s/,
  /\brm\b/, /\bmv\b/, /\bcp\b/, /\btouch\b/, /\bmkdir\b/, /\brmdir\b/,
  /\b(npm|pnpm|yarn|bun)\s+(install|add|remove|update|publish|run\s+(build|dev|test|lint))/,
  /\bpip\s+install/, /\bpoetry\s+install/, /\buv\s+add/, /\bcargo\s+(install|add|remove|update)/,
  /\bgo\s+(mod|install|get|build)/,
  /\bdocker\s+(build|run|compose\s+(up|down|build))/,
  /\bkubectl\s+(apply|create|delete|edit|rollout)/,
  /\bterraform\s+(apply|destroy)/,
  /\bsudo\b/, /\bkill\b/, /\bpkill\b/, /\bchmod\b/, /\bchown\b/,
  /\btee\b/, /\bdd\b/, /\bmkfs/, /\b>\/dev\/sd/,
  /\bsystemctl\s+(start|stop|restart|enable|disable)/,
  /\b(echo|printf|cat)\s+.*>\s+/,
];

function detectIntent(text) {
  const lower = text.toLowerCase();
  if (PLAN_TRIGGERS.some((w) => lower.includes(w))) return "plan";
  if (EXECUTE_TRIGGERS.some((w) => lower.includes(w))) return "execute";
  return null;
}

function isMutatingBash(command) {
  return MUTATING_BASH_PATTERNS.some((re) => re.test(command));
}

export const modeHooks = async ({ client }, opts = {}) => {
  const planModeEnabled = opts?.config?.planMode ?? true;
  const messagesConfig = opts?.messages ?? opts?.config?.messages ?? {};
  const notify = createNotifier(client, "mode", "info");

  return {
    // Detect mode from user prompt text parts.
    event: async ({ event }) => {
      if (!planModeEnabled) return;
      if (event.type !== "message.part.updated") return;
      const part = event.properties?.part;
      if (part?.type !== "text" || !part.text) return;
      const sessionID = event.properties?.sessionID;
      if (!sessionID) return;

      const intent = detectIntent(part.text.trim());
      if (!intent) return;

      const state = loadModeState();
      const previous = currentMode(state, sessionID);
      if (intent === "plan" && previous !== "plan") {
        state[sessionID] = { mode: "plan", updatedAt: new Date().toISOString() };
        saveModeState(state);
        await notify(`[${sessionID}] Mode plan AKTIF (user: "${part.text.slice(0, 60)}")`);
      } else if (intent === "execute" && previous !== "execute") {
        state[sessionID] = { mode: "execute", updatedAt: new Date().toISOString() };
        saveModeState(state);
        await notify(`[${sessionID}] Mode eksekusi AKTIF (user: "${part.text.slice(0, 60)}")`);
      }
    },

    "tool.execute.before": async (input) => {
      if (!planModeEnabled) return;
      const sessionID = input.sessionID;
      const mode = currentMode(loadModeState(), sessionID);
      if (mode !== "plan") return;

      const tool = input.tool;
      const args = input.args ?? {};

      if (MUTATING_TOOLS.has(tool)) {
        const target = typeof args === "string" ? args : (args?.filePath ?? args?.path ?? "");
        throw new Error(
          formatBlockMessage("modePlanTool", { tool, target: target || "file" }, messagesConfig)
        );
      }

      if (tool === "bash") {
        const command = typeof args === "string" ? args : (args?.command ?? args?.cmd ?? "");
        if (isMutatingBash(command)) {
          const displayCmd = command.slice(0, 60) + (command.length > 60 ? "..." : "");
          throw new Error(
            formatBlockMessage("modePlanBash", { command: displayCmd }, messagesConfig)
          );
        }
      }
    },
  };
};

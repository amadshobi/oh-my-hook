/**
 * reminder/checklist.js — nudges the model to break multi-step tasks into
 * a visible checklist (todos.json) instead of improvising.
 *
 * OpenCode can't hard-block a final answer, so this is a nudge: it
 * injects a reminder when a prompt looks like a multi-step task and the
 * session hasn't recorded a plan yet.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { formatWarnMessage } from "../share/messages.js";
import { createNotifier } from "../share/notify.js";

// Signals a prompt is a multi-step task (imperative, plural actions).
const MULTI_STEP_SIGNALS = [
  /\b(dan|and)\b.*\b(buat|bikin|buatin|implement|tambah|add|create|fix|refactor)\b/i,
  /\b(implement|refactor|setup|migrate|build)\b.*\b(untuk|for|di|in)\b/i,
  /\b(beberapa|semua|semua|each|every|all)\b/i,
  /\b(buat|bikin|tambah|buatin|implement|add|create)\b.*\b(serta|juga|also|and)\b/i,
];

function looksMultiStep(text) {
  return MULTI_STEP_SIGNALS.some((re) => re.test(text));
}

function sessionHasPlan(cwd) {
  const todoFile = path.join(cwd, ".opencode", "todos.json");
  if (!existsSync(todoFile)) return false;
  try {
    const todos = JSON.parse(readFileSync(todoFile, "utf8"));
    return Array.isArray(todos) && todos.length > 0;
  } catch {
    return false;
  }
}

export const checklistHooks = async ({ client, directory }, opts = {}) => {
  const enabled = opts?.config?.checklist ?? true;
  const messagesConfig = opts?.messages ?? opts?.config?.messages ?? {};
  const notify = createNotifier(client, "reminder", "info");

  return {
    "chat.message": async (input, output) => {
      if (!enabled) return;
      try {
        const text = output?.message?.text || output?.message?.content || "";
        if (typeof text !== "string" || !text.trim()) return;
        if (!looksMultiStep(text)) return;

        const cwd = directory || process.cwd();
        if (sessionHasPlan(cwd)) return;

        const warnMsg = formatWarnMessage("checklistNudge", {}, messagesConfig);
        await notify(`Multi-step task detected: ${warnMsg}`, "warn");
      } catch {}
    },
  };
};

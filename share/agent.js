/**
 * share/agent.js — resolve whether a session belongs to a primary or a
 * subagent.
 *
 * OpenCode's `experimental.chat.system.transform` hook only receives
 * `{ sessionID, model }` — no `agent`. So we build a session->agent cache
 * from the `chat.message` hook (which DOES receive `agent` + `sessionID`)
 * and combine it with the declarative `agent.<name>.mode` from config.
 *
 * Resolution order:
 *   1. `agent.<name>.mode` from OpenCode config (source of truth).
 *   2. Cached session -> agent name (from chat.message).
 *   3. Fallback: has sessionID -> primary; otherwise -> subagent.
 */
import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripJsoncComments } from "./config.js";

const sessionAgent = new Map();

/**
 * Read `agent.<name>.mode` from an OpenCode config file. Supports jsonc/json
 * by stripping comments before parsing. Returns a map of agent name -> mode.
 */
function readAgentModes(configFile) {
  try {
    if (!existsSync(configFile)) return {};
    const text = readFileSync(configFile, "utf8");
    const parsed = JSON.parse(stripJsoncComments(text));
    const agents = parsed?.agent ?? {};
    const out = {};
    for (const [name, def] of Object.entries(agents)) {
      if (def && typeof def === "object" && def.mode) {
        out[name] = def.mode;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Load agent modes from the user's OpenCode config. Prefers project-level
 * config, falls back to global, then merges (global first, project wins).
 */
export function loadAgentModes(directory) {
  const projectConfig = directory
    ? path.join(directory, "opencode.jsonc")
    : path.join(process.cwd(), "opencode.jsonc");
  const globalConfig = path.join(os.homedir(), ".config", "opencode", "opencode.jsonc");

  const globalModes = readAgentModes(globalConfig);
  const projectModes = readAgentModes(projectConfig);
  return { ...globalModes, ...projectModes };
}

/**
 * Record a session -> agent name association. Call this from `chat.message`.
 */
export function rememberSessionAgent(sessionID, agent) {
  if (sessionID && agent) sessionAgent.set(sessionID, agent);
}

/**
 * Resolve the mode ("primary" | "subagent" | "all") for a session.
 */
export function resolveAgentMode(input, agentModes = {}) {
  const sessionID = input?.sessionID;
  const agent = input?.agent ?? (sessionID ? sessionAgent.get(sessionID) : undefined);

  if (agent && agentModes[agent]) return agentModes[agent];

  // Fallback: a real sessionID strongly implies a primary session; subagent
  // sessions often have no stable sessionID in the hook input.
  return sessionID ? "primary" : "subagent";
}

/**
 * True when the context belongs to a subagent.
 */
export function isSubagent(input, agentModes = {}) {
  return resolveAgentMode(input, agentModes) === "subagent";
}

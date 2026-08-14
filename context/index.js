/**
 * context/index.js — assemble session context hooks.
 */
import { loadConfig } from "../share/config.js";
import { mergeHooks } from "../share/merge.js";
import { contextHooks } from "./context.js";
import { agentContextHooks } from "./agent-context.js";

export async function contextModule(input) {
  const { config } = loadConfig();
  const [session, agentContext] = await Promise.all([
    contextHooks(input, { config: config.context }),
    agentContextHooks(input, { config: config.context }),
  ]);
  return mergeHooks(session, agentContext);
}

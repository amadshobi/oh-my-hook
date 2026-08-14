/**
 * reminder/index.js — assemble reminder hooks (verify + checklist).
 */
import { loadConfig } from "../share/config.js";
import { mergeHooks } from "../share/merge.js";
import { verifyHooks } from "./verify.js";
import { checklistHooks } from "./checklist.js";

export async function reminderModule(input) {
  const { config } = loadConfig();
  const remCfg = config.reminder;
  const messagesCfg = config.messages;
  const [verify, checklist] = await Promise.all([
    verifyHooks(input, { config: remCfg, messages: messagesCfg }),
    checklistHooks(input, { config: remCfg, messages: messagesCfg }),
  ]);
  return mergeHooks(verify, checklist);
}

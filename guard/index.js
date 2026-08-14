/**
 * guard/index.js — assemble all guard hooks (mode + security + read-guard)
 * into a single hooks object.
 */
import { mergeHooks } from "../share/merge.js";
import { loadConfig } from "../share/config.js";
import { modeHooks } from "./mode.js";
import { securityHooks } from "./security.js";
import { createReadGuard } from "./read-guard.js";

export async function guardHooks(input) {
  const { config } = loadConfig();
  const guardCfg = config.guard;
  const messagesCfg = config.messages;
  const [mode, security, readGuard] = await Promise.all([
    modeHooks(input, { config: guardCfg, messages: messagesCfg }),
    securityHooks(input, { config: guardCfg, messages: messagesCfg }),
    createReadGuard({ ...input, config: guardCfg, messages: messagesCfg }),
  ]);
  return mergeHooks(mode, security, readGuard);
}

/**
 * oh-my-hook/index.js — single entry point for the oh-my-hook plugin set.
 *
 * Assembles guard (mode + security + read-guard), context (session),
 * and reminder (verify + checklist) into one hooks object. Registered in
 * opencode.jsonc (e.g. "oh-my-hook" or "./path/to/oh-my-hook/index.js").
 *
 * Loaded as a directory plugin: OpenCode resolves a directory without
 * package.json to its index file (index.js / index.ts).
 */
import { mergeHooks } from "./share/merge.js";
import { guardHooks } from "./guard/index.js";
import { contextModule } from "./context/index.js";
import { reminderModule } from "./reminder/index.js";
import { memoryHooks } from "./memory/index.js";
import { planHooks } from "./plans/index.js";

export default async function ohMyHook(input) {
  const [guard, context, reminder, memory, plans] = await Promise.all([
    guardHooks(input),
    contextModule(input),
    reminderModule(input),
    memoryHooks(input),
    planHooks(input),
  ]);
  return mergeHooks(guard, context, reminder, memory, plans);
}

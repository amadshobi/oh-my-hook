/**
 * memory/ai/index.js — AI adapter registry for memory capture.
 *
 * Adapters are pluggable so capture isn't hardcoded to one tool. Each
 * adapter exports { id, isAvailable(), run(prompt, opts) }. The default is
 * `commandcode` (calls `cmd -p`), but `opencode` and `omp` can be selected.
 */
import * as commandcode from "./commandcode.js";
import * as opencode from "./opencode.js";
import * as omp from "./omp.js";

export const ADAPTERS = {
  commandcode,
  opencode,
  omp,
};

/** Pick the best available adapter, preferring the explicit `prefer` id. */
export function pickAdapter(prefer) {
  if (prefer && ADAPTERS[prefer]) {
    const chosen = ADAPTERS[prefer];
    if (chosen.isAvailable()) return chosen;
  }
  for (const adapter of Object.values(ADAPTERS)) {
    if (adapter.isAvailable()) return adapter;
  }
  return null;
}

/** Run a capture prompt through the given adapter, returning its text. */
export async function capture(prompt, opts = {}) {
  const adapter = pickAdapter(opts.prefer);
  if (!adapter) throw new Error("No memory AI adapter available (need cmd or opencode)");
  return adapter.run(prompt, opts);
}

/**
 * merge.js — combine multiple hook objects into one.
 *
 * Hook keys that are functions (event handlers, tool.execute.*, etc.) are
 * combined so ALL registered hooks run, in order. Non-function values
 * (e.g. `tool` definitions) are merged by key with last-wins.
 */
export function mergeHooks(...hookObjects) {
  const out = {};
  for (const obj of hookObjects) {
    if (!obj) continue;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "function") {
        const prev = out[key];
        out[key] = prev
          ? async (input, output) => {
              await prev(input, output);
              await value(input, output);
            }
          : value;
      } else if (value !== undefined) {
        out[key] = { ...(out[key] ?? {}), ...value };
      }
    }
  }
  return out;
}

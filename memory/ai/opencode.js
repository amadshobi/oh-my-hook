/**
 * memory/ai/opencode.js — OpenCode adapter for memory capture.
 *
 * Runs `opencode run --format json -m <model> "<prompt>"` headless, parses
 * the JSON event stream, and returns the final text. Auto-deletes the
 * session it creates (OpenCode has no --no-session flag).
 */
import { execFileSync } from "node:child_process";

export const id = "opencode";

export function isAvailable() {
  try {
    execFileSync("opencode", ["--version"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function run(prompt, opts = {}) {
  const model = opts.model ?? "omp/hy3:free";
  const out = execFileSync(
    "opencode",
    ["run", "--format", "json", "-m", model, "--dir", opts.cwd ?? process.cwd(), prompt],
    {
      encoding: "utf8",
      timeout: opts.timeoutMs ?? 120_000,
      env: { ...process.env, NO_COLOR: "1" },
    }
  );
  const lines = out.trim().split("\n").filter(Boolean);
  const texts = [];
  let sessionID;
  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.sessionID) sessionID = evt.sessionID;
      if (evt.type === "text" && evt.part?.text) texts.push(evt.part.text);
    } catch {}
  }
  // Cleanup: delete the session this run created.
  if (sessionID) {
    try {
      execFileSync("opencode", ["session", "delete", sessionID], { stdio: "ignore", timeout: 15000 });
    } catch {}
  }
  return texts.join("\n").trim();
}

/**
 * memory/ai/commandcode.js — Command Code adapter for memory capture.
 *
 * Runs `cmd -p --no-session "<prompt>"` (Command Code headless, ephemeral
 * session — nothing persisted to disk). Command Code is already
 * authenticated on this machine and is the default capture AI.
 *
 * The `-p` flag runs non-interactive and prints the response; `--no-session`
 * keeps the capture out of the session log.
 */
import { execFileSync } from "node:child_process";

export const id = "commandcode";

export function isAvailable() {
  try {
    execFileSync("cmd", ["--version"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function run(prompt, opts = {}) {
  const cwd = opts.cwd;
  const args = ["-p", "--no-session"];
  if (opts.model) args.push("-m", opts.model);
  args.push(prompt);
  const out = execFileSync("cmd", args, {
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 120_000,
    cwd,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return out.trim();
}

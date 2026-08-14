/**
 * memory/ai/omp.js — omp (Pi agent) adapter for memory capture.
 *
 * Runs `omp -p --no-session --model <model> --mode json "<prompt>"`
 * non-interactively with an ephemeral session (nothing saved to disk).
 * omp is the Pi coding agent (fast, cheap models) — good for distill-style
 * tasks like /capture.
 */
import { execFileSync } from "node:child_process";

export const id = "omp";

export function isAvailable() {
  try {
    execFileSync("omp", ["--version"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function run(prompt, opts = {}) {
  const model = opts.model ?? "gemini-3.6-flash";
  const out = execFileSync(
    "omp",
    ["-p", "--no-session", "--model", model, "--mode", "json", "--cwd", opts.cwd ?? process.cwd(), prompt],
    {
      encoding: "utf8",
      timeout: opts.timeoutMs ?? 120_000,
      env: { ...process.env, NO_COLOR: "1" },
    }
  );
  // omp --mode json emits an NDJSON event stream. Extract the final text
  // from the `message_end` event (authoritative assistant message). Avoid
  // agent_end (contains the whole history incl. user msg) and turn_end.
  const texts = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    try {
      const evt = JSON.parse(line);
      if (evt.type !== "message_end") continue;
      if (evt.message?.role && evt.message.role !== "assistant") continue;
      const content = evt.message?.content;
      if (typeof content === "string") {
        texts.push(content);
      } else if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === "text" && c.text && c.text.trim()) texts.push(c.text);
        }
      }
    } catch {}
  }
  if (texts.length > 0) return texts.join("").trim();
  return out.trim();
}

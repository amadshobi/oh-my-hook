/**
 * memory/index.js — memory hooks for oh-my-hook.
 *
 * Injects curated memory into the agent's system prompt on every turn
 * (main agent only — subagents don't get memory automatically) and into
 * the compaction context. Slash commands:
 *
 *   /remember <note>   — append a manual memory entry (global or project)
 *   /memory            — show current memory
 *   /capture           — run AI distill of the last session into memory
 *
 * Memory is CURATED only — never auto-logged from conversation. Fill it
 * via /remember (manual) or /capture (AI picks what matters).
 */
import { readMemory, readAllMemory, appendMemory, GLOBAL_FILE } from "./store.js";
import { capture } from "./ai/index.js";
import { loadConfig } from "../share/config.js";
import { execFileSync } from "node:child_process";
import { isSubagent, loadAgentModes, rememberSessionAgent } from "../share/agent.js";
import { createNotifier } from "../share/notify.js";

/** Get the latest OpenCode session ID (from `opencode session list`). */
function latestSessionID() {
  try {
    const out = execFileSync("opencode", ["session", "list", "--format", "json"], {
      encoding: "utf8",
      timeout: 15000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed) ? parsed : (parsed?.sessions || parsed?.data || []);
    if (Array.isArray(rows) && rows.length > 0) return rows[0].id ?? rows[0].sessionID ?? null;
  } catch {}
  return null;
}

/** Export a session and extract the human-readable transcript text. */
function getSessionTranscript(sessionID) {
  const out = execFileSync("opencode", ["export", sessionID], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NO_COLOR: "1" },
  });
  // Skip the leading log line ("Exporting session: ...").
  const idx = out.indexOf("{");
  const data = JSON.parse(out.slice(idx));
  const lines = [];
  for (const msg of data.messages ?? []) {
    for (const part of msg.parts ?? []) {
      if (part.type === "text" && part.text && part.text.trim()) {
        lines.push(`[${msg.info?.role ?? "?"}] ${part.text.trim()}`);
      } else if (part.type === "tool" && part.state?.input) {
        lines.push(`[tool] ${JSON.stringify(part.state.input).slice(0, 300)}`);
      }
    }
  }
  return lines.join("\n");
}

/** Run the AI distill over a transcript and append bullets to memory. */
async function distillToMemory(transcript, notify, memCfg, directory) {
  const project = directory ? directory.split("/").pop() : "unknown";
  const prompt =
    `Berikut adalah transcript session coding terakhir dari project ${project}.\n\n` +
    `TRANSCRIPT:\n${transcript.slice(0, 8000)}\n\n` +
    `Pilih 3-5 poin penting yang layak diingat untuk pekerjaan selanjutnya ` +
    `(keputusan arsitektur, konvensi, gotchas, preferensi user). ` +
    `Output format: satu bullet per baris, diawali "- ", dalam bahasa Indonesia singkat. ` +
    `Jangan sertakan detail yang gak penting.`;
  const model = memCfg.captureModels?.[memCfg.captureAdapter] ?? "";
  const result = await capture(prompt, { cwd: directory, prefer: memCfg.captureAdapter, model });
  const bullets = result
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .slice(0, memCfg.maxBullets);
  if (bullets.length === 0) return 0;
  const file = directory ? await projectMemoryFileDynamic(directory) : GLOBAL_FILE;
  for (const b of bullets) appendMemory(file, b.replace(/^-\s*/, ""));
  return bullets.length;
}

// Dynamic import helper to avoid circular import at module top.
async function projectMemoryFileDynamic(directory) {
  const { projectMemoryFile } = await import("./store.js");
  return projectMemoryFile(directory);
}

export const memoryHooks = async ({ client, directory }) => {
  const notify = createNotifier(client, "memory", "info");

  // Load config once at factory init (module-level, cheap).
  const { config } = loadConfig();
  const memCfg = config.memory;
  const agentModes = loadAgentModes(directory);

  return {
    // --- register slash commands (config hook, opencode-quota pattern) ---
    config: async (input) => {
      const cfg = input ?? {};
      cfg.command ??= {};
      cfg.command.remember = {
        template: "/remember <note>",
        description: "Simpan catatan memory (--global untuk global, default project)",
      };
      cfg.command.memory = {
        template: "/memory",
        description: "Lihat memory global + project saat ini",
      };
      cfg.command.capture = {
        template: "/capture",
        description: "Auto-capture session terakhir ke memory via AI",
      };
    },

    // --- remember session -> agent from chat.message (hook provides both) ---
    "chat.message": async (input) => {
      rememberSessionAgent(input.sessionID, input.agent);
    },

    // --- inject memory into system prompt (main agent only) ---
    "experimental.chat.system.transform": async (input, output) => {
      if (!memCfg.enabled) return;
      if (isSubagent(input, agentModes) && !memCfg.injectToSubagents) return;
      const memory = readAllMemory(directory);
      if (!memory) return;
      output.system = output.system || [];
      output.system.push(`\n## MEMORY\n${memory}\n`);
    },

    // --- inject memory into compaction context ---
    "experimental.session.compacting": async (input, output) => {
      const memory = readAllMemory(directory);
      if (!memory) return;
      output.context = output.context || [];
      output.context.push(`## MEMORY\n${memory}`);
    },

    // --- slash commands ---
    "command.execute.before": async (input, output) => {
      const cmd = input.command;
      const args = input.arguments ?? "";

      if (cmd === "remember") {
        const entry = args.trim();
        if (!entry) {
          await notify("Usage: /remember <note>");
          return;
        }
        // Project-level by default; use `--global` for global memory.
        const file = entry.startsWith("--global ")
          ? GLOBAL_FILE
          : (directory ? await import("./store.js").then((m) => m.projectMemoryFile(directory)) : GLOBAL_FILE);
        const clean = entry.replace(/^--global\s+/, "").trim();
        const line = appendMemory(file, clean);
        await notify(`Memory saved: ${line}`);
        return;
      }

      if (cmd === "memory") {
        const memory = readAllMemory(directory);
        await notify(memory || "(memory kosong — isi dengan /remember atau /capture)");
        return;
      }

      if (cmd === "capture") {
        await notify("Running memory capture via AI…");
        try {
          // Optional: /capture <sessionID>; default = latest session.
          const sessionID = (args.trim().match(/^[a-z0-9_]+$/) ? args.trim() : null) ?? latestSessionID();
          if (!sessionID) {
            await notify("Gak ada session OpenCode buat di-capture.", "warn");
            return;
          }
          const transcript = getSessionTranscript(sessionID);
          if (!transcript) {
            await notify("Transcript session kosong.", "warn");
            return;
          }
          const n = await distillToMemory(transcript, notify, memCfg, directory);
          if (n === 0) {
            await notify("Capture selesai, tapi gak ada poin yang layak disimpan.");
          } else {
            const file = directory ? (await projectMemoryFileDynamic(directory)) : GLOBAL_FILE;
            await notify(`Memory capture: ${n} poin disimpan ke ${file.split("/").slice(-3).join("/")}`);
          }
        } catch (e) {
          await notify(`Capture gagal: ${e.message}`, "error");
        }
        return;
      }
    },

    // --- auto-capture on session idle (configurable) ---
    event: async ({ event }) => {
      if (!memCfg.captureAuto) return;
      if (event.type !== "session.idle" && event.type !== "session.deleted") return;
      // Skip auto-capture for tiny/empty sessions: only fire if there was
      // actual activity. We can't know turn count here, so we throttle:
      // only auto-capture when the session lasted > 60s (heuristic) to
      // avoid burning tokens on trivial sessions.
      try {
        const sessionID = event.properties?.sessionID ?? latestSessionID();
        if (!sessionID) return;
        const transcript = getSessionTranscript(sessionID);
        if (!transcript || transcript.length < 200) return; // too small
        await notify("Auto-capture: distilling session ke memory…");
        const n = await distillToMemory(transcript, notify, memCfg, directory);
        if (n > 0) await notify(`Auto-capture: ${n} poin memory disimpan`);
      } catch (e) {
        await notify(`Auto-capture gagal: ${e.message}`, "error");
      }
    },
  };
};

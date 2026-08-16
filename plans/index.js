/**
 * plans/index.js — slash command engine for /plan, /design, /approve, /exec, /mode.
 */
import { parsePlanningCommand, parseApproveCommand } from "./commands.js";
import { resolveTargetPlanPath, archivePlanFile } from "./store.js";
import { loadTemplate, renderTemplate } from "./templates.js";
import {
  loadModeState,
  saveModeState,
  setSessionMode,
  currentMode,
  currentPlan,
  resolvePlansDir,
} from "../share/state.js";
import { createNotifier } from "../share/notify.js";

export const planHooks = async ({ client, directory, worktree }, opts = {}) => {
  const config = opts?.config || {};
  const plansEnabled = config?.plans?.enabled ?? true;
  const plansDir = resolvePlansDir(config, directory || process.cwd());
  const notify = createNotifier(client, "plans", "info");

  return {
    // 1. Register slash commands in OpenCode command palette
    config: async (cfg) => {
      if (!plansEnabled) return;
      cfg.command = cfg.command || {};

      cfg.command["plan"] = {
        description: "Switch to Plan mode (use 'to-file <name>' to generate durable plan file)",
        template: "Entering Plan mode...",
      };

      cfg.command["design"] = {
        description: "Switch to UI/UX Design mode (use 'to-file <name>' for design docs)",
        template: "Entering Design mode...",
      };

      cfg.command["approve"] = {
        description: "Approve plan and switch to Execute mode",
        template: "Plan approved. Switching to Execute mode...",
      };

      cfg.command["exec"] = {
        description: "Alias for /approve (switch to Execute mode)",
        template: "Switching to Execute mode...",
      };

      cfg.command["mode"] = {
        description: "Display current oh-my-hook mode for this session",
        template: "Checking mode status...",
      };
    },

    // 2. Intercept command execution
    "command.execute.before": async (input, output) => {
      if (!plansEnabled) return;
      const cmd = input.command?.toLowerCase();
      const sessionID = input.sessionID || "default";

      if (cmd === "plan" || cmd === "design") {
        const kind = cmd === "design" ? "design" : "plan";
        const parsed = parsePlanningCommand(input.arguments || "", kind);
        const state = loadModeState();

        let planFile = "";
        let planName = "";
        let fileInstruction = "Diskusikan rencana dan analisis langsung di chat (In-Chat Mode).";

        if (parsed.mode === "file") {
          const target = resolveTargetPlanPath(plansDir, parsed.name, kind);
          planFile = target.filePath;
          planName = target.sanitizedName;

          // Auto-archive previous version if exists
          const archived = archivePlanFile(target.filePath, target.targetDir, target.sanitizedName);
          if (archived) {
            await notify(`Versi lama di-backup ke ${archived}`);
          }

          fileInstruction =
            `Kamu DIHARUSKAN menulis dokumen ${kind} lengkap ke file:\n` +
            `\`${planFile}\`\n\n` +
            `Gunakan tool write/edit untuk membuat dan memperbarui file rencana tersebut. ` +
            `HANYA file rencana ini yang diizinkan untuk ditulis dalam mode plan.`;
        }

        setSessionMode(state, sessionID, "plan", {
          planFile,
          planName,
          planKind: kind,
          planModeType: parsed.mode,
        });
        saveModeState(state);

        const template = loadTemplate(kind, directory);
        const rendered = renderTemplate(template, {
          topic: parsed.topic || `Perancangan ${kind}`,
          file_instruction: fileInstruction,
          plan_file: planFile,
          plan_name: planName,
          session_id: sessionID,
          target_dir: plansDir,
        });

        output.parts = [{ type: "text", text: rendered }];
        await notify(`[${sessionID}] Mode ${kind.toUpperCase()} aktif (${parsed.mode})`);
        return;
      }

      if (cmd === "approve" || cmd === "exec") {
        const parsed = parseApproveCommand(input.arguments || "");
        const state = loadModeState();
        const activePlan = currentPlan(state, sessionID);

        setSessionMode(state, sessionID, "execute");
        saveModeState(state);

        let planRef = "";
        if (activePlan?.file) {
          planRef = `Referensi Rencana:\n\`${activePlan.file}\``;
        }

        const template = loadTemplate("approve", directory);
        const rendered = renderTemplate(template, {
          plan_reference: planRef,
          notes: parsed.notes,
          session_id: sessionID,
        });

        output.parts = [{ type: "text", text: rendered }];
        await notify(`[${sessionID}] Mode EXECUTE aktif (Approved)`);
        return;
      }

      if (cmd === "mode") {
        const state = loadModeState();
        const mode = currentMode(state, sessionID);
        const activePlan = currentPlan(state, sessionID);

        let info = `Mode session saat ini: **${mode.toUpperCase()}**`;
        if (activePlan?.file) {
          info += `\nFile plan aktif: \`${activePlan.file}\``;
        }

        output.parts = [{ type: "text", text: info }];
      }
    },
  };
};

export default planHooks;

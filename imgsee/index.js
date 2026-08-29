/**
 * imgsee/index.js — Multimodal Vision Inspection Hook Module.
 *
 * Provides:
 *   - Native OpenCode agent tool: `imgsee` (delegating vision to OMP local gateway)
 *   - Unified slash command: `/imgsee <path> [question]`
 *   - System prompt hint ensuring agents use `imgsee` for any image/screenshot tasks
 */
import { createImgseeTool, executeImgseeTool } from "./tool.js";
import { createNotifier } from "../share/notify.js";
import { createHandledError, deliverCommandOutput } from "../share/handled.js";
import { isSubagent, loadAgentModes } from "../share/agent.js";

export const imgseeModule = async (input, opts = {}) => {
	const client = input?.client;
	const directory = input?.directory || process.cwd();
	const config = opts?.config || {};
	const imgseeCfg = config.imgsee || {};
	const notify = createNotifier(client, "imgsee", "info");
	const agentModes = loadAgentModes(directory);

	return {
		// --- 1. Native Agent Tool (`imgsee`) ---
		...(imgseeCfg.enabled !== false
			? {
					tool: {
						imgsee: createImgseeTool({
							config: imgseeCfg,
							directory,
						}),
					},
				}
			: {}),

		// --- 2. Register Slash Command `/imgsee` ---
		config: async (cfgInput) => {
			if (imgseeCfg.enabled === false) return;
			const cfg = cfgInput ?? {};
			cfg.command ??= {};
			cfg.command.imgsee = {
				template: "/imgsee $ARGUMENTS",
				description:
					"Inspect and analyze image or screenshot: /imgsee <path_or_url> [question]",
			};
		},

		// --- 3. System Prompt Guidance: Force agents to use `imgsee` for images ---
		"experimental.chat.system.transform": async (sysInput, sysOutput) => {
			if (imgseeCfg.enabled === false) return;
			if (isSubagent(sysInput, agentModes)) return;

			sysOutput.system = sysOutput.system || [];
			sysOutput.system.push(
				`\n[VISION & IMAGE INSPECTION RULE]\n` +
					`If you need to inspect, view, OCR, debug, or analyze ANY local image file, screenshot, UI layout, or diagram: ` +
					`ALWAYS call the native tool \`imgsee(path, question)\`. ` +
					`NEVER attempt to read binary image files with \`read\` or complain about missing vision capabilities, as \`imgsee\` automatically delegates visual processing to the multimodal vision gateway.\n`,
			);
		},

		// --- 4. Execute `/imgsee` slash command directly without LLM ---
		"command.execute.before": async (cmdInput, cmdOutput) => {
			if (cmdInput.command !== "imgsee") return;
			if (imgseeCfg.enabled === false) return;

			const rawArgs = (cmdInput.arguments ?? "").trim();
			const sessionID = cmdInput.sessionID;

			async function respond(text, variant = "info") {
				if (cmdOutput) cmdOutput.parts = [];
				const delivered = await deliverCommandOutput(client, sessionID, text);
				if (!delivered) {
					await notify(text, variant);
				}
				throw createHandledError();
			}

			if (!rawArgs) {
				await respond(
					"Usage: /imgsee <path_or_url> [question/instruction]\nExample: /imgsee screenshot.png 'What error is shown?'",
					"warn",
				);
			}

			// Parse path and optional question
			const parts = rawArgs.split(/\s+/);
			const imagePath = parts[0];
			const question = parts.slice(1).join(" ").trim() || undefined;

			try {
				const res = await executeImgseeTool(
					{ path: imagePath, question },
					{ directory },
					imgseeCfg,
				);
				await respond(res.output);
			} catch (err) {
				await respond(`Failed to inspect image: ${err.message}`, "error");
			}
		},
	};
};

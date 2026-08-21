/**
 * plans/index.js — Complete Planning suite for oh-my-hook:
 * 1. Slash commands (/plan, /design, /approve, /exec, /mode).
 * 2. Plan mode intent detection (via chat.message & message.part.updated).
 * 3. Plan mode mutation barrier (tool.execute.before & permission.ask).
 * 4. Durable plan file versioning & 3-level prompt templates.
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
import { isPathInside } from "../share/path.js";
import {
	toolArgs,
	bashCommand,
	filePathOf,
	extractUserText,
} from "../share/hook.js";
import { formatBlockMessage } from "../share/messages.js";
import { createNotifier } from "../share/notify.js";

const PLAN_TRIGGERS = [
	"plan",
	"planning",
	"mikir",
	"arsitektur",
	"design",
	"rancang",
	"pikirkan",
	"analisis",
	"review dulu",
	"jangan edit",
	"jangan sentuh",
	"cuma bahas",
	"bahas dulu",
	"konsep",
	"skema",
	"alur",
];

const EXECUTE_TRIGGERS = [
	"gas",
	"approve",
	"lanjut",
	"eksekusi",
	"implement",
	"bikin",
	"kerjain",
	"mulai",
	"go ahead",
	"proceed",
	"jalanin",
	"kerjakan",
	"tulis",
];

const MUTATING_TOOLS = new Set([
	"edit",
	"write",
	"patch",
	"create",
	"delete",
	"rename",
]);

const MUTATING_BASH_PATTERNS = [
	/git\s+(commit|push|merge|rebase|reset|checkout\s+-|switch\s+-c|branch\s+-d|tag\s+-)/,
	/git\s+(add|rm|mv)\s/,
	/\brm\b/,
	/\bmv\b/,
	/\bcp\b/,
	/\btouch\b/,
	/\bmkdir\b/,
	/\brmdir\b/,
	/\b(npm|pnpm|yarn|bun)\s+(install|add|remove|update|publish|run\s+(build|dev|test|lint))/,
	/\bpip\s+install/,
	/\bpoetry\s+install/,
	/\buv\s+add/,
	/\bcargo\s+(install|add|remove|update)/,
	/\bgo\s+(mod|install|get|build)/,
	/\bdocker\s+(build|run|compose\s+(up|down|build))/,
	/\bkubectl\s+(apply|create|delete|edit|rollout)/,
	/\bterraform\s+(apply|destroy)/,
	/\bsudo\b/,
	/\bkill\b/,
	/\bpkill\b/,
	/\bchmod\b/,
	/\bchown\b/,
	/\btee\b/,
	/\bdd\b/,
	/\bmkfs/,
	/\b>\/dev\/sd/,
	/\bsystemctl\s+(start|stop|restart|enable|disable)/,
	/\b(echo|printf|cat)\s+.*>\s+/,
];

function detectIntent(text) {
	if (!text || typeof text !== "string") return null;
	const lower = text.toLowerCase();
	if (PLAN_TRIGGERS.some((w) => lower.includes(w))) return "plan";
	if (EXECUTE_TRIGGERS.some((w) => lower.includes(w))) return "execute";
	return null;
}

function isMutatingBash(command) {
	if (!command || typeof command !== "string") return false;
	return MUTATING_BASH_PATTERNS.some((re) => re.test(command));
}

export const planHooks = async ({ client, directory }, opts = {}) => {
	const config = opts?.config || {};
	const plansEnabled = config?.plans?.enabled ?? true;
	const planModeEnabled =
		config?.plans?.planMode ??
		config?.plans?.enabled ??
		config?.guard?.planMode ??
		config?.sandbox?.planMode ??
		true;
	const messagesConfig = opts?.messages ?? opts?.config?.messages ?? {};
	const plansDir = resolvePlansDir(config, directory || process.cwd());
	const notify = createNotifier(client, "plans", "info");

	const handleIntent = async (sessionID, text, source = "event") => {
		if (!planModeEnabled || !sessionID || !text) return;
		if (text.startsWith("/")) return;

		const intent = detectIntent(text);
		if (!intent) return;

		const state = loadModeState();
		const previous = currentMode(state, sessionID);
		if (intent === "plan" && previous !== "plan") {
			setSessionMode(state, sessionID, "plan");
			saveModeState(state);
			await notify(
				`[${sessionID}] Mode plan AKTIF (${source}: "${text.slice(0, 60)}")`,
			);
		} else if (intent === "execute" && previous !== "execute") {
			setSessionMode(state, sessionID, "execute");
			saveModeState(state);
			await notify(
				`[${sessionID}] Mode eksekusi AKTIF (${source}: "${text.slice(0, 60)}")`,
			);
		}
	};

	return {
		// 1. Register slash commands in OpenCode command palette
		config: async (cfg) => {
			if (!plansEnabled) return;
			cfg.command = cfg.command || {};

			cfg.command["plan"] = {
				description:
					"Switch to Plan mode (use 'to-file <name>' to generate durable plan file)",
				template: "Entering Plan mode...",
			};

			cfg.command["design"] = {
				description:
					"Switch to UI/UX Design mode (use 'to-file <name>' for design docs)",
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
				let fileInstruction =
					"Diskusikan rencana dan analisis langsung di chat (In-Chat Mode).";

				if (parsed.mode === "file") {
					const target = resolveTargetPlanPath(plansDir, parsed.name, kind);
					planFile = target.filePath;
					planName = target.sanitizedName;

					// Auto-archive previous version if exists
					const archived = archivePlanFile(
						target.filePath,
						target.targetDir,
						target.sanitizedName,
					);
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
				await notify(
					`[${sessionID}] Mode ${kind.toUpperCase()} aktif (${parsed.mode})`,
				);
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

		// 3. Detect intent from message streams and chat turns
		event: async ({ event }) => {
			if (!planModeEnabled) return;
			if (event?.type !== "message.part.updated") return;
			const part = event.properties?.part;
			if (part?.type !== "text" || !part.text) return;
			const text = part.text.trim();
			const sessionID = event.properties?.sessionID;
			await handleIntent(sessionID, text, "event");
		},

		"chat.message": async (input, output) => {
			if (!planModeEnabled) return;
			const sessionID = input?.sessionID;
			const userText = extractUserText(input, output);
			if (userText) {
				await handleIntent(sessionID, userText, "turn");
			}
		},

		// 4. Native OpenCode permission auto-deny during plan mode
		"permission.ask": async (input, output) => {
			if (!planModeEnabled || !output || !input) return;
			const sessionID = input.sessionID;
			const state = loadModeState();
			if (currentMode(state, sessionID) !== "plan") return;

			const action = input.action || "";
			const resources = Array.isArray(input.resources) ? input.resources : [];

			if (MUTATING_TOOLS.has(action)) {
				const activePlan = currentPlan(state, sessionID);
				for (const res of resources) {
					if (
						res &&
						(res === activePlan?.file || isPathInside(plansDir, res, directory))
					) {
						continue; // Allowed plan file
					}
					output.status = "deny";
					return;
				}
			}
		},

		// 5. Hard barrier on tool execution in plan mode
		"tool.execute.before": async (input, output) => {
			if (!planModeEnabled) return;
			const sessionID = input?.sessionID;
			const state = loadModeState();
			const mode = currentMode(state, sessionID);
			if (mode !== "plan") return;

			const tool = input?.tool;
			const args = toolArgs(input, output);

			if (MUTATING_TOOLS.has(tool)) {
				const target = filePathOf(args);

				// Whitelist: allow modifying active plan file or files within plans directory
				const activePlan = currentPlan(state, sessionID);
				if (
					target &&
					(target === activePlan?.file ||
						isPathInside(plansDir, target, directory))
				) {
					return; // ALLOW writing/editing plan document
				}

				throw new Error(
					formatBlockMessage(
						"modePlanTool",
						{ tool, target: target || "file" },
						messagesConfig,
					),
				);
			}

			if (tool === "bash") {
				const command = bashCommand(args);
				if (isMutatingBash(command)) {
					const displayCmd =
						command.slice(0, 60) + (command.length > 60 ? "..." : "");
					throw new Error(
						formatBlockMessage(
							"modePlanBash",
							{ command: displayCmd },
							messagesConfig,
						),
					);
				}
			}
		},
	};
};

export default planHooks;

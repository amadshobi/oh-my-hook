/**
 * plans/index.js — Complete Planning suite for oh-my-hook:
 * 1. Slash commands (/plan, /design, /approve, /exec, /mode).
 * 2. Commands: /plan list, /plan review [name], /plan switch <name>, /plan to-file <name>.
 * 3. Plan mode intent detection (via chat.message & message.part.updated).
 * 4. Plan mode mutation barrier (tool.execute.before & permission.ask).
 * 5. Dynamic Active Plan injection into experimental.chat.system.transform.
 * 6. Durable plan file versioning & 3-level prompt templates.
 */
import { loadConfig } from "../share/config.js";
import { parsePlanningCommand, parseApproveCommand } from "./commands.js";
import {
	resolveTargetPlanPath,
	archivePlanFile,
	listPlanFiles,
	readPlanContent,
} from "./store.js";
import { parsePlanLines, formatReviewFeedback } from "./parser.js";
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

// Explicit, unambiguous intent triggers ONLY. Conversational phrases
// ("mikir dulu", "bahas dulu", "jangan edit", ...) are intentionally
// excluded — they caused false positives that locked sessions into Plan
// Mode mid-chat. Activation is opt-in via /plan, /design, /mode plan,
// or an explicit "enter/switch to plan mode" instruction.
const PLAN_INTENT_PATTERNS = [
	/\b(masuk|switch|ke)\s+(ke\s+)?mode\s+(plan|planning|desain|design)\b/i,
	/\b(enter|start|switch)\s+(to\s+)?(plan|planning|design)\s+mode\b/i,
	/\b(pindah|ganti|masuk)\s+(ke\s+)?(plan|planning|design)\s+mode\b/i,
];

const EXECUTE_INTENT_PATTERNS = [
	/\b(masuk|switch|ke)\s+(ke\s+)?mode\s+(execute|eksekusi|exec)\b/i,
	/\b(plan\s+approved|sudah\s+approve|approved,\s*gasken|approve\s+plan)\b/i,
	/\b(gasken|gas\s+blin|gas\s+lah|langsung\s+gas|gas\s+eksekusi)\b/i,
	/\b(eksekusi\s+(sekarang|kodenya)|implementasikan\s+sekarang|mulai\s+coding)\b/i,
	/\b(proceed|go\s+ahead|execute\s+plan)\b/i,
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

/** Detect explicit plan-mode intent from user text. Exported for tests. */
export function detectPlanIntent(text) {
	if (!text || typeof text !== "string") return false;
	return PLAN_INTENT_PATTERNS.some((re) => re.test(text.trim()));
}

/** Detect explicit execute-mode intent from user text. Exported for tests. */
export function detectExecuteIntent(text) {
	if (!text || typeof text !== "string") return false;
	return EXECUTE_INTENT_PATTERNS.some((re) => re.test(text.trim()));
}

function detectIntent(text) {
	if (!text || typeof text !== "string") return null;
	const trimmed = text.trim();
	// Check execute intent first (e.g. "plan approved", "gasken")
	if (detectExecuteIntent(trimmed)) return "execute";
	if (detectPlanIntent(trimmed)) return "plan";
	return null;
}

function isMutatingBash(command) {
	if (!command || typeof command !== "string") return false;
	return MUTATING_BASH_PATTERNS.some((re) => re.test(command));
}

const GOBLIN_PLAN_PROTOCOL = `
### 🧙‍♂️ GOBLIN PLAN PROTOCOL:
When user assigns a major or multi-file feature (≥3 files or architectural refactor), DO NOT silently lock the session into Plan Mode without approval.
Ask user confirmation first using the \`question\` tool:
- header: "Plan Mode?"
- question: "This task involves architectural changes across multiple files, BOSS. Enter Plan Mode first to design the blueprint?"
- options:
  1. label: "Yes, blin (Recommended)", description: "Enter Plan Mode and create a structured RFC document"
  2. label: "Nope, proceed directly!", description: "Execute implementation immediately without plan file"
Exception: If the user explicitly uses /plan or asks to create a plan from the start, enter Plan Mode directly without asking.
`.trim();

export const planHooks = async ({ client, directory }, opts = {}) => {
	const config = opts?.config || loadConfig().config;
	const plansEnabled = config?.plans?.enabled ?? true;
	const planModeEnabled =
		config?.plans?.planMode ??
		config?.plans?.enabled ??
		config?.guard?.planMode ??
		config?.sandbox?.planMode ??
		true;
	// Explicit intent detection toggle: when disabled, mode switching is
	// 100% slash-command driven (no chat/message-part scanning at all).
	const autoDetectIntent = config?.plans?.autoDetectIntent ?? true;
	const intentDetectionEnabled = planModeEnabled && autoDetectIntent;
	const messagesConfig = opts?.messages ?? opts?.config?.messages ?? {};
	const plansDir = resolvePlansDir(config, directory || process.cwd());
	const notify = createNotifier(client, "plans", "info");
	const assistantMessageIDs = new Set();

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
					"Switch to Plan mode (use 'to-file <name>', 'list', 'review', or 'switch <name>')",
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

				// Subcommand: /plan list
				if (parsed.mode === "list") {
					const files = listPlanFiles(plansDir);
					if (files.length === 0) {
						output.parts = [
							{
								type: "text",
								text: `📂 No plan files found in \`${plansDir}\`.\nUse \`/plan to-file <name>\` to create a new plan.`,
							},
						];
						return;
					}

					let listText = `### 📋 Stored Plan Documents (${files.length}):\n`;
					for (const f of files) {
						const date = new Date(f.mtimeMs).toISOString().split("T")[0];
						listText += `- **\`${f.name}\`** (${f.kind.toUpperCase()}) — *${date}*\n  Path: \`${f.path}\`\n`;
					}
					listText += `\n*Use \`/plan switch <name>\` to change the active plan.*`;
					output.parts = [{ type: "text", text: listText }];
					return;
				}

				// Subcommand: /plan switch <name>
				if (parsed.mode === "switch") {
					if (!parsed.name) {
						output.parts = [
							{
								type: "text",
								text: "⚠️ Please specify plan name. Example: `/plan switch auth-system`",
							},
						];
						return;
					}
					const target = resolveTargetPlanPath(plansDir, parsed.name, kind);
					setSessionMode(state, sessionID, "plan", {
						planFile: target.filePath,
						planName: target.sanitizedName,
						planKind: kind,
						planModeType: "file",
					});
					saveModeState(state);
					output.parts = [
						{
							type: "text",
							text: `🔄 Active plan switched to: **\`${target.sanitizedName}\`** (\`${target.filePath}\`)`,
						},
					];
					await notify(
						`[${sessionID}] Plan switched to ${target.sanitizedName}`,
					);
					return;
				}

				// Subcommand: /plan review [name]
				if (parsed.mode === "review") {
					const activePlan = currentPlan(state, sessionID);
					const targetFile = parsed.name
						? resolveTargetPlanPath(plansDir, parsed.name, kind).filePath
						: activePlan?.file;

					if (!targetFile) {
						output.parts = [
							{
								type: "text",
								text: "⚠️ No active plan file to review. Create one with `/plan to-file <name>` first.",
							},
						];
						return;
					}

					const content = readPlanContent(targetFile);
					if (!content) {
						output.parts = [
							{
								type: "text",
								text: `⚠️ Plan file \`${targetFile}\` is empty or hasn't been written yet.`,
							},
						];
						return;
					}

					const parsedLines = parsePlanLines(content);
					const preview =
						`### 📋 Plan Review: \`${targetFile}\` (${parsedLines.length} lines)\n\n` +
						content +
						`\n\n---\n*Run \`/approve\` or use the interactive review modal to approve / add corrections.*`;

					output.parts = [{ type: "text", text: preview }];
					return;
				}

				// Default: /plan to-file <name> or /plan in-chat
				let planFile = "";
				let planName = "";
				let fileInstruction =
					"Discuss architecture and design directly in chat (In-Chat Mode).";

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
						await notify(`Previous version archived to ${archived}`);
					}

					fileInstruction =
						`You are REQUIRED to write the complete ${kind} specification to file:\n` +
						`\`${planFile}\`\n\n` +
						`Use the write/edit tool to create and update this document. ` +
						`ONLY this plan file is permitted for writing during Plan Mode.`;
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
					`[${sessionID}] Mode ${kind.toUpperCase()} active (${parsed.mode})`,
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
					planRef = `Plan Reference:\n\`${activePlan.file}\``;
				}

				const template = loadTemplate("approve", directory);
				const rendered = renderTemplate(template, {
					plan_reference: planRef,
					notes: parsed.notes,
					session_id: sessionID,
				});

				output.parts = [{ type: "text", text: rendered }];
				await notify(`[${sessionID}] EXECUTE mode active (Approved)`);
				return;
			}

			if (cmd === "mode") {
				const state = loadModeState();
				const mode = currentMode(state, sessionID);
				const activePlan = currentPlan(state, sessionID);

				let info = `Current session mode: **${mode.toUpperCase()}**`;
				if (activePlan?.file) {
					info += `\nActive plan file: \`${activePlan.file}\``;
				}

				output.parts = [{ type: "text", text: info }];
			}
		},

		// 3. Inject active plan roadmap & goblin plan protocol into system prompt
		"experimental.chat.system.transform": async (input, output) => {
			if (!plansEnabled || !output) return;
			const sessionID = input?.sessionID;
			const state = loadModeState();
			const mode = currentMode(state, sessionID);
			const activePlan = currentPlan(state, sessionID);

			const extra = [];
			extra.push(GOBLIN_PLAN_PROTOCOL);

			if (mode === "execute" && activePlan?.file) {
				const content = readPlanContent(activePlan.file);
				if (content) {
					extra.push(
						`### 🗺️ ACTIVE APPROVED PLAN ROADMAP:\n` +
							`File: \`${activePlan.file}\`\n\n` +
							content.slice(0, 4000) +
							(content.length > 4000
								? "\n\n...(plan document truncated)..."
								: ""),
					);
				}
			}

			if (extra.length > 0) {
				output.system = [...(output.system || []), ...extra];
			}
		},

		// 4. Detect intent from message streams and chat turns
		event: async ({ event }) => {
			if (!intentDetectionEnabled || !event) return;

			// Track assistant messages so their parts are ignored
			if (event.type === "message.updated") {
				const info = event.properties?.info;
				if (info?.role === "assistant" && info.id) {
					assistantMessageIDs.add(info.id);
					if (assistantMessageIDs.size > 200) {
						const first = assistantMessageIDs.values().next().value;
						assistantMessageIDs.delete(first);
					}
				}
				return;
			}

			if (event.type !== "message.part.updated") return;
			const part = event.properties?.part;
			if (part?.type !== "text" || !part.text) return;

			// Ignore assistant message parts to prevent agent triggering its own mode change
			if (
				part.role === "assistant" ||
				event.properties?.role === "assistant" ||
				(part.messageID && assistantMessageIDs.has(part.messageID))
			) {
				return;
			}

			const text = part.text.trim();
			const sessionID = event.properties?.sessionID;
			await handleIntent(sessionID, text, "event");
		},

		"chat.message": async (input, output) => {
			if (!intentDetectionEnabled) return;
			const sessionID = input?.sessionID;
			const userText = extractUserText(input, output);
			if (userText) {
				await handleIntent(sessionID, userText, "turn");
			}
		},

		// 5. Native OpenCode permission auto-deny during plan mode
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

		// 6. Hard barrier on tool execution in plan mode
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
export { parsePlanLines, formatReviewFeedback } from "./parser.js";

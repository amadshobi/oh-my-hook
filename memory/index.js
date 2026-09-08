/**
 * memory/index.js — Hermes-Style Pure Markdown Memory hooks & unified /memory command suite.
 *
 * Provides:
 *   - File-backed Markdown stores across 3 distinct targets:
 *       ~/.config/opencode/memory/USER.md (user profile)
 *       ~/.config/opencode/memory/MEMORY.md (global notes)
 *       projects/<slug>/MEMORY.md (project conventions)
 *   - Native OpenCode agent tool (`memory`) supporting atomic batch operations
 *   - Strict JSON Schema override via `tool.definition` hook
 *   - Visual system prompt injection with percentage & character budgets
 *   - Unified Slash Command: `/memory [all|user|global|project|add|replace|remove|capture]`
 *   - Hermes background self-improvement review loop via OpenAI-compatible gateway
 */
import {
	readMemory,
	formatSystemMemory,
	appendMemory,
	replaceMemory,
	removeMemory,
	getGlobalFile,
	getUserFile,
	projectSlug,
	projectMemoryFile,
	resolveTargetMemoryFile,
	parseBullets,
	listMemoryEntries,
	normalizeTarget,
	getMemoryUsage,
	isGlobalDirectory,
} from "./store.js";
import { distillTranscript, analyzeTurnReview } from "./client.js";
import { loadConfig } from "../share/config.js";
import { execFileSync } from "node:child_process";
import {
	isSubagent,
	loadAgentModes,
	rememberSessionAgent,
} from "../share/agent.js";
import { createNotifier } from "../share/notify.js";
import { createHandledError, deliverCommandOutput } from "../share/handled.js";
import {
	createMemoryTool,
	executeMemoryTool,
	MEMORY_JSON_SCHEMA,
	loadToolDescription,
} from "./tool.js";

/** Get the latest OpenCode session ID (from `opencode session list`). */
function latestSessionID() {
	try {
		const out = execFileSync(
			"opencode",
			["session", "list", "--format", "json"],
			{
				encoding: "utf8",
				timeout: 15000,
				env: { ...process.env, NO_COLOR: "1" },
			},
		);
		const parsed = JSON.parse(out);
		const rows = Array.isArray(parsed)
			? parsed
			: parsed?.sessions || parsed?.data || [];
		if (Array.isArray(rows) && rows.length > 0)
			return rows[0].id ?? rows[0].sessionID ?? null;
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
	const idx = out.indexOf("{");
	if (idx < 0) return "";
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
	const bullets = await distillTranscript(transcript, {
		gatewayUrl: memCfg.baseURL,
		model: memCfg.model,
		apiKey: memCfg.apiKey,
		maxBullets: memCfg.maxBullets ?? 5,
	});
	if (bullets.length === 0) return 0;
	const file = resolveTargetMemoryFile(directory);
	for (const b of bullets) {
		appendMemory(file, b);
	}
	return bullets.length;
}

export const memoryHooks = async ({ client, directory }, opts = {}) => {
	const notify = createNotifier(client, "memory", "info");
	const config = opts?.config || loadConfig().config;
	const memCfg = config.memory || {};
	const agentModes = loadAgentModes(directory);

	let reviewTimer = null;
	const recentTurns = [];

	// Fast heuristic classifier: check if turn excerpt contains durable memory markers
	const MEMORY_SIGNAL_REGEX = /\b(prefer|panggil|always|never|rule|jangan|wajib|selalu|dilarang|aturan|konvensi|format|setup|alias|port|branch|path)\b/i;

	const scheduleBackgroundReview = (sessionID) => {
		if (memCfg.review?.enabled === false) return;
		if (recentTurns.length === 0) return;

		clearTimeout(reviewTimer);
		const delay = memCfg.review?.idleDelayMs ?? 10000;

		reviewTimer = setTimeout(async () => {
			try {
				const excerpt = recentTurns.slice(-4).join("\n");

				// Gate 1: Length filter (skip short chat/noise)
				if (excerpt.length < 30) return;

				// Gate 2: Fast heuristic signal detection (skip plain conversational turns)
				if (!MEMORY_SIGNAL_REGEX.test(excerpt)) return;

				const slug = projectSlug(directory).split("/").pop() || "workspace";
				const existingMem = readAllMemory(directory);

				const ops = await analyzeTurnReview(excerpt, {
					gatewayUrl: memCfg.baseURL,
					model: memCfg.model,
					apiKey: memCfg.apiKey,
					projectSlug: slug,
					existingMemories: existingMem,
				});

				if (Array.isArray(ops) && ops.length > 0) {
					const res = await executeMemoryTool(
						{ operations: ops },
						{ directory, budgets: memCfg.budgets },
					);
					if (res.output && !res.output.startsWith("Error:")) {
						await notify("💾 Self-improvement review: Memory updated", "info");
					}
				}
			} catch (e) {
				try {
					client?.app?.log?.(`[memory] background review error: ${e.message}`);
				} catch {}
			}
		}, delay);
	};

	return {
		// --- native agent tool (OpenCode tool registry pattern) ---
		...(memCfg.enabled !== false
			? {
					tool: {
						memory: createMemoryTool({ directory, budgets: memCfg.budgets }),
					},
				}
			: {}),

		// --- explicit JSON schema definition override ---
		"tool.definition": async ({ toolID }, output) => {
			if (memCfg.enabled === false) return;
			if (toolID === "memory") {
				output.description = loadToolDescription();
				output.jsonSchema = MEMORY_JSON_SCHEMA;
			}
		},

		// --- register slash commands in server catalog ---
		config: async (input) => {
			if (memCfg.enabled === false) return;
			const cfg = input ?? {};
			cfg.command ??= {};
			cfg.command.memory = {
				template: "/memory $ARGUMENTS",
				description:
					"Kelola memory: /memory (semua) | user | global | project | add [target] <note> | replace | remove | capture",
			};
			cfg.command.remember = {
				template: "/remember <note>",
				description:
					"Simpan catatan memory (--global untuk global, default project)",
			};
		},

		// --- track session agent mode & capture turns for background review ---
		"chat.message": async (input, output) => {
			if (!input?.sessionID) return;
			rememberSessionAgent(input.sessionID, input.agent);

			const parts = output?.parts || [];
			const text = parts
				.filter((p) => p.type === "text" && p.text)
				.map((p) => p.text)
				.join(" ");
			if (text) {
				recentTurns.push(`User: ${text.slice(0, 1000)}`);
				if (recentTurns.length > 8) recentTurns.shift();
			}
		},

		// --- background self-improvement review triggered on turn completion ---
		event: async ({ event }) => {
			if (memCfg.review?.enabled === false) return;
			if (!event) return;

			if (event.type === "message.updated") {
				const info = event.properties?.info;
				if (info?.role === "assistant") {
					scheduleBackgroundReview(event.properties?.sessionID);
				}
			}
		},

		// --- direct Markdown injection into system prompt with Hermes visual headers ---
		"experimental.chat.system.transform": async (input, output) => {
			if (memCfg.enabled === false) return;
			if (isSubagent(input, agentModes) && !memCfg.injectToSubagents) return;

			const memoryText = formatSystemMemory(directory, memCfg.budgets);
			if (!memoryText || !memoryText.trim()) return;

			output.system = output.system || [];
			output.system.push(`\n${memoryText.trim()}\n`);
		},

		// --- inject memory into compaction context (lossless) ---
		"experimental.session.compacting": async (input, output) => {
			if (memCfg.enabled === false) return;
			const memoryText = formatSystemMemory(directory, memCfg.budgets);
			if (!memoryText || !memoryText.trim()) return;

			output.context = output.context || [];
			output.context.push(memoryText.trim());
		},

		// --- unified /memory & /remember execution without LLM prompt ---
		"command.execute.before": async (input, output) => {
			const cmd = input.command;
			const rawArgs = (input.arguments ?? "").trim();
			const sessionID = input.sessionID;

			async function respond(text, variant = "info") {
				if (output) output.parts = [];
				const delivered = await deliverCommandOutput(client, sessionID, text);
				if (!delivered) {
					await notify(text, variant);
				}
				throw createHandledError();
			}

			// Legacy alias /remember
			if (cmd === "remember") {
				if (!rawArgs) {
					await respond(
						"Usage: /remember <note> atau /memory add <note>",
						"warn",
					);
				}
				const isGlobal = rawArgs.startsWith("--global ");
				const clean = rawArgs.replace(/^--global\s+/, "").trim();
				const target = isGlobal ? "global" : "project";
				const file = resolveTargetMemoryFile(target, directory);
				appendMemory(file, clean);
				const usage = getMemoryUsage(file, target, memCfg.budgets);
				await respond(`Memory saved (${target}, ${usage.usage}): ${clean}`);
			}

			if (cmd === "memory") {
				const [subcmd, ...restParts] = rawArgs ? rawArgs.split(/\s+/) : [];
				const sub = (subcmd || "").toLowerCase();
				const rest = restParts.join(" ").trim();

				// 1. /memory add [user|global|project|--global] <note>
				if (sub === "add") {
					if (!rest) {
						await respond(
							"Usage: /memory add [user|global|project] <note>",
							"warn",
						);
					}

					let target = "project";
					let note = rest;

					if (rest.startsWith("--global ")) {
						target = "global";
						note = rest.replace(/^--global\s+/, "").trim();
					} else {
						const [firstWord, ...remaining] = rest.split(/\s+/);
						const lowerFirst = (firstWord || "").toLowerCase();
						if (["user", "global", "project"].includes(lowerFirst)) {
							target = lowerFirst;
							note = remaining.join(" ").trim();
						} else if (isGlobalDirectory(directory)) {
							target = "global";
						}
					}

					if (!note) {
						await respond(
							"Error: memory note content cannot be empty.",
							"warn",
						);
					}

					const file = resolveTargetMemoryFile(target, directory);
					appendMemory(file, note);
					const usage = getMemoryUsage(file, target, memCfg.budgets);
					await respond(
						`Memory saved (${target} store, ${usage.usage}): ${note}`,
					);
				}

				// 2. /memory replace <old_text> -> <new_text>
				if (sub === "replace") {
					const delimIdx = rest.indexOf("->");
					if (delimIdx === -1) {
						await respond(
							"Usage: /memory replace <old_substring> -> <new_note>",
							"warn",
						);
					}
					const oldText = rest.slice(0, delimIdx).trim();
					const newText = rest.slice(delimIdx + 2).trim();
					if (!oldText || !newText) {
						await respond(
							"Usage: /memory replace <old_substring> -> <new_note>",
							"warn",
						);
					}

					const entries = listMemoryEntries(directory);
					const match = entries.find((e) =>
						e.content.toLowerCase().includes(oldText.toLowerCase()),
					);
					if (!match) {
						await respond(
							`Memory mengandung "${oldText}" tidak ditemukan.`,
							"warn",
						);
					}

					replaceMemory(match.file, match.content, newText);
					const usage = getMemoryUsage(
						match.file,
						match.target,
						memCfg.budgets,
					);
					await respond(
						`Memory updated (${match.target} store, ${usage.usage}):\n  Old: ${match.content}\n  New: ${newText}`,
					);
				}

				// 3. /memory remove <text>
				if (sub === "remove") {
					if (!rest) {
						await respond("Usage: /memory remove <substring_to_match>", "warn");
					}

					const entries = listMemoryEntries(directory);
					const match = entries.find((e) =>
						e.content.toLowerCase().includes(rest.toLowerCase()),
					);
					if (!match) {
						await respond(
							`Memory mengandung "${rest}" tidak ditemukan.`,
							"warn",
						);
					}

					removeMemory(match.file, match.content);
					const usage = getMemoryUsage(
						match.file,
						match.target,
						memCfg.budgets,
					);
					await respond(
						`Memory removed (${match.target} store, ${usage.usage}):\n  "${match.content}"`,
					);
				}

				// 4. /memory user
				if (sub === "user") {
					const userFile = getUserFile();
					const text = readMemory(userFile).trim();
					const bullets = parseBullets(text);
					const usage = getMemoryUsage(userFile, "user", memCfg.budgets);
					if (!text || bullets.length === 0) {
						await respond(`(User profile kosong [${usage.usage}])`);
					} else {
						await respond(
							`👤 User Profile (${bullets.length} entries, ${usage.usage}):\n\n${text}`,
						);
					}
				}

				// 5. /memory global
				if (sub === "global") {
					const globalFile = getGlobalFile();
					const text = readMemory(globalFile).trim();
					const bullets = parseBullets(text);
					const usage = getMemoryUsage(globalFile, "global", memCfg.budgets);
					if (!text || bullets.length === 0) {
						await respond(`(Global memory kosong [${usage.usage}])`);
					} else {
						await respond(
							`🌐 Global Memory (${bullets.length} entries, ${usage.usage}):\n\n${text}`,
						);
					}
				}

				// 6. /memory project
				if (sub === "project") {
					const targetDir = directory || process.cwd();
					if (isGlobalDirectory(targetDir)) {
						await respond(
							"Workspace saat ini adalah Home (~), tidak ada project memory tersendiri.",
							"warn",
						);
					}
					const projFile = projectMemoryFile(targetDir);
					const text = readMemory(projFile).trim();
					const bullets = parseBullets(text);
					const usage = getMemoryUsage(projFile, "project", memCfg.budgets);
					if (!text || bullets.length === 0) {
						await respond(
							`(Project memory kosong untuk ${targetDir} [${usage.usage}])`,
						);
					} else {
						await respond(
							`🎯 Project Memory (${bullets.length} entries, ${usage.usage}):\n\n${text}`,
						);
					}
				}

				// 7. /memory capture
				if (sub === "capture") {
					try {
						const sessID =
							(rest.match(/^[a-z0-9_]+$/) ? rest : null) ?? latestSessionID();
						if (!sessID) {
							await respond(
								"Gak ada session OpenCode buat di-capture.",
								"warn",
							);
						}
						const transcript = getSessionTranscript(sessID);
						if (!transcript) {
							await respond("Transcript session kosong.", "warn");
						}
						const n = await distillToMemory(
							transcript,
							notify,
							memCfg,
							directory,
						);
						if (n === 0) {
							await respond(
								"Capture selesai, tidak ada poin baru yang disimpan.",
							);
						} else {
							await respond(`Memory capture: ${n} poin berhasil disimpan.`);
						}
					} catch (e) {
						await respond(`Capture gagal: ${e.message}`, "error");
					}
				}

				// 8. /memory all (atau default /memory tanpa argumen)
				if (!sub || sub === "all") {
					const allText = formatSystemMemory(directory, memCfg.budgets);
					const entries = listMemoryEntries(directory);

					if (entries.length === 0) {
						await respond(
							"(Memory kosong — gunakan /memory add [user|global|project] <note> atau tool memory)",
						);
					}

					await respond(
						`📋 Active Memories (${entries.length} entries total across targets):\n\n${allText.trim()}`,
					);
				}

				// Fallback
				await respond(
					`❓ Perintah tidak dikenal: "/memory ${rawArgs}"\n` +
						`💡 Usage:\n` +
						`  • /memory                        (Tampilkan semua memory aktif)\n` +
						`  • /memory user                   (Tampilkan user profile)\n` +
						`  • /memory global                 (Tampilkan global memory)\n` +
						`  • /memory project                (Tampilkan project memory)\n` +
						`  • /memory add [target] <note>    (Tambah memory ke user, global, atau project)\n` +
						`  • /memory replace A -> B         (Ganti memory A dengan B)\n` +
						`  • /memory remove <text>          (Hapus memory yang cocok)\n` +
						`  • /memory capture                (Auto-capture via gateway)`,
				);
			}
		},
	};
};

export default memoryHooks;

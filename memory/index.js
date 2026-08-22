/**
 * memory/index.js — Pure Markdown Memory hooks & unified /memory command suite.
 *
 * Provides:
 *   - File-backed Markdown stores: ~/.config/opencode/memory/MEMORY.md (global) & projects/<slug>/MEMORY.md
 *   - Native OpenCode agent tool (`memory`) with 4 actions (add, replace, remove, list)
 *   - Direct Markdown injection into System Prompt and Compaction context
 *   - Unified Slash Command: `/memory [all|global|project|add|replace|remove|capture]`
 */
import {
	readMemory,
	readAllMemory,
	appendMemory,
	replaceMemory,
	removeMemory,
	GLOBAL_FILE,
	getGlobalFile,
	projectSlug,
	projectMemoryFile,
	resolveTargetMemoryFile,
	parseBullets,
	listMemoryEntries,
} from "./store.js";
import { capture } from "./ai/index.js";
import { loadConfig } from "../share/config.js";
import { execFileSync } from "node:child_process";
import {
	isSubagent,
	loadAgentModes,
	rememberSessionAgent,
} from "../share/agent.js";
import { createNotifier } from "../share/notify.js";
import { createMemoryTool } from "./tool.js";

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
	const project = directory ? directory.split("/").pop() : "unknown";
	const prompt =
		`Berikut adalah transcript session coding terakhir dari project ${project}.\n\n` +
		`TRANSCRIPT:\n${transcript.slice(0, 8000)}\n\n` +
		`Pilih 3-5 poin penting yang layak diingat untuk pekerjaan selanjutnya ` +
		`(keputusan arsitektur, konvensi, gotchas, preferensi user). ` +
		`Output format: satu bullet per baris, diawali "- ", dalam bahasa Indonesia singkat. ` +
		`Jangan sertakan detail yang gak penting.`;
	const model = memCfg.captureModels?.[memCfg.captureAdapter] ?? "";
	const result = await capture(prompt, {
		cwd: directory,
		prefer: memCfg.captureAdapter,
		model,
	});
	const bullets = result
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.startsWith("- "))
		.slice(0, memCfg.maxBullets ?? 5);
	if (bullets.length === 0) return 0;
	const file = resolveTargetMemoryFile(directory);
	for (const b of bullets) {
		const clean = b.replace(/^-\s*/, "");
		appendMemory(file, clean);
	}
	return bullets.length;
}

export const memoryHooks = async ({ client, directory }, opts = {}) => {
	const notify = createNotifier(client, "memory", "info");
	const config = opts?.config || loadConfig().config;
	const memCfg = config.memory || {};
	const agentModes = loadAgentModes(directory);

	return {
		// --- native agent tool (OpenCode tool registry pattern) ---
		...(memCfg.enabled !== false
			? {
					tool: {
						memory: createMemoryTool({ directory }),
					},
				}
			: {}),

		// --- register unified slash command (/memory) ---
		config: async (input) => {
			if (memCfg.enabled === false) return;
			const cfg = input ?? {};
			cfg.command ??= {};
			cfg.command.memory = {
				template: "/memory [all|global|project|add|replace|remove|capture]",
				description:
					"Kelola memory: /memory (semua) | global | project | add <note> | replace <old> -> <new> | remove <text> | capture",
			};
		},

		// --- track session agent mode ---
		"chat.message": async (input) => {
			if (!input?.sessionID) return;
			rememberSessionAgent(input.sessionID, input.agent);
		},

		// --- direct Markdown injection into system prompt ---
		"experimental.chat.system.transform": async (input, output) => {
			if (memCfg.enabled === false) return;
			if (isSubagent(input, agentModes) && !memCfg.injectToSubagents) return;

			const memoryText = readAllMemory(directory);
			if (!memoryText || !memoryText.trim()) return;

			output.system = output.system || [];
			output.system.push(`\n${memoryText.trim()}\n`);
		},

		// --- inject memory into compaction context (lossless) ---
		"experimental.session.compacting": async (input, output) => {
			if (memCfg.enabled === false) return;
			const memoryText = readAllMemory(directory);
			if (!memoryText || !memoryText.trim()) return;

			output.context = output.context || [];
			output.context.push(memoryText.trim());
		},

		// --- unified /memory slash command execution ---
		"command.execute.before": async (input, output) => {
			const cmd = input.command;
			const rawArgs = (input.arguments ?? "").trim();

			// Support legacy alias /remember for quick backward compatibility
			if (cmd === "remember") {
				if (!rawArgs) {
					await notify("Usage: /memory add <note> atau /remember <note>");
					if (output) output.parts = [];
					return;
				}
				const isGlobal = rawArgs.startsWith("--global ");
				const clean = rawArgs.replace(/^--global\s+/, "").trim();
				const file = isGlobal
					? getGlobalFile()
					: resolveTargetMemoryFile(directory);
				appendMemory(file, clean);
				const scopeName = isGlobal ? "global" : "project";
				await notify(`Memory saved (${scopeName}): ${clean}`);
				if (output) output.parts = [];
				return;
			}

			if (cmd === "memory") {
				const [subcmd, ...restParts] = rawArgs ? rawArgs.split(/\s+/) : [];
				const sub = (subcmd || "").toLowerCase();
				const rest = restParts.join(" ").trim();

				// 1. /memory add [--global] <note>
				if (sub === "add") {
					if (!rest) {
						await notify("Usage: /memory add [--global] <note>");
						if (output) output.parts = [];
						return;
					}
					const isGlobal = rest.startsWith("--global ");
					const clean = rest.replace(/^--global\s+/, "").trim();
					const file = isGlobal
						? getGlobalFile()
						: resolveTargetMemoryFile(directory);
					appendMemory(file, clean);
					const scopeName = isGlobal ? "global" : "project";
					await notify(`Memory saved (${scopeName}): ${clean}`);
					if (output) output.parts = [];
					return;
				}

				// 2. /memory replace <old_text> -> <new_text>
				if (sub === "replace") {
					const delimIdx = rest.indexOf("->");
					if (delimIdx === -1) {
						await notify(
							"Usage: /memory replace <old_substring> -> <new_note>",
						);
						if (output) output.parts = [];
						return;
					}
					const oldText = rest.slice(0, delimIdx).trim();
					const newText = rest.slice(delimIdx + 2).trim();
					if (!oldText || !newText) {
						await notify(
							"Usage: /memory replace <old_substring> -> <new_note>",
						);
						if (output) output.parts = [];
						return;
					}

					const entries = listMemoryEntries(directory);
					const match = entries.find((e) =>
						e.content.toLowerCase().includes(oldText.toLowerCase()),
					);
					if (!match) {
						await notify(
							`Memory mengandung "${oldText}" tidak ditemukan.`,
							"warn",
						);
						if (output) output.parts = [];
						return;
					}

					replaceMemory(match.file, match.content, newText);
					await notify(
						`Memory updated (${match.scope}):\n  Old: ${match.content}\n  New: ${newText}`,
					);
					if (output) output.parts = [];
					return;
				}

				// 3. /memory remove <substring> | /memory rm <substring>
				if (sub === "remove" || sub === "rm" || sub === "delete") {
					if (!rest) {
						await notify("Usage: /memory remove <substring>");
						if (output) output.parts = [];
						return;
					}
					const entries = listMemoryEntries(directory);
					const match = entries.find((e) =>
						e.content.toLowerCase().includes(rest.toLowerCase()),
					);
					if (!match) {
						await notify(
							`Memory mengandung "${rest}" tidak ditemukan.`,
							"warn",
						);
						if (output) output.parts = [];
						return;
					}

					removeMemory(match.file, match.content);
					await notify(`Memory removed (${match.scope}): ${match.content}`);
					if (output) output.parts = [];
					return;
				}

				// 4. /memory global
				if (sub === "global") {
					const globalFile = getGlobalFile();
					const text = readMemory(globalFile).trim();
					const bullets = parseBullets(text);
					if (!text || bullets.length === 0) {
						await notify("(Global memory kosong)");
					} else {
						await notify(
							`🌍 Global Memory (${bullets.length} bullets):\n\n${text}`,
						);
					}
					if (output) output.parts = [];
					return;
				}

				// 5. /memory project [optional-path]
				if (sub === "project") {
					const targetDir = rest || directory;
					const projFile = projectMemoryFile(targetDir);
					const text = readMemory(projFile).trim();
					const bullets = parseBullets(text);
					if (!text || bullets.length === 0) {
						await notify(`(Project memory kosong untuk ${targetDir})`);
					} else {
						await notify(
							`🎯 Project Memory (${bullets.length} bullets):\n\n${text}`,
						);
					}
					if (output) output.parts = [];
					return;
				}

				// 6. /memory capture
				if (sub === "capture") {
					await notify("Running memory capture via AI…");
					try {
						const sessionID =
							(rest.match(/^[a-z0-9_]+$/) ? rest : null) ?? latestSessionID();
						if (!sessionID) {
							await notify("Gak ada session OpenCode buat di-capture.", "warn");
							if (output) output.parts = [];
							return;
						}
						const transcript = getSessionTranscript(sessionID);
						if (!transcript) {
							await notify("Transcript session kosong.", "warn");
							if (output) output.parts = [];
							return;
						}
						const n = await distillToMemory(
							transcript,
							notify,
							memCfg,
							directory,
						);
						if (n === 0) {
							await notify(
								"Capture selesai, tidak ada poin baru yang disimpan.",
							);
						} else {
							await notify(`Memory capture: ${n} poin berhasil disimpan.`);
						}
					} catch (e) {
						await notify(`Capture gagal: ${e.message}`, "error");
					}
					if (output) output.parts = [];
					return;
				}

				// 7. /memory all (atau default /memory tanpa argumen)
				if (!sub || sub === "all") {
					const allText = readAllMemory(directory);
					const bullets = parseBullets(allText);

					if (!allText.trim() || bullets.length === 0) {
						await notify(
							"(Memory kosong — gunakan /memory add <note> atau tool memory)",
						);
						if (output) output.parts = [];
						return;
					}

					await notify(
						`📋 Active Memory (${bullets.length} bullets total):\n\n${allText.trim()}`,
					);
					if (output) output.parts = [];
					return;
				}

				// Fallback: If argument is treated as a note to quickly add
				await notify(
					`❓ Perintah tidak dikenal: "/memory ${rawArgs}"\n` +
						`💡 Usage:\n` +
						`  • /memory                 (Tampilkan semua memory aktif)\n` +
						`  • /memory global          (Tampilkan global memory)\n` +
						`  • /memory project         (Tampilkan project memory)\n` +
						`  • /memory add <note>      (Tambah memory ke project, --global untuk global)\n` +
						`  • /memory replace A -> B  (Ganti memory A dengan B)\n` +
						`  • /memory remove <text>   (Hapus memory yang cocok)\n` +
						`  • /memory capture         (Auto-capture via AI)`,
				);
				if (output) output.parts = [];
			}
		},
	};
};

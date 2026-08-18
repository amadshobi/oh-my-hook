/**
 * memory/index.js — Memory hooks & commands suite for oh-my-hook.
 *
 * Provides:
 *   - Categorized structured memory store (rules/*.jsonl)
 *   - Dynamic BM25 relevance injection per prompt turn (zero prompt token bloat)
 *   - Heuristic auto-correction & success signal detector
 *   - Background queue-based distill & self-healing deduplication
 *   - Slash commands: /remember, /memory, /memory-rules, /memory-forget, /memory-scan, /capture
 */
import {
	readMemory,
	readAllMemory,
	appendMemory,
	GLOBAL_FILE,
	projectSlug,
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

import { listRules, appendRule, removeRule, enqueueJob } from "./rstore.js";
import { injectMemory } from "./inject.js";
import { sessionTracker } from "./ctx.js";
import { analyzeUserMessage, shouldQueue } from "./detect.js";
import { processQueue } from "./distill.js";

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
		.slice(0, memCfg.maxBullets);
	if (bullets.length === 0) return 0;
	const file = directory
		? await projectMemoryFileDynamic(directory)
		: GLOBAL_FILE;
	for (const b of bullets) {
		const clean = b.replace(/^-\s*/, "");
		appendMemory(file, clean);
		// Also save to structured store
		appendRule({
			content: clean,
			scope: directory ? "project" : "global",
			project: projectSlug(directory),
			source: "capture",
		});
	}
	return bullets.length;
}

// Dynamic import helper to avoid circular import at module top.
async function projectMemoryFileDynamic(directory) {
	const { projectMemoryFile } = await import("./store.js");
	return projectMemoryFile(directory);
}

export const memoryHooks = async ({ client, directory }) => {
	const notify = createNotifier(client, "memory", "info");
	const { config } = loadConfig();
	const memCfg = config.memory || {};
	const agentModes = loadAgentModes(directory);

	return {
		// --- register slash commands (config hook, opencode-quota pattern) ---
		config: async (input) => {
			const cfg = input ?? {};
			cfg.command ??= {};
			cfg.command.remember = {
				template: "/remember <note>",
				description:
					"Simpan catatan memory (--global untuk global, default project)",
			};
			cfg.command["memory-forget"] = {
				template: "/memory-forget <id>",
				description: "Hapus / cabut rule memory berdasarkan ID",
			};
			cfg.command["memory-scan"] = {
				template: "/memory-scan",
				description: "Proses antrean distill memory background secara instan",
			};
			cfg.command.capture = {
				template: "/capture",
				description: "Auto-capture session terakhir ke memory via AI",
			};
		},

		// --- record context & detect learning signals from user messages ---
		"chat.message": async (input) => {
			if (!input?.sessionID) return;
			rememberSessionAgent(input.sessionID, input.agent);

			// Extract user text defensively
			let userText = "";
			if (Array.isArray(input.message?.parts)) {
				for (const part of input.message.parts) {
					if (part.type === "text" && part.text) {
						userText += part.text + " ";
					}
				}
			} else if (typeof input.userMessage === "string") {
				userText = input.userMessage;
			}

			if (userText.trim()) {
				// Prune stale session tracker caches if accumulating
				if (sessionTracker.sessions.size > 50) {
					sessionTracker.prune();
				}

				const signal = analyzeUserMessage(userText);
				const isCorrection = shouldQueue(
					signal,
					memCfg.detector?.minConfidence ?? 0.6,
				);

				sessionTracker.record(input.sessionID, {
					userMessage: userText,
					isCorrection,
				});

				if (isCorrection) {
					enqueueJob({
						type: "distill",
						kind: "correction",
						sessionID: input.sessionID,
						project: projectSlug(directory),
						context: userText.trim(),
						signal: signal.label,
					});
				}
			}
		},

		// --- dynamic injection into system prompt (BM25 relevance matched) ---
		"experimental.chat.system.transform": async (input, output) => {
			if (!memCfg.enabled) return;
			if (isSubagent(input, agentModes) && !memCfg.injectToSubagents) return;

			const sessionID = input.sessionID;
			const query = sessionTracker.getQuery(sessionID, "");

			const { text } = injectMemory({
				directory,
				query,
				config,
				capBudget: true,
			});

			if (!text) return;
			output.system = output.system || [];
			output.system.push(`\n${text}\n`);
		},

		// --- inject memory into compaction context (lossless) ---
		"experimental.session.compacting": async (input, output) => {
			const { text } = injectMemory({
				directory,
				query: "",
				config,
				capBudget: false,
			});

			if (!text) return;
			output.context = output.context || [];
			output.context.push(text);
		},

		// --- slash commands execution ---
		"command.execute.before": async (input, output) => {
			const cmd = input.command;
			const args = input.arguments ?? "";

			if (cmd === "remember") {
				const entry = args.trim();
				if (!entry) {
					await notify("Usage: /remember <note>");
					if (output) output.parts = [];
					return;
				}
				const isGlobal = entry.startsWith("--global ");
				const clean = entry.replace(/^--global\s+/, "").trim();
				const file = isGlobal
					? GLOBAL_FILE
					: await import("./store.js").then((m) =>
							m.resolveTargetMemoryFile(directory),
						);

				// 1. Write clean markdown
				const line = appendMemory(file, clean);

				// 2. Also track in structured store
				const rule = appendRule({
					content: clean,
					scope: isGlobal || file === GLOBAL_FILE ? "global" : "project",
					project:
						isGlobal || file === GLOBAL_FILE ? null : projectSlug(directory),
					source: "remember",
				});

				await notify(`Memory saved [${rule.id}]: ${rule.content}`);
				if (output) output.parts = [];
				return;
			}

			if (cmd === "memory") {
				const pSlug = projectSlug(directory);
				const rules = listRules({ projectSlug: pSlug, activeOnly: true });
				const legacy = readAllMemory(directory);

				if (rules.length === 0 && !legacy) {
					await notify("(memory kosong — isi dengan /remember atau /capture)");
					if (output) output.parts = [];
					return;
				}

				const summary = `📊 Active Memory: ${rules.length} structured rules loaded.`;
				await notify(legacy ? `${summary}\n\n${legacy}` : summary);
				if (output) output.parts = [];
				return;
			}

			if (cmd === "memory-rules") {
				const pSlug = projectSlug(directory);
				const rules = listRules({ projectSlug: pSlug, activeOnly: true });
				if (rules.length === 0) {
					await notify("Belum ada structured rules yang aktif.");
					if (output) output.parts = [];
					return;
				}
				const lines = rules.map(
					(r) =>
						`• [${r.id}] (${r.category}) ${r.content} [conf: ${(r.confidence * 100).toFixed(0)}%]`,
				);
				await notify(`📋 Structured Memory Rules:\n${lines.join("\n")}`);
				if (output) output.parts = [];
				return;
			}

			if (cmd === "memory-forget") {
				const id = args.trim();
				if (!id) {
					await notify("Usage: /memory-forget <rule-id>");
					if (output) output.parts = [];
					return;
				}
				const ok = removeRule(id);
				if (ok) {
					await notify(`Rule [${id}] berhasil dicabut.`);
				} else {
					await notify(`Rule [${id}] tidak ditemukan.`, "warn");
				}
				if (output) output.parts = [];
				return;
			}

			if (cmd === "memory-scan") {
				await notify("Menjalankan pemrosesan background queue memory…");
				const count = await processQueue({
					config,
					notify,
					getTranscriptFn: getSessionTranscript,
				});
				await notify(
					`Pemrosesan queue selesai. ${count} rules berhasil diproses.`,
				);
				if (output) output.parts = [];
				return;
			}

			if (cmd === "capture") {
				await notify("Running memory capture via AI…");
				try {
					const sessionID =
						(args.trim().match(/^[a-z0-9_]+$/) ? args.trim() : null) ??
						latestSessionID();
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
							"Capture selesai, tapi gak ada poin yang layak disimpan.",
						);
					} else {
						const file = directory
							? await projectMemoryFileDynamic(directory)
							: GLOBAL_FILE;
						await notify(`Memory capture: ${n} poin disimpan.`);
					}
				} catch (e) {
					await notify(`Capture gagal: ${e.message}`, "error");
				}
				if (output) output.parts = [];
			}
		},
	};
};

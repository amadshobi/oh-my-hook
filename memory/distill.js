/**
 * memory/distill.js — AI-powered rule extraction, merging, and deduplication.
 *
 * Implements Jaccard similarity-based deduplication and contradiction superseding.
 */
import { tokenize } from "./matcher.js";
import { normalizeRule, isValidRule } from "./schema.js";
import {
	listRules,
	appendRule,
	updateRule,
	dequeueJobs,
	markJobDone,
} from "./rstore.js";
import { capture } from "./ai/index.js";

/**
 * Calculate Jaccard similarity between two text strings based on word tokens.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0.0 - 1.0
 */
export function jaccard(a, b) {
	const setA = new Set(tokenize(a));
	const setB = new Set(tokenize(b));
	if (setA.size === 0 && setB.size === 0) return 1.0;
	if (setA.size === 0 || setB.size === 0) return 0.0;

	let intersection = 0;
	for (const token of setA) {
		if (setB.has(token)) intersection++;
	}
	const union = new Set([...setA, ...setB]).size;
	return union > 0 ? intersection / union : 0;
}

/**
 * Check if a text has negation terms (don't, jangan, never, avoid).
 * @param {string} text
 * @returns {boolean}
 */
export function hasNegation(text) {
	const lower = (text || "").toLowerCase();
	return (
		lower.includes("jangan") ||
		lower.includes("jgn") ||
		lower.includes("tidak") ||
		lower.includes("don't") ||
		lower.includes("dont") ||
		lower.includes("never") ||
		lower.includes("avoid") ||
		lower.includes("stop")
	);
}

/**
 * Merge an incoming rule into existing rules set using Jaccard dedup & supersede logic.
 * @param {object} incoming Valid rule record
 * @param {object} [opts]
 * @param {number} [opts.dedupThreshold=0.75]
 * @returns {{ action: "appended" | "merged" | "superseded", rule: object }}
 */
export function mergeRule(incoming, opts = {}) {
	const { dedupThreshold = 0.6 } = opts;
	const normalized = normalizeRule(incoming);

	// Find candidate rules in same scope & category
	const existingRules = listRules({
		scope: normalized.scope,
		category: normalized.category,
		projectSlug: normalized.project,
		activeOnly: true,
	});

	let bestMatch = null;
	let highestSim = 0;

	for (const candidate of existingRules) {
		const sim = jaccard(normalized.content, candidate.content);
		if (sim > highestSim) {
			highestSim = sim;
			bestMatch = candidate;
		}
	}

	// 1. High similarity match: merge or supersede
	if (bestMatch && highestSim >= dedupThreshold) {
		const incomingNegation = hasNegation(normalized.content);
		const candidateNegation = hasNegation(bestMatch.content);

		// Contradiction detected (one is negation, other is affirmative) -> Supersede old rule
		if (incomingNegation !== candidateNegation) {
			updateRule(bestMatch.id, {
				status: "superseded",
				supersededBy: normalized.id,
			});

			const saved = appendRule({
				...normalized,
				rationale:
					normalized.rationale || `Menggantikan aturan usang ${bestMatch.id}`,
			});

			return { action: "superseded", rule: saved };
		}

		// Similar affirmation/negation: Merge triggers, bump confidence, update content
		const mergedTriggers = Array.from(
			new Set([...(bestMatch.triggers || []), ...(normalized.triggers || [])]),
		).slice(0, 10);

		const merged = updateRule(bestMatch.id, {
			content: normalized.content,
			triggers: mergedTriggers,
			hits: (bestMatch.hits || 0) + (normalized.hits || 0),
			confidence: Math.min(1.0, (bestMatch.confidence || 0.5) + 0.1),
			rationale: normalized.rationale || bestMatch.rationale,
			mergedFrom: Array.from(
				new Set([...(bestMatch.mergedFrom || []), normalized.id]),
			),
		});

		return { action: "merged", rule: merged };
	}

	// 2. No strong match -> Append as new rule
	const saved = appendRule(normalized);
	return { action: "appended", rule: saved };
}

/**
 * Parse JSON array from raw AI output.
 * @param {string} text
 * @returns {object[]}
 */
export function parseRulesJSON(text) {
	if (!text || typeof text !== "string") return [];
	const trimmed = text.trim();

	// Find first '[' and last ']'
	const start = trimmed.indexOf("[");
	const end = trimmed.lastIndexOf("]");
	if (start < 0 || end < 0 || end <= start) return [];

	const jsonStr = trimmed.slice(start, end + 1);
	try {
		const parsed = JSON.parse(jsonStr);
		if (!Array.isArray(parsed)) return [];

		const validRules = [];
		for (const item of parsed) {
			if (item && typeof item === "object") {
				try {
					const norm = normalizeRule(item);
					if (isValidRule(norm)) validRules.push(norm);
				} catch {}
			}
		}
		return validRules;
	} catch {
		return [];
	}
}

/**
 * Build the AI distillation prompt.
 * @param {string} transcript
 * @param {string} [project]
 * @returns {string}
 */
export function buildDistillPrompt(transcript, project = "general") {
	return (
		`Kamu adalah Memory Curator untuk coding agent.\n` +
		`Berikut adalah transkrip percakapan yang memuat umpan balik atau koreksi pada project ${project}:\n\n` +
		`<TRANSCRIPT>\n${transcript.slice(0, 8000)}\n</TRANSCRIPT>\n\n` +
		`Tugas: Ekstrak 1-3 aturan/kebiasaan penting yang harus diingat untuk turn selanjutnya.\n` +
		`Kategori yang tersedia: "preference", "project_skill", "shared_skill".\n` +
		`Format output HARUS berupa JSON array MURNI tanpa teks pembuka/penutup:\n` +
		`[\n` +
		`  {\n` +
		`    "category": "project_skill",\n` +
		`    "content": "Gunakan bun test daripada npm test",\n` +
		`    "triggers": ["bun", "test", "npm"],\n` +
		`    "rationale": "User meminta bun test karena lebih cepat"\n` +
		`  }\n` +
		`]`
	);
}

/**
 * Process pending jobs from queue.jsonl.
 * @param {object} opts
 * @param {object} [opts.config]
 * @param {Function} [opts.notify]
 * @param {Function} [opts.getTranscriptFn]
 * @returns {Promise<number>} Number of processed rules
 */
export async function processQueue(opts = {}) {
	const { config = {}, notify, getTranscriptFn } = opts;
	const memCfg = config.memory || {};
	const jobs = dequeueJobs(3);
	if (jobs.length === 0) return 0;

	let totalRulesSaved = 0;

	for (const job of jobs) {
		try {
			let transcript = job.context || "";
			if (!transcript && getTranscriptFn && job.sessionID) {
				transcript = getTranscriptFn(job.sessionID);
			}

			if (!transcript) {
				markJobDone(job.id);
				continue;
			}

			const prompt = buildDistillPrompt(transcript, job.project || "general");
			const model = memCfg.captureModels?.[memCfg.captureAdapter] ?? "";
			const result = await capture(prompt, {
				prefer: memCfg.captureAdapter || "commandcode",
				model,
				timeoutMs: 60000,
			});

			const extractedRules = parseRulesJSON(result);
			for (const rule of extractedRules) {
				const withMeta = {
					...rule,
					source: "distill",
					project: job.project || null,
					scope: job.project ? "project" : "global",
				};
				const res = mergeRule(withMeta);
				totalRulesSaved++;
				if (notify) {
					notify(
						`Learned new rule (${res.action}): "${res.rule.content}"`,
						"info",
					);
				}
			}

			markJobDone(job.id);
		} catch (err) {
			if (notify) {
				notify(
					`Failed to process distill job ${job.id}: ${err.message}`,
					"warn",
				);
			}
			markJobDone(job.id);
		}
	}

	return totalRulesSaved;
}

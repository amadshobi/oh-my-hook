/**
 * memory/schema.js — schema definitions and validation for structured rules.
 *
 * Rules represent learned knowledge in three categories:
 *   - preference: user-specific preferences and workflow styling
 *   - project_skill: repository-specific SOPs, gotchas, and patterns
 *   - shared_skill: general transferable engineering patterns across projects
 */

import { STOPWORDS } from "./stopwords.js";

export const CATEGORIES = Object.freeze([
	"preference",
	"project_skill",
	"shared_skill",
]);

export const CATEGORY_PREFIX = Object.freeze({
	preference: "prf",
	project_skill: "psk",
	shared_skill: "ssk",
});

export const SOURCES = Object.freeze([
	"remember",
	"capture",
	"correction",
	"distill",
	"migrated",
	"manual",
]);

export const STATUSES = Object.freeze(["active", "superseded", "retracted"]);

/**
 * 32-bit FNV-1a hash function returning 8-character hex string.
 * @param {string} str
 * @returns {string} 8-character hex string
 */
export function fnv1a(str) {
	let hash = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Generate a deterministic ID for a rule based on category, content, and project.
 * @param {object} rule
 * @returns {string} e.g. "prf_3f2a9c1b"
 */
export function newRuleId(rule) {
	const cat = rule.category || "shared_skill";
	const prefix = CATEGORY_PREFIX[cat] || "rul";
	const content = (rule.content || "").trim().toLowerCase();
	const project = (rule.project || "").trim();
	const key = `${cat}:${content}:${project}`;
	return `${prefix}_${fnv1a(key)}`;
}

export function extractTriggers(content) {
	if (!content || typeof content !== "string") return [];
	const words = content
		.toLowerCase()
		.replace(/[^\w\s-]/g, " ")
		.split(/\s+/)
		.map((w) => w.trim())
		.filter((w) => w.length >= 2 && !STOPWORDS.has(w));

	const seen = new Set();
	const result = [];
	for (const w of words) {
		if (!seen.has(w)) {
			seen.add(w);
			result.push(w);
			if (result.length >= 10) break;
		}
	}
	return result;
}

/**
 * Heuristic classifier to determine category from content text.
 * @param {string} text
 * @returns {"preference" | "project_skill" | "shared_skill"}
 */
export function classifyCategory(text) {
	const lower = (text || "").toLowerCase();
	if (
		lower.includes("prefer") ||
		lower.includes("suka") ||
		lower.includes("biasakan") ||
		lower.includes("gaya") ||
		lower.includes("bahasa")
	) {
		return "preference";
	}
	if (
		lower.includes("repo ini") ||
		lower.includes("proyek ini") ||
		lower.includes("project ini") ||
		lower.includes("this repo") ||
		lower.includes("this project")
	) {
		return "project_skill";
	}
	return "shared_skill";
}

/**
 * Validate and normalize a raw rule object into a complete, clean record.
 * @param {object} raw
 * @param {object} [opts]
 * @returns {object} Normalized rule record
 */
export function normalizeRule(raw, opts = {}) {
	if (!raw || typeof raw !== "object") {
		throw new TypeError("Rule must be a non-null object");
	}

	const content =
		typeof raw.content === "string" ? raw.content.trim().slice(0, 400) : "";
	if (!content) {
		throw new Error("Rule content is required and cannot be empty");
	}

	let category = raw.category;
	if (!CATEGORIES.includes(category)) {
		category = classifyCategory(content);
	}

	const scope = raw.scope === "project" || raw.project ? "project" : "global";
	const project =
		scope === "project" ? (raw.project || opts.project || "").trim() : null;

	const triggers =
		Array.isArray(raw.triggers) && raw.triggers.length > 0
			? Array.from(
					new Set(
						raw.triggers
							.map((t) => String(t).trim().toLowerCase())
							.filter(Boolean),
					),
				).slice(0, 10)
			: extractTriggers(content);

	const now = Date.now();
	const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : now;
	const updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : now;

	const rawConfidence = Number.isFinite(raw.confidence) ? raw.confidence : 0.5;
	const confidence = Math.max(0, Math.min(1, Number(rawConfidence.toFixed(2))));

	const status = STATUSES.includes(raw.status) ? raw.status : "active";
	const source = SOURCES.includes(raw.source)
		? raw.source
		: opts.source || "manual";

	const partial = {
		scope,
		category,
		content,
		triggers,
		rationale:
			typeof raw.rationale === "string"
				? raw.rationale.trim().slice(0, 500)
				: "",
		source,
		project,
		createdAt,
		updatedAt,
		hits: Number.isInteger(raw.hits) && raw.hits >= 0 ? raw.hits : 0,
		corrections:
			Number.isInteger(raw.corrections) && raw.corrections >= 0
				? raw.corrections
				: 0,
		confidence,
		status,
		supersededBy: raw.supersededBy ? String(raw.supersededBy).trim() : null,
		mergedFrom: Array.isArray(raw.mergedFrom)
			? Array.from(new Set(raw.mergedFrom))
			: [],
	};

	const id =
		raw.id && typeof raw.id === "string" ? raw.id.trim() : newRuleId(partial);

	return {
		id,
		...partial,
	};
}

/**
 * Check if a rule object satisfies the minimum valid schema.
 * @param {object} rule
 * @returns {boolean}
 */
export function isValidRule(rule) {
	if (!rule || typeof rule !== "object") return false;
	if (typeof rule.id !== "string" || !rule.id.trim()) return false;
	if (typeof rule.content !== "string" || !rule.content.trim()) return false;
	if (!CATEGORIES.includes(rule.category)) return false;
	if (!["global", "project"].includes(rule.scope)) return false;
	if (rule.scope === "project" && !rule.project) return false;
	if (!STATUSES.includes(rule.status)) return false;
	return true;
}

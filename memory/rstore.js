/**
 * memory/rstore.js — structured JSONL store for categorized rules.
 *
 * Directory layout:
 *   ~/.config/opencode/memory/rules/
 *   ├── meta.json
 *   ├── queue.jsonl
 *   ├── global/
 *   │   ├── preferences.jsonl
 *   │   └── skills.jsonl
 *   └── projects/<slug>/
 *       └── skills.jsonl
 */
import {
	readFileSync,
	writeFileSync,
	appendFileSync,
	existsSync,
	mkdirSync,
	renameSync,
	readdirSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { normalizeRule, isValidRule } from "./schema.js";

/** Base rules directory (supports test env override OMH_MEMORY_ROOT). */
export function getRulesRoot() {
	const root = process.env.OMH_MEMORY_ROOT
		? path.join(process.env.OMH_MEMORY_ROOT, "rules")
		: path.join(os.homedir(), ".config", "opencode", "memory", "rules");
	return root;
}

export const META_FILE_NAME = "meta.json";
export const QUEUE_FILE_NAME = "queue.jsonl";

/**
 * Get target JSONL file path for scope, category, and project slug.
 * @param {"global" | "project"} scope
 * @param {"preference" | "project_skill" | "shared_skill"} category
 * @param {string} [projectSlug]
 * @returns {string} Absolute path to JSONL file
 */
export function rulesFile(scope, category, projectSlug) {
	const root = getRulesRoot();
	if (scope === "project" && projectSlug) {
		return path.join(root, "projects", projectSlug, "skills.jsonl");
	}
	if (category === "preference") {
		return path.join(root, "global", "preferences.jsonl");
	}
	return path.join(root, "global", "skills.jsonl");
}

/** Ensure directory exists. */
function ensureDir(dirPath) {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

/** Atomic file write using temporary file + renameSync. */
function writeAtomic(filePath, data) {
	ensureDir(path.dirname(filePath));
	const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	writeFileSync(tmpPath, data, "utf8");
	renameSync(tmpPath, filePath);
}

/**
 * Parse JSONL string into array of validated rule objects.
 * @param {string} raw
 * @returns {object[]}
 */
function parseJsonl(raw) {
	if (!raw || typeof raw !== "string") return [];
	const lines = raw
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const rules = [];
	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);
			const normalized = normalizeRule(parsed);
			if (isValidRule(normalized)) {
				rules.push(normalized);
			}
		} catch {}
	}
	return rules;
}

/**
 * List rules based on criteria.
 * @param {object} [opts]
 * @param {"global" | "project"} [opts.scope]
 * @param {"preference" | "project_skill" | "shared_skill"} [opts.category]
 * @param {string} [opts.projectSlug]
 * @param {boolean} [opts.activeOnly=true]
 * @returns {object[]}
 */
export function listRules(opts = {}) {
	const { scope, category, projectSlug, activeOnly = true } = opts;
	const root = getRulesRoot();
	if (!existsSync(root)) return [];

	const files = [];

	if (scope && category) {
		files.push(rulesFile(scope, category, projectSlug));
	} else {
		// Collect global preferences & skills
		files.push(path.join(root, "global", "preferences.jsonl"));
		files.push(path.join(root, "global", "skills.jsonl"));

		// If project slug provided, add project skills
		if (projectSlug) {
			files.push(path.join(root, "projects", projectSlug, "skills.jsonl"));
		} else {
			// Scan all project folders if any
			const projDir = path.join(root, "projects");
			if (existsSync(projDir)) {
				try {
					const entries = readdirSync(projDir, { recursive: true });
					for (const entry of entries) {
						if (typeof entry === "string" && entry.endsWith(".jsonl")) {
							files.push(path.join(projDir, entry));
						}
					}
				} catch {}
			}
		}
	}

	const allRules = [];
	const seenIds = new Set();

	for (const file of files) {
		if (existsSync(file)) {
			try {
				const content = readFileSync(file, "utf8");
				const parsed = parseJsonl(content);
				for (const rule of parsed) {
					if (!seenIds.has(rule.id)) {
						seenIds.add(rule.id);
						if (!activeOnly || rule.status === "active") {
							allRules.push(rule);
						}
					}
				}
			} catch {}
		}
	}

	return allRules;
}

/**
 * Append a rule atomically to the appropriate JSONL file.
 * @param {object} rawRule
 * @returns {object} Normalized rule record saved
 */
export function appendRule(rawRule) {
	const rule = normalizeRule(rawRule);
	const file = rulesFile(rule.scope, rule.category, rule.project);
	ensureDir(path.dirname(file));

	// Check if exists already in file
	const existing = existsSync(file)
		? parseJsonl(readFileSync(file, "utf8"))
		: [];
	const index = existing.findIndex((r) => r.id === rule.id);

	if (index >= 0) {
		// Update existing
		existing[index] = { ...existing[index], ...rule, updatedAt: Date.now() };
		const content = existing.map((r) => JSON.stringify(r)).join("\n") + "\n";
		writeAtomic(file, content);
		return existing[index];
	}

	// Append new
	appendFileSync(file, JSON.stringify(rule) + "\n", "utf8");
	return rule;
}

/**
 * Update an existing rule by ID with patch object.
 * @param {string} id
 * @param {object} patch
 * @returns {object|null} Updated rule or null if not found
 */
export function updateRule(id, patch) {
	if (!id) return null;
	const root = getRulesRoot();
	if (!existsSync(root)) return null;

	// Find target rule
	const all = listRules({ activeOnly: false });
	const target = all.find((r) => r.id === id);
	if (!target) return null;

	const file = rulesFile(target.scope, target.category, target.project);
	if (!existsSync(file)) return null;

	const existing = parseJsonl(readFileSync(file, "utf8"));
	const idx = existing.findIndex((r) => r.id === id);
	if (idx < 0) return null;

	const updated = normalizeRule({
		...existing[idx],
		...patch,
		id: existing[idx].id,
		updatedAt: Date.now(),
	});

	existing[idx] = updated;
	const content = existing.map((r) => JSON.stringify(r)).join("\n") + "\n";
	writeAtomic(file, content);
	return updated;
}

/**
 * Soft-delete / retract a rule by marking its status as "retracted".
 * @param {string} id
 * @returns {boolean} True if retracted, false if not found
 */
export function removeRule(id) {
	const res = updateRule(id, { status: "retracted" });
	return Boolean(res);
}

/**
 * Load metadata file (meta.json).
 * @returns {object}
 */
export function loadMeta() {
	const metaPath = path.join(getRulesRoot(), META_FILE_NAME);
	try {
		if (existsSync(metaPath)) {
			return JSON.parse(readFileSync(metaPath, "utf8"));
		}
	} catch {}
	return {
		version: 1,
		createdAt: Date.now(),
		lastDistillAt: 0,
		stats: { totalInjected: 0, totalLearned: 0 },
	};
}

/**
 * Save / patch metadata file.
 * @param {object} patch
 * @returns {object}
 */
export function saveMeta(patch) {
	const current = loadMeta();
	const next = { ...current, ...patch, updatedAt: Date.now() };
	const metaPath = path.join(getRulesRoot(), META_FILE_NAME);
	writeAtomic(metaPath, JSON.stringify(next, null, 2) + "\n");
	return next;
}

/**
 * Enqueue a job into queue.jsonl for background distilling.
 * @param {object} job
 */
export function enqueueJob(job) {
	const queueFile = path.join(getRulesRoot(), QUEUE_FILE_NAME);
	ensureDir(path.dirname(queueFile));
	const record = {
		id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		createdAt: Date.now(),
		status: "pending",
		...job,
	};
	appendFileSync(queueFile, JSON.stringify(record) + "\n", "utf8");
	return record;
}

/**
 * Dequeue pending jobs up to limit.
 * @param {number} [limit=5]
 * @returns {object[]}
 */
export function dequeueJobs(limit = 5) {
	const queueFile = path.join(getRulesRoot(), QUEUE_FILE_NAME);
	if (!existsSync(queueFile)) return [];
	try {
		const content = readFileSync(queueFile, "utf8");
		const lines = content
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		const pending = [];
		for (const line of lines) {
			try {
				const job = JSON.parse(line);
				if (job.status === "pending") {
					pending.push(job);
					if (pending.length >= limit) break;
				}
			} catch {}
		}
		return pending;
	} catch {
		return [];
	}
}

/**
 * Mark a job as completed in queue.jsonl.
 * @param {string} jobId
 */
export function markJobDone(jobId) {
	const queueFile = path.join(getRulesRoot(), QUEUE_FILE_NAME);
	if (!existsSync(queueFile)) return;
	try {
		const content = readFileSync(queueFile, "utf8");
		const lines = content
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		const next = lines.map((line) => {
			try {
				const j = JSON.parse(line);
				if (j.id === jobId)
					return JSON.stringify({ ...j, status: "done", doneAt: Date.now() });
			} catch {}
			return line;
		});
		writeAtomic(queueFile, next.join("\n") + "\n");
	} catch {}
}

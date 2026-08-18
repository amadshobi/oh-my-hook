/**
 * memory/inject.js — Dynamic memory injector for OpenCode prompts.
 *
 * Formats matched rules into concise, token-efficient prompt sections.
 */
import { listRules, getRulesRoot } from "./rstore.js";
import { scoreAll } from "./matcher.js";
import { readAllMemory, projectSlug } from "./store.js";

/** Default category quotas for topK allocation */
const DEFAULT_BUDGET = {
	topK: 8,
	minScore: 0.35,
	maxPreferences: 2,
	maxProjectSkills: 3,
	maxSharedSkills: 3,
	recencyFallbackCount: 3,
};

/**
 * Filter and select top rules based on category quotas.
 * @param {Array<{ rule: object, score: number }>} scoredRules
 * @param {object} [budget]
 * @returns {object[]} Selected rule records
 */
export function selectRules(scoredRules = [], budget = {}) {
	const cfg = { ...DEFAULT_BUDGET, ...budget };
	const prefs = [];
	const projectSkills = [];
	const sharedSkills = [];

	for (const { rule } of scoredRules) {
		if (rule.category === "preference" && prefs.length < cfg.maxPreferences) {
			prefs.push(rule);
		} else if (
			rule.category === "project_skill" &&
			projectSkills.length < cfg.maxProjectSkills
		) {
			projectSkills.push(rule);
		} else if (
			rule.category === "shared_skill" &&
			sharedSkills.length < cfg.maxSharedSkills
		) {
			sharedSkills.push(rule);
		}

		const total = prefs.length + projectSkills.length + sharedSkills.length;
		if (total >= cfg.topK) break;
	}

	return [...prefs, ...projectSkills, ...sharedSkills];
}

/**
 * Format selected rules into clear, structured markdown sections.
 * @param {object[]} rules
 * @returns {string}
 */
export function formatSections(rules = []) {
	if (!rules || rules.length === 0) return "";

	const prefs = rules.filter((r) => r.category === "preference");
	const pSkills = rules.filter((r) => r.category === "project_skill");
	const sSkills = rules.filter((r) => r.category === "shared_skill");

	const sections = [];

	if (prefs.length > 0) {
		const lines = prefs.map((r) => `- ${r.content}`).join("\n");
		sections.push(`### Preferences (User Habits)\n${lines}`);
	}

	if (pSkills.length > 0) {
		const lines = pSkills
			.map((r) => {
				const rationale = r.rationale ? ` *(Alasan: ${r.rationale})*` : "";
				return `- ${r.content}${rationale}`;
			})
			.join("\n");
		sections.push(`### Project SOP & Rules\n${lines}`);
	}

	if (sSkills.length > 0) {
		const lines = sSkills.map((r) => `- ${r.content}`).join("\n");
		sections.push(`### Shared Engineering Patterns\n${lines}`);
	}

	if (sections.length === 0) return "";

	return `# Active Learned Memory\n\n${sections.join("\n\n")}`;
}

/**
 * Main dynamic injector function called from hooks.
 * @param {object} params
 * @param {string} [params.directory] Target project directory
 * @param {string} [params.query] Query text from user prompt & recent context
 * @param {object} [params.config] oh-my-hook configuration
 * @param {boolean} [params.capBudget=true] If false, includes all active rules (for compaction)
 * @returns {{ text: string, hitIds: string[], count: number }}
 */
export function injectMemory({
	directory,
	query,
	config = {},
	capBudget = true,
}) {
	const memCfg = config?.memory || {};
	const slug = directory ? projectSlug(directory) : "";

	// 1. Fetch all candidate rules from structured store
	let rules = [];
	try {
		rules = listRules({ projectSlug: slug, activeOnly: true });
	} catch {
		rules = [];
	}

	// 2. Read legacy/curated markdown memory
	const legacyText = readAllMemory(directory);

	// If structured rules exist, run dynamic BM25 matching
	if (rules.length > 0) {
		let selected = [];

		if (!capBudget) {
			// Compaction context: include all active rules up to safety limit
			selected = rules.slice(0, 30);
		} else if (query && query.trim()) {
			const scored = scoreAll(query, rules, {
				minScore: memCfg.minScore ?? DEFAULT_BUDGET.minScore,
				boostProject: memCfg.boostProject ?? 1.3,
				boostPrefs: memCfg.boostPrefs ?? 1.2,
			});
			selected = selectRules(scored, memCfg.budget);
		}

		// Recency fallback if query matched nothing or query was empty
		if (selected.length === 0 && rules.length > 0) {
			const fallbackCount =
				memCfg.recencyFallbackCount ?? DEFAULT_BUDGET.recencyFallbackCount;
			const sortedByRecent = [...rules].sort(
				(a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
			);
			selected = sortedByRecent.slice(0, fallbackCount);
		}

		if (selected.length > 0) {
			const text = formatSections(selected);
			const hitIds = selected.map((r) => r.id);
			const fullText =
				legacyText && legacyText.trim()
					? `${text}\n\n${legacyText.trim()}`
					: text;
			return { text: fullText, hitIds, count: selected.length };
		}
	}

	// 3. Fallback to legacy markdown store if structured rules yielded nothing
	if (legacyText && legacyText.trim()) {
		return {
			text: legacyText.trim(),
			hitIds: [],
			count: 1,
		};
	}

	return { text: "", hitIds: [], count: 0 };
}

/**
 * tui/src/lib/metrics.js — calculates active guard counts and structured memory statistics.
 */
import { loadConfig } from "../../../share/config.js";
import {
	readAllMemory,
	parseBullets,
	projectSlug,
} from "../../../memory/store.js";
import { listRules } from "../../../memory/rstore.js";

const BOOLEAN_GUARD_FLAGS = [
	"readBeforeWrite",
	"staleWrite",
	"planMode",
	"secretScanner",
	"commitGuard",
	"devServerGuard",
	"dangerousBash",
];

/**
 * Calculate the number of active guards configured.
 * @param {object} [config] Parsed oh-my-hook configuration object.
 * @returns {number} Count of active guards.
 */
export function getActiveGuardsCount(config) {
	const cfg = config || loadConfig().config;
	const guard = cfg?.guard || {};

	let count = 0;
	for (const flag of BOOLEAN_GUARD_FLAGS) {
		if (guard[flag] !== false) {
			count++;
		}
	}

	if (guard.tools && typeof guard.tools === "object") {
		count += Object.keys(guard.tools).length;
	}

	return count;
}

/**
 * Calculate the number of structured rules and legacy notes for a project directory.
 * @param {string} [projectDirectory] Target workspace directory.
 * @returns {{ count: number, preferences: number, projectSkills: number, sharedSkills: number }}
 */
export function getStructuredMemoryStats(projectDirectory) {
	try {
		const slug = projectSlug(projectDirectory);
		const rules = listRules({ projectSlug: slug, activeOnly: true });

		if (rules.length > 0) {
			return {
				count: rules.length,
				preferences: rules.filter((r) => r.category === "preference").length,
				projectSkills: rules.filter((r) => r.category === "project_skill")
					.length,
				sharedSkills: rules.filter((r) => r.category === "shared_skill").length,
			};
		}

		// Fallback count to legacy
		const raw = readAllMemory(projectDirectory);
		const legacyCount = parseBullets(raw).length;
		return {
			count: legacyCount,
			preferences: 0,
			projectSkills: legacyCount,
			sharedSkills: 0,
		};
	} catch {
		return { count: 0, preferences: 0, projectSkills: 0, sharedSkills: 0 };
	}
}

/**
 * Calculate total memory note/rule count.
 * @param {string} [projectDirectory]
 * @returns {number}
 */
export function getCuratedMemoryCount(projectDirectory) {
	return getStructuredMemoryStats(projectDirectory).count;
}

/**
 * Get all active memory rules for a directory.
 * @param {string} [projectDirectory]
 * @returns {object[]}
 */
export function getMemoryRules(projectDirectory) {
	try {
		const slug = projectSlug(projectDirectory);
		return listRules({ projectSlug: slug, activeOnly: true });
	} catch {
		return [];
	}
}

/**
 * Get comprehensive metrics for the TUI sidebar.
 * @param {string} [projectDirectory] Target workspace directory.
 * @param {object} [config] Optional config override.
 * @returns {{ guardsActive: number, memoryNotes: number, memoryStats: object }}
 */
export function getMetrics(projectDirectory, config) {
	const memoryStats = getStructuredMemoryStats(projectDirectory);
	return {
		guardsActive: getActiveGuardsCount(config),
		memoryNotes: memoryStats.count,
		memoryStats,
	};
}

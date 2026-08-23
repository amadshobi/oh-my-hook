/**
 * tui/src/lib/metrics.js — calculates active guards and memory stats for TUI.
 */
import { loadConfig } from "../../../share/config.js";
import { listMemoryEntries } from "../../../memory/store.js";
import { loadModeState, currentPlan } from "../../../share/state.js";
import { readPlanContent } from "../../../plans/store.js";
import { parsePlanLines } from "../../../plans/parser.js";
import { getCompressMetrics } from "../../../compress/stats.js";

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
	const guard = cfg?.sandbox || cfg?.guard || {};

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
 * Calculate the number of memory bullets for a project directory.
 * @param {string} [projectDirectory] Target workspace directory.
 * @returns {{ count: number, global: number, project: number }}
 */
export function getStructuredMemoryStats(projectDirectory) {
	try {
		const entries = listMemoryEntries(projectDirectory);
		const globalCount = entries.filter((e) => e.scope === "global").length;
		const projectCount = entries.filter((e) => e.scope === "project").length;
		return {
			count: entries.length,
			global: globalCount,
			project: projectCount,
		};
	} catch {
		return { count: 0, global: 0, project: 0 };
	}
}

/**
 * Calculate total memory bullet count.
 * @param {string} [projectDirectory]
 * @returns {number}
 */
export function getCuratedMemoryCount(projectDirectory) {
	return getStructuredMemoryStats(projectDirectory).count;
}

/**
 * Get all active memory bullets for a directory.
 * @param {string} [projectDirectory]
 * @returns {Array<{ content: string, scope: string }>}
 */
export function getMemoryRules(projectDirectory) {
	try {
		return listMemoryEntries(projectDirectory);
	} catch {
		return [];
	}
}

/**
 * Get active plan review data for a session.
 * @param {string} sessionID
 * @param {string} [directory]
 * @returns {{ planName: string, planFile: string, content: string, lines: object[] }}
 */
export function getPlanReviewData(sessionID, directory) {
	try {
		const state = loadModeState();
		const plan = currentPlan(state, sessionID);
		const planFile = plan?.file || "";
		const planName = plan?.name || "Rencana Aktif";
		const content = planFile ? readPlanContent(planFile) : "";
		const lines = content ? parsePlanLines(content) : [];
		return {
			planName,
			planFile,
			content,
			lines,
		};
	} catch {
		return { planName: "Rencana", planFile: "", content: "", lines: [] };
	}
}

/**
 * Get comprehensive workspace metrics for the TUI sidebar.
 * @param {string} [projectDirectory] Target workspace directory.
 * @param {object} [config] Optional config override.
 * @returns {object}
 */
export function getMetrics(projectDirectory, config, sessionID) {
	const cfg = config || loadConfig().config;
	const memoryStats = getStructuredMemoryStats(projectDirectory);
	const memoryEnabled = cfg?.memory?.enabled !== false;
	const plansEnabled = cfg?.plans?.enabled !== false;
	const sandboxEnabled = cfg?.sandbox?.enabled !== false;
	const compressEnabled = cfg?.compress?.enabled !== false;
	const planModeEnabled = plansEnabled && cfg?.sandbox?.planMode !== false;
	const compressStats = getCompressMetrics(sessionID);

	return {
		config: cfg,
		modeEnabled: planModeEnabled,
		memoryEnabled,
		sandboxEnabled,
		compressEnabled,
		guardsActive: getActiveGuardsCount(cfg),
		memoryNotes: memoryStats.count,
		memoryStats,
		compress: compressStats,
	};
}

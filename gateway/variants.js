/**
 * gateway/variants.js — Dynamic OMP Catalog & Wire Thinking Tier Resolver
 *
 * Reads exact model metadata and thinking tiers directly from Oh-My-Pi catalog (`models.json`)
 * with a resilient heuristic fallback for zero-day / unindexed models.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { isReasoningModel } from "./normalizer.js";

// In-memory cache for OMP catalog
let ompCatalogCache = null;

const OMP_CATALOG_PATHS = [
	join(
		homedir(),
		"library",
		"repos",
		"oh-my-pi",
		"packages",
		"catalog",
		"src",
		"models.json",
	),
	join(homedir(), ".omp", "catalog", "models.json"),
];

/**
 * Invalidate in-memory OMP catalog cache (useful for tests and disk updates)
 */
export function resetOmpCatalog() {
	ompCatalogCache = null;
}

/**
 * Load OMP models.json catalog into memory once
 */
export function getOmpCatalog() {
	if (ompCatalogCache !== null) return ompCatalogCache;

	for (const catalogPath of OMP_CATALOG_PATHS) {
		if (existsSync(catalogPath)) {
			try {
				ompCatalogCache = JSON.parse(readFileSync(catalogPath, "utf8"));
				return ompCatalogCache;
			} catch {
				// ignore parse error and try next
			}
		}
	}

	ompCatalogCache = {};
	return ompCatalogCache;
}

/**
 * Look up full model metadata directly from OMP catalog database
 *
 * @param {string} rawModelId
 * @returns {any | null}
 */
export function lookupOmpModel(rawModelId) {
	const catalog = getOmpCatalog();
	if (!catalog || Object.keys(catalog).length === 0) return null;

	const parts = rawModelId.split("/");
	const provider = parts[0].toLowerCase();
	const modelSlug = parts.slice(1).join("/");
	const bareSlug = parts[parts.length - 1];

	// 1. Direct provider + modelSlug lookup
	if (catalog[provider] && catalog[provider][modelSlug]) {
		return catalog[provider][modelSlug];
	}
	if (catalog[provider] && catalog[provider][bareSlug]) {
		return catalog[provider][bareSlug];
	}

	// 2. Global search across all catalog providers
	for (const p of Object.keys(catalog)) {
		if (catalog[p][modelSlug]) {
			return catalog[p][modelSlug];
		}
		if (catalog[p][bareSlug]) {
			return catalog[p][bareSlug];
		}
		for (const key of Object.keys(catalog[p])) {
			if (key.endsWith(`/${bareSlug}`) || key === bareSlug) {
				return catalog[p][key];
			}
		}
	}

	return null;
}

/**
 * Look up exact thinking tiers directly from OMP catalog database
 */
export function lookupOmpCatalogEfforts(rawModelId) {
	const model = lookupOmpModel(rawModelId);
	if (model?.thinking?.efforts && Array.isArray(model.thinking.efforts)) {
		return model.thinking.efforts;
	}
	return null;
}

/**
 * Universal safe fallback for future/zero-day models not yet indexed in OMP catalog.
 * Avoids fragile version hardcoding and protects against upstream HTTP 400 errors.
 */
export function fallbackHeuristicEfforts(rawModelId) {
	if (!isReasoningModel(rawModelId)) return null;

	// Canonical universal baseline tiers (safe across OpenAI, Anthropic, Gemini, DeepSeek)
	return ["low", "medium", "high"];
}

/**
 * Determine supported wire thinking efforts for a model.
 * Prioritizes OMP Catalog authority first, then falls back to heuristics.
 */
export function getSupportedThinkingEfforts(rawModelId) {
	// 1. Check authoritative OMP catalog
	const catalogEfforts = lookupOmpCatalogEfforts(rawModelId);
	if (catalogEfforts && catalogEfforts.length > 0) {
		return catalogEfforts;
	}

	// 2. Fallback heuristic
	return fallbackHeuristicEfforts(rawModelId);
}

/**
 * Generate OpenCode-compatible variants dictionary for a model ID.
 */
export function generateModelVariants(rawModelId) {
	const efforts = getSupportedThinkingEfforts(rawModelId);
	if (!efforts || efforts.length === 0) {
		return undefined;
	}

	const variants = {};

	// Canonical ':thinking' variant pointing to standard 'high' or first available effort
	const defaultEffort = efforts.includes("high") ? "high" : efforts[0];
	variants.thinking = {
		reasoning_effort: defaultEffort,
	};

	// Generate per-tier sub-variants
	for (const effort of efforts) {
		variants[effort] = {
			reasoning_effort: effort,
		};
	}

	return variants;
}

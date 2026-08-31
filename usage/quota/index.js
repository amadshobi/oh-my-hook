/**
 * usage/quota/index.js — parallel quota aggregator across providers.
 *
 * Every provider is fetched independently (Promise.allSettled); a single
 * provider failure never blocks the others. Optional `filter` limits the
 * fetch to one provider (e.g. `/usage ollama`) to save requests.
 */
import { agentDbPath, openReadonly } from "../store-db.js";
import { fetchAntigravityQuota } from "./agy.js";
import { fetchOllamaQuota } from "./ollama.js";
import { fetchOpenRouterQuota } from "./openrouter.js";

export const PROVIDER_ALIASES = {
	agy: "agy",
	antigravity: "agy",
	google: "agy",
	"google-antigravity": "agy",
	ollama: "ollama",
	"ollama-cloud": "ollama",
	openrouter: "openrouter",
	or: "openrouter",
	router: "openrouter",
};

/** Normalize a user-supplied provider token; null when unknown. */
export function resolveProviderFilter(token) {
	if (!token) return null;
	return PROVIDER_ALIASES[token.toLowerCase()] || null;
}

/** Known provider keys for help/error output. */
export const PROVIDER_KEYS = ["agy", "ollama", "openrouter"];

/**
 * Fetch quota for all (or one) provider(s) from agent.db.
 *
 * @param {object} [opts] { agentDb, config, filter, timeoutMs }
 * @returns {Promise<{ agy: Array<object>, ollama: object, openrouter: Array<object>, skipped: Array<object> }>}
 */
export async function fetchAllQuota(opts = {}) {
	const { agentDb = agentDbPath(), config = {}, timeoutMs } = opts;
	const filter = opts.filter ? resolveProviderFilter(opts.filter) : null;

	const handle = await openReadonly(agentDb);
	try {
		const { db } = handle;
		const jobs = [];

		if (!filter || filter === "agy") {
			jobs.push(
				fetchAntigravityQuota(db, { timeoutMs }).then((r) => ["agy", r]),
			);
		}
		if (!filter || filter === "ollama") {
			jobs.push(
				fetchOllamaQuota(db, config, { timeoutMs }).then((r) => ["ollama", r]),
			);
		}
		if (!filter || filter === "openrouter") {
			jobs.push(
				fetchOpenRouterQuota(db, { timeoutMs }).then((r) => ["openrouter", r]),
			);
		}

		const settled = await Promise.allSettled(jobs);
		const out = { agy: [], ollama: null, openrouter: [] };
		const skipped = [];

		for (const job of settled) {
			if (job.status === "fulfilled") {
				out[job.value[0]] = job.value[1];
			} else {
				skipped.push({
					provider: "unknown",
					error: job.reason?.message || "unknown error",
				});
			}
		}

		// Ensure non-selected providers are null (not fetched).
		for (const key of PROVIDER_KEYS) {
			if (out[key] === undefined) out[key] = null;
		}

		return { ...out, skipped };
	} finally {
		handle.close();
	}
}

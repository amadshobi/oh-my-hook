/**
 * usage/quota/ollama.js — Ollama Cloud usage fetcher (multi-key aggregate).
 *
 * Ollama Cloud does NOT expose account identity via its API (all identity
 * endpoints 404, key is not a JWT). So labels come from config
 * (`usage.quota.ollama.accounts`, key-prefix → name) with fallback `key#<id>`.
 *
 * Display strategy (user decision, Opsi A):
 * - Fetch ALL keys in parallel (never pick one).
 * - Weekly = max(usage) across keys (most conservative).
 * - Request count = sum(request_count) across keys.
 */
import { getOllamaCreds, resolveOllamaLabel } from "./store.js";

const USAGE_URL = "https://ollama.com/api/usage";
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Fetch usage for a single ollama key.
 *
 * @param {object} cred parsed credential (key, id)
 * @param {object} [opts] { timeoutMs }
 * @returns {Promise<{ weekly: number, session: number, models: Array<{name, request_count}> }>}
 */
export async function fetchOllamaKey(cred, opts = {}) {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(USAGE_URL, {
			headers: { Authorization: `Bearer ${cred.key}` },
			signal: controller.signal,
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		const data = await res.json();
		return {
			weekly: data.limits?.weekly?.usage ?? 0,
			session: data.limits?.session?.usage ?? 0,
			models: data.limits?.weekly?.models || [],
		};
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Fetch + aggregate ALL ollama keys into a single summary.
 *
 * @param {object} db open agent.db handle
 * @param {object} [config] usage config (accounts label map)
 * @param {object} [opts] { timeoutMs }
 * @returns {Promise<{ status: string, weekly: number, session: number, requestCount: number, accounts: Array<object>, skipped: Array<{id: number, label: string, error: string}> }>}
 */
export async function fetchOllamaQuota(db, config = {}, opts = {}) {
	const accounts = config?.quota?.ollama?.accounts || {};
	const creds = getOllamaCreds(db);

	if (creds.length === 0) {
		return {
			status: "empty",
			weekly: 0,
			session: 0,
			requestCount: 0,
			accounts: [],
			skipped: [],
		};
	}

	const settled = await Promise.allSettled(
		creds.map((cred) => fetchOllamaKey(cred, opts)),
	);

	const accountsOut = [];
	const skipped = [];
	for (let i = 0; i < creds.length; i++) {
		const cred = creds[i];
		const label = resolveOllamaLabel(cred, accounts);
		if (settled[i].status === "fulfilled") {
			accountsOut.push({
				id: cred.id,
				label,
				weekly: settled[i].value.weekly,
				session: settled[i].value.session,
				models: settled[i].value.models,
			});
		} else {
			skipped.push({
				id: cred.id,
				label,
				error: settled[i].reason?.message || "unknown error",
			});
		}
	}

	return {
		status: accountsOut.length > 0 ? "ok" : "error",
		weekly: Math.max(0, ...accountsOut.map((a) => a.weekly)),
		session: Math.max(0, ...accountsOut.map((a) => a.session)),
		requestCount: accountsOut.reduce(
			(sum, a) =>
				sum + a.models.reduce((s, m) => s + (m.request_count || 0), 0),
			0,
		),
		accounts: accountsOut,
		skipped,
	};
}

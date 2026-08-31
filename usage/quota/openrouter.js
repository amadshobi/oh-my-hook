/**
 * usage/quota/openrouter.js — OpenRouter credit & key-limit fetcher.
 *
 * Two endpoints: `/api/v1/auth/key` (key limits + label) and `/credits`
 * (balance). Both are documented public endpoints; failures are isolated
 * so a dead key never kills the whole quota view.
 */
import { getOpenRouterCreds } from "./store.js";

const KEY_URL = "https://openrouter.ai/api/v1/auth/key";
const CREDITS_URL = "https://openrouter.ai/api/v1/credits";
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Fetch key info + credit balance for a single openrouter key.
 *
 * @param {object} cred parsed credential (key, id)
 * @param {object} [opts] { timeoutMs }
 * @returns {Promise<{ label: string, limit: object|null, balance: object|null }>}
 */
export async function fetchOpenRouterKey(cred, opts = {}) {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const headers = { Authorization: `Bearer ${cred.key}` };
		const [keyRes, creditRes] = await Promise.all([
			fetch(KEY_URL, { headers, signal: controller.signal }),
			fetch(CREDITS_URL, { headers, signal: controller.signal }),
		]);

		let keyData = null;
		let creditData = null;

		if (keyRes.ok) keyData = await keyRes.json();
		if (creditRes.ok) creditData = await creditRes.json();

		const limit = keyData?.data?.limit || null;
		const credits = creditData?.data?.total_credits ?? null;

		return {
			label: keyData?.data?.label || `key#${cred.id}`,
			limit,
			credits,
		};
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Fetch openrouter balance + limits for all keys.
 *
 * @param {object} db open agent.db handle
 * @param {object} [opts] { timeoutMs }
 * @returns {Promise<Array<{ id: number, label: string, status: string, credits?: number|null, limit?: object|null, error?: string }>>}
 */
export async function fetchOpenRouterQuota(db, opts = {}) {
	const creds = getOpenRouterCreds(db);
	const settled = await Promise.allSettled(
		creds.map((cred) => fetchOpenRouterKey(cred, opts)),
	);

	return settled.map((r, i) => {
		if (r.status === "fulfilled") {
			return {
				id: creds[i].id,
				label: r.value.label,
				status: "ok",
				credits: r.value.credits,
				limit: r.value.limit,
			};
		}
		return {
			id: creds[i].id,
			label: `key#${creds[i].id}`,
			status: "error",
			error: r.reason?.message || "unknown error",
		};
	});
}

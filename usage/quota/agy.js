/**
 * usage/quota/agy.js — Google Antigravity (CCA) quota fetcher.
 *
 * Calls the internal quota summary endpoint for each credential and returns
 * per-account buckets (weekly / 5-hour limits with remaining fraction and
 * reset time). Field-verified against `~/.shell/tools/agy-usage`.
 */
import { getAntigravityCreds } from "./store.js";

const QUOTA_URL =
	"https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary";
const USER_AGENT =
	"antigravity/hub/1.0.0 (aidev_client; os_type=linux; arch=x86_64)";

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Fetch quota summary for a single antigravity credential.
 *
 * @param {object} cred parsed credential (access, projectId, email, expires)
 * @param {object} [opts] { timeoutMs }
 * @returns {Promise<{ account: string, projectId: string, buckets: Array<object>, raw: object }>}
 */
export async function fetchAntigravityAccount(cred, opts = {}) {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	// Expired access token → skip (never crash the whole fetch).
	if (cred.expires && Date.now() > cred.expires) {
		throw new Error("access token expired");
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(QUOTA_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${cred.access}`,
				"Content-Type": "application/json",
				"User-Agent": USER_AGENT,
			},
			body: JSON.stringify({ project: cred.projectId }),
			signal: controller.signal,
		});

		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}

		const data = await res.json();

		const buckets = [];
		for (const group of data.groups || []) {
			for (const bucket of group.buckets || []) {
				buckets.push({
					group: group.displayName,
					name: bucket.displayName,
					remainingFraction: bucket.remainingFraction ?? 0,
					resetTime: bucket.resetTime || null,
				});
			}
		}

		return {
			account: cred.email || "unknown",
			projectId: cred.projectId || "",
			buckets,
			raw: data,
		};
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Fetch quota for ALL antigravity accounts (isolated failures).
 *
 * @param {object} db open agent.db handle
 * @param {object} [opts] { timeoutMs }
 * @returns {Promise<Array<{ account: string, projectId: string, status: string, buckets?: Array<object>, error?: string }>>}
 */
export async function fetchAntigravityQuota(db, opts = {}) {
	const creds = getAntigravityCreds(db);
	const results = await Promise.allSettled(
		creds.map((cred) => fetchAntigravityAccount(cred, opts)),
	);

	return results.map((r, i) => {
		const cred = creds[i];
		if (r.status === "fulfilled") {
			return {
				account: r.value.account,
				projectId: r.value.projectId,
				status: "ok",
				buckets: r.value.buckets,
			};
		}
		return {
			account: cred.email || "unknown",
			projectId: cred.projectId || "",
			status: "error",
			error: r.reason?.message || "unknown error",
		};
	});
}

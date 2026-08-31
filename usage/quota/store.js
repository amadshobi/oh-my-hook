/**
 * usage/quota/store.js — read-only credential reader for `~/.omp/agent/agent.db`.
 *
 * The `auth_credentials` table stores provider auth as a JSON blob in `data`
 * (fields vary per provider: `access`, `email`, `projectId`, `key`, ...).
 * Columns like `email`/`project_id` do NOT exist — everything lives in `data`.
 */
import { agentDbPath } from "../store-db.js";

/** SQLite row → parsed credential object (never expose raw secrets in output). */
function parseCredential(row) {
	try {
		return {
			id: row.id,
			provider: row.provider,
			...JSON.parse(row.data || "{}"),
		};
	} catch {
		return { id: row.id, provider: row.provider };
	}
}

/**
 * Read all credentials for a provider from agent.db (read-only).
 *
 * @param {object} db Open sqlite handle (from openReadonly)
 * @param {string} provider e.g. "google-antigravity" | "ollama-cloud" | "openrouter"
 * @returns {Array<object>} parsed credential rows (id + provider + data fields)
 */
export function getProviderCredentials(db, provider) {
	const rows = db
		.prepare(
			"SELECT id, provider, data FROM auth_credentials WHERE provider = ?",
		)
		.all(provider);
	return rows.map(parseCredential);
}

/** Convenience: google-antigravity credentials. */
export function getAntigravityCreds(db) {
	return getProviderCredentials(db, "google-antigravity");
}

/** Convenience: ollama-cloud credentials (multiple keys possible). */
export function getOllamaCreds(db) {
	return getProviderCredentials(db, "ollama-cloud");
}

/** Convenience: openrouter credentials. */
export function getOpenRouterCreds(db) {
	return getProviderCredentials(db, "openrouter");
}

/**
 * Resolve an account display label for an ollama credential.
 *
 * Priority:
 * 1. Manual label from config `usage.quota.ollama.accounts` (key-prefix → name)
 * 2. Fallback `key#<id>` — predictable, never hidden.
 *
 * @param {object} cred parsed ollama credential
 * @param {object} [accounts] config map { keyPrefix: name }
 * @returns {string}
 */
export function resolveOllamaLabel(cred, accounts = {}) {
	const key = cred.key || "";
	for (const [prefix, name] of Object.entries(accounts || {})) {
		if (key.startsWith(prefix)) return name;
	}
	return `key#${cred.id}`;
}

/**
 * Filter credentials by account label (e.g. only the "sohib" Pro account).
 * Useful when config limits which accounts to monitor.
 *
 * @param {Array<object>} creds parsed credentials
 * @param {Array<string>} [includeLabels] if set, keep only these labels
 * @param {object} [accounts] label map for resolveOllamaLabel
 * @returns {Array<object>}
 */
export function filterCredsByLabel(creds, includeLabels, accounts) {
	if (!includeLabels || includeLabels.length === 0) return creds;
	const wanted = new Set(includeLabels);
	return creds.filter((c) => wanted.has(resolveOllamaLabel(c, accounts)));
}

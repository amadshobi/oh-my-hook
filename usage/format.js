/**
 * usage/format.js — renderer for quota & token output.
 *
 * All output is plain text / nerd glyphs (NO emoji — repo rule).
 * Transcript-safe: NO ANSI escape codes (TUI transcript mangles them,
 * eating brackets & parens after the color sequence).
 */

/** Plain 3-tier bar (no ANSI — transcript-safe): [██████░░░░] 84.2% */
export function renderBar(fraction, width = 24) {
	const clamped = Math.max(0, Math.min(1, fraction));
	const filled = Math.round(clamped * width);
	const empty = width - filled;
	const percent = (clamped * 100).toFixed(1);
	const bar = "█".repeat(filled) + "░".repeat(empty);
	return `[${bar}] ${percent}%`;
}

/** "6d 11h" / "4h 59m" / "ready" / "fresh". */
export function formatRelativeTime(isoString) {
	if (!isoString) return "fresh";
	const target = new Date(isoString).getTime();
	const diffMs = target - Date.now();
	if (diffMs <= 0) return "ready";
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
	if (diffHours >= 24) {
		const days = Math.floor(diffHours / 24);
		const remHours = diffHours % 24;
		return `${days}d ${remHours}h`;
	}
	return `${diffHours}h ${diffMins}m`;
}

/** 1.99M / 70.32k / 1234. */
export function formatTokens(n) {
	const num = Number(n) || 0;
	if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
	if (num >= 1_000) return `${(num / 1_000).toFixed(2)}k`;
	return String(num);
}

/** $0.00 / $14.32 / $0.0002. */
export function formatUSD(n) {
	const num = Number(n) || 0;
	if (num === 0) return "$0.00";
	if (num < 0.01) return `$${num.toFixed(4)}`;
	return `$${num.toFixed(2)}`;
}

/** Cache hit ratio (0..1) or null when no data. */
export function cacheHitRatio(cacheRead, cacheWrite) {
	const read = Number(cacheRead) || 0;
	const write = Number(cacheWrite) || 0;
	const total = read + write;
	if (total === 0) return null;
	return read / total;
}

/** "6.6s" / "1m 23s" / "" when falsy. */
export function formatDuration(ms) {
	if (!ms) return "";
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)}s`;
	return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/** Shorten bucket display names: "Weekly Limit Remaining" -> "Weekly". */
function shortBucketName(name) {
	const n = (name || "").toLowerCase();
	if (n.includes("weekly")) return "Weekly";
	if (n.includes("five") || n.includes("5 hour") || n.includes("hour")) {
		return "Five-Hr";
	}
	return name || "Quota";
}

/** Render one antigravity account block (grouped by model group). */
function renderAgyAccount(acc) {
	const lines = [
		`  \u2022 ${acc.account}${acc.projectId ? ` (${acc.projectId})` : ""}`,
	];
	if (acc.status === "error") {
		lines.push(`    skipped: ${acc.error || "unknown error"}`);
		return lines.join("\n");
	}

	// Group buckets by their parent group (displayName), preserving order.
	const byGroup = new Map();
	for (const b of acc.buckets || []) {
		const g = b.group || "QUOTA";
		if (!byGroup.has(g)) byGroup.set(g, []);
		byGroup.get(g).push(b);
	}

	for (const [groupName, buckets] of byGroup) {
		lines.push(`    ${groupName.toUpperCase()}:`);
		for (const b of buckets) {
			const reset = b.resetTime ? ` (${formatRelativeTime(b.resetTime)})` : "";
			lines.push(
				`      ${shortBucketName(b.name).padEnd(8)}: ${renderBar(b.remainingFraction)}${reset}`,
			);
		}
	}
	return lines.join("\n");
}

/** Render the aggregated ollama section (one weekly line + per-account). */
function renderOllamaSection(ollama) {
	if (!ollama) return "";
	// No credentials at all → clear message, not a fake 0.0%
	if (
		ollama.status === "empty" ||
		(ollama.accounts?.length === 0 && !ollama.skipped?.length)
	) {
		return "  No Ollama Cloud credentials found in agent.db";
	}
	const header = `  Weekly  : ${renderBar(ollama.weekly)}`;
	const reqs = ollama.requestCount ? ` (${ollama.requestCount} reqs)` : "";
	const lines = [header + reqs];
	for (const acc of ollama.accounts || []) {
		const models = (acc.models || [])
			.map((m) => `${m.name}: ${m.request_count}`)
			.join(", ");
		lines.push(
			`    \u2022 ${acc.label} \u00b7 ${(acc.weekly * 100).toFixed(1)}%${models ? ` (${models})` : ""}`,
		);
	}
	for (const sk of ollama.skipped || []) {
		lines.push(`    \u2022 ${sk.label} \u00b7 skipped (${sk.error})`);
	}
	return lines.join("\n");
}

/** Render openrouter section. */
function renderOpenRouterSection(entries) {
	if (!entries) return "";
	const lines = [];
	for (const e of entries) {
		if (e.status === "ok") {
			const bal = e.credits != null ? formatUSD(e.credits) : "n/a";
			const lim =
				e.limit?.usage != null ? ` / ${formatUSD(e.limit.usage)}` : "";
			lines.push(`  \u2022 ${e.label} : ${bal}${lim}`);
		} else {
			lines.push(`  \u2022 ${e.label} : error (${e.error})`);
		}
	}
	return lines.join("\n");
}

/** Render the full quota box for the transcript. */
export function renderQuotaBox(data, opts = {}) {
	const agyEmpty = !data.agy || data.agy.length === 0;
	const ollamaEmpty =
		!data.ollama ||
		data.ollama.status === "empty" ||
		(data.ollama.accounts?.length === 0 && data.ollama.skipped?.length === 0);
	const orEmpty = !data.openrouter || data.openrouter.length === 0;

	// No filter + everything empty → clear global message (not a fake 0.0%).
	if (!opts.filter && agyEmpty && ollamaEmpty && orEmpty) {
		return (
			"No provider credentials found in agent.db.\n" +
			"Login to a provider first (omp / antigravity / ollama / openrouter), then retry /usage."
		);
	}

	const parts = [];

	if (data.agy && data.agy.length > 0) {
		parts.push("GOOGLE ANTIGRAVITY");
		parts.push(data.agy.map(renderAgyAccount).join("\n"));
	} else if (opts.filter === "agy") {
		parts.push("GOOGLE ANTIGRAVITY");
		parts.push("  No credentials found in agent.db");
	}

	if (data.ollama && !ollamaEmpty) {
		parts.push("OLLAMA CLOUD");
		parts.push(renderOllamaSection(data.ollama));
	} else if (opts.filter === "ollama") {
		parts.push("OLLAMA CLOUD");
		parts.push("  No credentials found in agent.db");
	}

	if (data.openrouter && data.openrouter.length > 0) {
		parts.push("OPENROUTER");
		parts.push(renderOpenRouterSection(data.openrouter));
	} else if (opts.filter === "openrouter") {
		parts.push("OPENROUTER");
		parts.push("  No credentials found in agent.db");
	}

	if (parts.length === 0) {
		return (
			"No provider credentials found in agent.db.\n" +
			"Login to a provider first (omp / antigravity / ollama / openrouter), then retry /usage."
		);
	}

	const skipped = (data.skipped || []).length;
	const body = parts.join("\n\n");
	const footer =
		skipped > 0 ? `\n\nskipped: ${skipped} provider(s) failed` : "";

	return `${body}${footer}`;
}

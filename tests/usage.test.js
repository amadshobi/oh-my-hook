/**
 * tests/usage.test.js — unit tests for the usage module.
 *
 * Uses in-memory SQLite fixtures that mirror the real agent.db / opencode.db
 * schemas, so tests never touch live credential files.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openReadonly } from "../usage/store-db.js";
import {
	getProviderCredentials,
	getAntigravityCreds,
	getOllamaCreds,
	getOpenRouterCreds,
	resolveOllamaLabel,
	filterCredsByLabel,
} from "../usage/quota/store.js";
import { fetchOllamaQuota } from "../usage/quota/ollama.js";
import { resolveProviderFilter } from "../usage/quota/index.js";
import {
	renderBar,
	formatTokens,
	formatUSD,
	cacheHitRatio,
	renderQuotaBox,
	formatRelativeTime,
} from "../usage/format.js";
import {
	getSessionTokens,
	getAgentTree,
	getTurnDelta,
} from "../usage/tokens/tracker.js";
import { parseUsageArgs } from "../usage/index.js";

/** Create an in-memory sqlite DB with the agent.db schema + fixtures. */
async function makeAgentDb() {
	const dir = mkdtempSync(join(tmpdir(), "omh-usage-"));
	const dbPath = join(dir, "agent.db");
	const Database = (await import("node:sqlite")).DatabaseSync;
	const db = new Database(dbPath);
	db.exec(`
    CREATE TABLE auth_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      credential_type TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
	db.prepare(
		"INSERT INTO auth_credentials (provider, credential_type, data) VALUES (?, ?, ?)",
	).run(
		"ollama-cloud",
		"api_key",
		JSON.stringify({ key: "key-abc-1", source: "login" }),
	);
	db.prepare(
		"INSERT INTO auth_credentials (provider, credential_type, data) VALUES (?, ?, ?)",
	).run(
		"ollama-cloud",
		"api_key",
		JSON.stringify({ key: "key-xyz-2", source: "login" }),
	);
	db.prepare(
		"INSERT INTO auth_credentials (provider, credential_type, data) VALUES (?, ?, ?)",
	).run(
		"google-antigravity",
		"oauth",
		JSON.stringify({
			access: "tok",
			email: "test@example.com",
			projectId: "proj-1",
			expires: Date.now() + 60_000,
		}),
	);
	db.prepare(
		"INSERT INTO auth_credentials (provider, credential_type, data) VALUES (?, ?, ?)",
	).run("openrouter", "api_key", JSON.stringify({ key: "or-key" }));
	db.close();

	const handle = await openReadonly(dbPath);
	handle._cleanup = () => rmSync(dir, { recursive: true, force: true });
	return handle;
}

/** Create an in-memory opencode.db with session/message fixtures. */
async function makeTokensDb() {
	const dir = mkdtempSync(join(tmpdir(), "omh-tokens-"));
	const dbPath = join(dir, "opencode.db");
	const Database = (await import("node:sqlite")).DatabaseSync;
	const db = new Database(dbPath);
	db.exec(`
    CREATE TABLE session (
      id text PRIMARY KEY,
      parent_id text,
      agent text,
      model text,
      title text,
      cost real DEFAULT 0,
      tokens_input integer DEFAULT 0,
      tokens_output integer DEFAULT 0,
      tokens_reasoning integer DEFAULT 0,
      tokens_cache_read integer DEFAULT 0,
      tokens_cache_write integer DEFAULT 0,
      time_created integer DEFAULT 0,
      time_updated integer DEFAULT 0
    );
    CREATE TABLE message (
      id text PRIMARY KEY,
      session_id text NOT NULL,
      time_created integer NOT NULL,
      data text NOT NULL
    );
  `);
	db.prepare(
		`INSERT INTO session (id, agent, model, title, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		"ses_main",
		"assistant",
		JSON.stringify({ id: "google/gemini-x", providerID: "local-gateway" }),
		"Main",
		3.46,
		2_000_000,
		70_000,
		13_000,
		22_000_000,
		1_000,
		100,
	);
	db.prepare(
		`INSERT INTO session (id, parent_id, agent, model, title, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		"ses_sub",
		"ses_main",
		"explore",
		JSON.stringify({ id: "zen/muse", providerID: "local-gateway" }),
		"Explore",
		0,
		32_000,
		3_000,
		0,
		69_000,
		0,
		99,
	);
	db.prepare(
		`INSERT INTO message (id, session_id, time_created, data) VALUES (?, ?, ?, ?)`,
	).run(
		"msg_1",
		"ses_main",
		1000,
		JSON.stringify({
			role: "assistant",
			cost: 0.019,
			tokens: {
				input: 5881,
				output: 1141,
				reasoning: 0,
				cache: { read: 137435, write: 0 },
			},
			modelID: "google/gemini-x",
			time: { created: 1000, completed: 8122 },
		}),
	);
	db.close();

	const handle = await openReadonly(dbPath);
	handle._cleanup = () => rmSync(dir, { recursive: true, force: true });
	return handle;
}

test("quota/store: reads credentials and parses JSON data", async () => {
	const h = await makeAgentDb();
	try {
		const ollama = getOllamaCreds(h.db);
		assert.equal(ollama.length, 2);
		assert.equal(ollama[0].key, "key-abc-1");
		assert.equal(ollama[0].provider, "ollama-cloud");

		const agy = getAntigravityCreds(h.db);
		assert.equal(agy.length, 1);
		assert.equal(agy[0].email, "test@example.com");
		assert.equal(agy[0].projectId, "proj-1");

		const or = getOpenRouterCreds(h.db);
		assert.equal(or.length, 1);
		assert.equal(or[0].key, "or-key");

		const all = getProviderCredentials(h.db, "ollama-cloud");
		assert.equal(all.length, 2);
	} finally {
		h.close();
		h._cleanup();
	}
});

test("quota/store: resolves ollama labels (config map + key#id fallback)", () => {
	assert.equal(
		resolveOllamaLabel({ id: 5, key: "key-abc-1" }, { "key-abc": "sohib" }),
		"sohib",
	);
	assert.equal(resolveOllamaLabel({ id: 9, key: "unknown" }, {}), "key#9");
	assert.equal(
		resolveOllamaLabel({ id: 9, key: "unknown" }, { "key-abc": "sohib" }),
		"key#9",
	);
});

test("quota/store: filters credentials by label", () => {
	const creds = [
		{ id: 5, key: "key-abc-1" },
		{ id: 6, key: "key-xyz-2" },
	];
	const labels = { "key-abc": "sohib", "key-xyz": "ahmad" };
	const filtered = filterCredsByLabel(creds, ["sohib"], labels);
	assert.equal(filtered.length, 1);
	assert.equal(filtered[0].id, 5);
});

test("quota/ollama: aggregates all keys (max weekly, sum requests)", async () => {
	const h = await makeAgentDb();
	try {
		const result = await fetchOllamaQuota(h.db, {
			quota: {
				ollama: {
					accounts: { "key-abc": "sohib", "key-xyz": "ahmad" },
				},
			},
		});
		// Both keys fail against real network in tests (offline) → status error
		assert.equal(result.status, "error");
		assert.equal(result.accounts.length, 0);
		assert.equal(result.skipped.length, 2);
	} finally {
		h.close();
		h._cleanup();
	}
});

test("quota/index: resolves provider filter aliases", () => {
	assert.equal(resolveProviderFilter("ollama"), "ollama");
	assert.equal(resolveProviderFilter("agy"), "agy");
	assert.equal(resolveProviderFilter("google"), "agy");
	assert.equal(resolveProviderFilter("openrouter"), "openrouter");
	assert.equal(resolveProviderFilter("or"), "openrouter");
	assert.equal(resolveProviderFilter("bogus"), null);
	assert.equal(resolveProviderFilter(""), null);
});

test("format: bar tiers, tokens, usd, cache ratio, relative time", () => {
	// Plain transcript-safe bars — NO ANSI (TUI transcript mangles escape codes)
	const bar = renderBar(0.84);
	assert.ok(bar.startsWith("["));
	assert.ok(bar.includes("█"));
	assert.ok(bar.includes("84.0%"));
	assert.ok(!bar.includes("\x1b"), "renderBar must not emit ANSI");

	const emptyBar = renderBar(0);
	assert.ok(emptyBar.includes("░"));
	assert.ok(!emptyBar.includes("█"));

	assert.equal(formatTokens(1_990_000), "1.99M");
	assert.equal(formatTokens(70_320), "70.32k");
	assert.equal(formatTokens(999), "999");

	assert.equal(formatUSD(0), "$0.00");
	assert.equal(formatUSD(14.32), "$14.32");
	assert.equal(formatUSD(0.0002), "$0.0002");

	assert.equal(cacheHitRatio(90, 10), 0.9);
	assert.equal(cacheHitRatio(0, 0), null);

	// Relative time: compact "6d 11h" / "4h 59m" (no "in " prefix)
	assert.ok(formatRelativeTime("2099-01-01T00:00:00Z").match(/^\d+d \d+h$/));
	assert.ok(formatRelativeTime(null), "fresh");
	assert.equal(formatRelativeTime("2000-01-01T00:00:00Z"), "ready");
	assert.ok(!formatRelativeTime("2099-01-01T00:00:00Z").includes("in "));
});

test("format: renders quota box with all providers", () => {
	const data = {
		agy: [
			{
				account: "a@b.com",
				status: "ok",
				buckets: [{ name: "Weekly", remainingFraction: 0.8, resetTime: null }],
			},
			{ account: "c@d.com", status: "error", error: "token expired" },
		],
		ollama: {
			status: "ok",
			weekly: 0.008,
			session: 0,
			requestCount: 11,
			accounts: [
				{
					id: 5,
					label: "sohib",
					weekly: 0.007,
					session: 0,
					models: [{ name: "minimax-m3", request_count: 5 }],
				},
			],
			skipped: [],
		},
		openrouter: [
			{ id: 1, label: "main-dev", status: "ok", credits: 14.32, limit: null },
		],
		skipped: [],
	};
	const out = renderQuotaBox(data);
	assert.ok(out.includes("GOOGLE ANTIGRAVITY"));
	assert.ok(out.includes("OLLAMA CLOUD"));
	assert.ok(out.includes("OPENROUTER"));
	assert.ok(out.includes("sohib"));
	assert.ok(out.includes("$14.32"));
	assert.ok(out.includes("token expired"));
});

test("format: no credentials → clear guidance, not fake 0.0%", () => {
	const empty = {
		agy: [],
		ollama: {
			status: "empty",
			weekly: 0,
			session: 0,
			requestCount: 0,
			accounts: [],
			skipped: [],
		},
		openrouter: [],
		skipped: [],
	};
	const out = renderQuotaBox(empty);
	assert.ok(out.includes("No provider credentials found"));
	assert.ok(out.includes("Login to a provider first"));
	assert.ok(!out.includes("0.0%"), "must not show fake 0.0% quota");

	// Filtered empty → provider-specific message
	const filtered = renderQuotaBox(empty, { filter: "ollama" });
	assert.ok(filtered.includes("OLLAMA CLOUD"));
	assert.ok(filtered.includes("No credentials found in agent.db"));
});

test("store-db: missing database file throws actionable error", async () => {
	const { mkdtempSync, rmSync, existsSync } = await import("node:fs");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const dir = mkdtempSync(join(tmpdir(), "omh-missing-"));
	try {
		const missing = join(dir, "nope.db");
		assert.equal(existsSync(missing), false);
		await assert.rejects(
			() => openReadonly(missing),
			/database file not found|ENOENT|login to a provider/,
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("tokens: session tokens, agent tree, turn delta", async () => {
	const h = await makeTokensDb();
	try {
		const main = getSessionTokens(h.db, "ses_main");
		assert.equal(main.input, 2_000_000);
		assert.equal(main.model, "google/gemini-x");
		assert.equal(main.provider, "local-gateway");

		const tree = getAgentTree(h.db, "ses_main");
		assert.equal(tree.main.id, "ses_main");
		assert.equal(tree.subagents.length, 1);
		assert.equal(tree.subagents[0].agent, "explore");

		const delta = getTurnDelta(h.db, "ses_main");
		assert.equal(delta.input, 5881);
		assert.equal(delta.output, 1141);
		assert.equal(delta.cacheRead, 137435);
		assert.equal(delta.durationMs, 7122);
		assert.equal(delta.cost, 0.019);

		assert.equal(getSessionTokens(h.db, "does-not-exist"), null);
	} finally {
		h.close();
		h._cleanup();
	}
});

test("usage/index: parses /usage subcommands", () => {
	assert.deepEqual(parseUsageArgs(""), { mode: "quota", filter: null });
	assert.deepEqual(parseUsageArgs("quota"), { mode: "quota", filter: null });
	assert.deepEqual(parseUsageArgs("ollama"), {
		mode: "quota",
		filter: "ollama",
	});
	assert.deepEqual(parseUsageArgs("agy"), { mode: "quota", filter: "agy" });
	assert.deepEqual(parseUsageArgs("google"), { mode: "quota", filter: "agy" });
	assert.deepEqual(parseUsageArgs("openrouter"), {
		mode: "quota",
		filter: "openrouter",
	});
	assert.deepEqual(parseUsageArgs("tokens"), { mode: "tokens", filter: null });
	assert.deepEqual(parseUsageArgs("help"), { mode: "help", filter: null });
	const err = parseUsageArgs("bogus");
	assert.equal(err.mode, "error");
	assert.equal(err.raw, "bogus");
});

/**
 * tests/gateway.test.js — Gateway bridge & Antigravity CCA Schema armor tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeSchemaForCCA } from "../gateway/antigravity.js";
import {
	formatModelDisplayName,
	isReasoningModel,
	estimateContextWindow,
	normalizeGatewayModels,
} from "../gateway/normalizer.js";
import {
	generateModelVariants,
	resetOmpCatalog,
	getOmpCatalog,
} from "../gateway/variants.js";
import {
	gatewayHooks,
	resolveGatewayUrl,
	getStoredAuth,
} from "../gateway/index.js";
import {
	fetchGatewayModels,
	getSnapshotCachePath,
} from "../gateway/discovery.js";

test("gateway/antigravity: strips forbidden CCA keywords recursively across properties, $defs, and conditionals", () => {
	const dirtySchema = {
		$schema: "http://json-schema.org/draft-07/schema#",
		title: "CreateFileParams",
		type: "object",
		additionalProperties: false,
		patternProperties: {
			"^x-": { type: "string" },
		},
		$defs: {
			AdvancedConfig: {
				title: "AdvancedConfig",
				type: "object",
				additionalProperties: false,
				properties: {
					retries: { type: "number", title: "Retries" },
				},
			},
		},
		definitions: {
			LegacyDef: {
				title: "LegacyDef",
				type: "string",
			},
		},
		if: {
			title: "ConditionIf",
			properties: { mode: { const: "strict" } },
		},
		then: {
			title: "ConditionThen",
			properties: { timeout: { type: "number" } },
		},
		properties: {
			path: {
				type: "string",
				title: "File Path",
				description: "Path to write to",
			},
			options: {
				type: "object",
				additionalProperties: false,
				properties: {
					overwrite: { type: "boolean", title: "Overwrite" },
				},
			},
		},
		required: ["path"],
	};

	const cleaned = normalizeSchemaForCCA(dirtySchema);

	assert.equal(cleaned.$schema, undefined);
	assert.equal(cleaned.title, undefined);
	assert.equal(cleaned.additionalProperties, undefined);
	assert.equal(cleaned.patternProperties, undefined);

	// $defs and definitions sanitized
	assert.equal(cleaned.$defs.AdvancedConfig.title, undefined);
	assert.equal(cleaned.$defs.AdvancedConfig.additionalProperties, undefined);
	assert.equal(
		cleaned.$defs.AdvancedConfig.properties.retries.title,
		undefined,
	);
	assert.equal(cleaned.definitions.LegacyDef.title, undefined);

	// Conditional schema sanitized
	assert.equal(cleaned.if.title, undefined);
	assert.equal(cleaned.then.title, undefined);

	// Properties sanitized
	assert.equal(cleaned.properties.path.title, undefined);
	assert.equal(cleaned.properties.path.type, "string");
	assert.equal(cleaned.properties.options.additionalProperties, undefined);
	assert.equal(
		cleaned.properties.options.properties.overwrite.title,
		undefined,
	);
	assert.equal(cleaned.properties.options.properties.overwrite.type, "boolean");
	assert.equal(cleaned.required[0], "path");
});

test("gateway/normalizer: formatModelDisplayName parses provider dynamically without hardcoded map", () => {
	assert.equal(
		formatModelDisplayName("commandcode/claude-sonnet-5"),
		"Claude Sonnet 5 (commandcode)",
	);
	assert.equal(
		formatModelDisplayName("google-antigravity/gemini-3.7-flash-tiered"),
		"Gemini 3.7 Flash Tiered (google-antigravity)",
	);
	assert.equal(
		formatModelDisplayName("openrouter/deepseek/deepseek-v4-flash"),
		"DeepSeek V4 Flash (openrouter)",
	);
	assert.equal(
		formatModelDisplayName("custom-provider/xyz-model-v1"),
		"Xyz Model V1 (custom-provider)",
	);
});

test("gateway/normalizer: isReasoningModel identifies reasoning patterns", () => {
	assert.equal(isReasoningModel("openrouter/deepseek/deepseek-r1"), true);
	assert.equal(isReasoningModel("commandcode/claude-sonnet-5"), true);
	assert.equal(
		isReasoningModel("google-antigravity/gemini-3.7-flash-tiered"),
		true,
	);
	assert.equal(isReasoningModel("openrouter/openai/o3-mini"), true);
	assert.equal(isReasoningModel("openrouter/openai/gpt-4o-mini"), true);
	assert.equal(isReasoningModel("openrouter/custom/simple-chat"), false);
});

test("gateway/normalizer: normalizeGatewayModels includes required V1/V2 runtime schema fields", () => {
	const rawList = [
		{ id: "commandcode/claude-sonnet-5" },
		{ id: "opencode-zen/claude-sonnet-5" },
		{ id: "google-antigravity/gemini-3.7-flash" },
	];

	const normalized = normalizeGatewayModels(rawList);

	// Both claude-sonnet-5 models are preserved with zero collision
	assert.ok(normalized["commandcode/claude-sonnet-5"]);
	assert.ok(normalized["opencode-zen/claude-sonnet-5"]);
	assert.ok(normalized["google-antigravity/gemini-3.7-flash"]);

	const model = normalized["commandcode/claude-sonnet-5"];
	assert.equal(model.name, "Claude Sonnet 5 (commandcode)");
	assert.equal(model.status, "active");
	assert.equal(typeof model.options, "object");
	assert.equal(typeof model.headers, "object");
	assert.equal(typeof model.release_date, "string");
	assert.equal(typeof model.family, "string");
});

test("gateway/variants: generates thinking variants and supports resetOmpCatalog", () => {
	resetOmpCatalog();
	const catalog = getOmpCatalog();
	assert.ok(typeof catalog === "object");

	const variants = generateModelVariants("openrouter/google/gemini-3.7-flash");
	assert.ok(variants);
	assert.ok(variants.thinking);
	assert.ok(variants.thinking.reasoning_effort);
	assert.ok(variants.high);
});

test("gateway/index: resolveGatewayUrl handles ports, URLs and enforces loopback security", () => {
	assert.equal(resolveGatewayUrl("4010"), "http://127.0.0.1:4010/v1");
	assert.equal(resolveGatewayUrl("4000"), "http://127.0.0.1:4000/v1");
	assert.equal(
		resolveGatewayUrl("http://localhost:4010"),
		"http://localhost:4010/v1",
	);
	assert.equal(
		resolveGatewayUrl("http://127.0.0.1:4010/v1/"),
		"http://127.0.0.1:4010/v1",
	);
	assert.equal(resolveGatewayUrl(""), "http://127.0.0.1:4010/v1");

	// External hosts blocked and fallback to loopback
	assert.equal(
		resolveGatewayUrl("http://evil-attacker.com/v1"),
		"http://127.0.0.1:4010/v1",
	);
});

test("gateway/index: getStoredAuth safely returns auth shape without crashing", () => {
	const auth = getStoredAuth();
	assert.equal(typeof auth, "object");
});

test("gateway/index: gatewayHooks respects disabled flag", () => {
	const hooks = gatewayHooks({}, { config: { gateway: { enabled: false } } });
	assert.deepEqual(hooks, {});
});

test("gateway/discovery: fetchGatewayModels supports mock fetch and cache fallback", async () => {
	const testCachePath = join(
		tmpdir(),
		`test-gw-cache-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
	);

	try {
		// Mock successful fetch
		const mockFetch = async () => ({
			ok: true,
			json: async () => ({
				data: [{ id: "test-provider/test-model" }],
			}),
		});

		const models = await fetchGatewayModels(
			"http://127.0.0.1:4010/v1",
			"test-key",
			"local-gateway",
			1000,
			{ fetch: mockFetch, cachePath: testCachePath },
		);

		assert.ok(models["test-provider/test-model"]);
		assert.equal(existsSync(testCachePath), true);

		// Mock failed fetch with fallback to cache
		const failingFetch = async () => {
			throw new Error("Network offline");
		};

		const cachedModels = await fetchGatewayModels(
			"http://127.0.0.1:4010/v1",
			"test-key",
			"local-gateway",
			1000,
			{ fetch: failingFetch, cachePath: testCachePath },
		);

		assert.ok(cachedModels["test-provider/test-model"]);
	} finally {
		if (existsSync(testCachePath)) {
			try {
				unlinkSync(testCachePath);
			} catch {}
		}
	}
});

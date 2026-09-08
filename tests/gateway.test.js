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
	assert.equal(cleaned.properties.path.type, "STRING");
	assert.equal(cleaned.properties.options.additionalProperties, undefined);
	assert.equal(
		cleaned.properties.options.properties.overwrite.title,
		undefined,
	);
	assert.equal(cleaned.properties.options.properties.overwrite.type, "BOOLEAN");
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
	assert.equal(resolveGatewayUrl("20128"), "http://127.0.0.1:20128/v1");
	assert.equal(
		resolveGatewayUrl("http://localhost:4010"),
		"http://localhost:4010/v1",
	);
	assert.equal(
		resolveGatewayUrl("http://127.0.0.1:20128/v1/"),
		"http://127.0.0.1:20128/v1",
	);
	assert.equal(resolveGatewayUrl(""), "http://127.0.0.1:4010/v1");
	assert.equal(
		resolveGatewayUrl("", "http://127.0.0.1:20128/v1"),
		"http://127.0.0.1:20128/v1",
	);

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
	assert.equal(
		getSnapshotCachePath("vans-gateway").endsWith(
			"gateway-models-cache-vans-gateway.json",
		),
		true,
	);
	assert.equal(
		getSnapshotCachePath("local-gateway").endsWith(
			"gateway-models-cache-local-gateway.json",
		),
		true,
	);

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

test("gateway/antigravity: strips Issue #23 keywords const/contentEncoding/contentMediaType/dependent*/min|maxContains/unevaluated* recursively", () => {
	const dirtySchema = {
		const: "val",
		contentEncoding: "base64",
		contentMediaType: "application/json",
		dependentRequired: { x: ["y"] },
		dependentSchemas: { x: { type: "object" } },
		maxContains: 3,
		minContains: 1,
		unevaluatedItems: false,
		unevaluatedProperties: false,
		type: "object",
		properties: {
			flag: {
				const: "fixed",
				type: "string",
				contentEncoding: "utf-8",
				contentMediaType: "text/plain",
			},
		},
	};

	const cleaned = normalizeSchemaForCCA(dirtySchema);

	// Top-level keywords completely stripped
	assert.equal(cleaned.const, undefined);
	assert.equal(cleaned.contentEncoding, undefined);
	assert.equal(cleaned.contentMediaType, undefined);
	assert.equal(cleaned.dependentRequired, undefined);
	assert.equal(cleaned.dependentSchemas, undefined);
	assert.equal(cleaned.maxContains, undefined);
	assert.equal(cleaned.minContains, undefined);
	assert.equal(cleaned.unevaluatedItems, undefined);
	assert.equal(cleaned.unevaluatedProperties, undefined);

	// Keywords stripped recursively inside properties too
	assert.equal(cleaned.properties.flag.const, undefined);
	assert.equal(cleaned.properties.flag.contentEncoding, undefined);
	assert.equal(cleaned.properties.flag.contentMediaType, undefined);
	assert.equal(cleaned.properties.flag.type, "STRING");
});

test("gateway/antigravity: normalizes primitive type keywords to uppercase including nested properties", () => {
	const cleaned = normalizeSchemaForCCA({
		type: "object",
		properties: {
			name: { type: "string" },
			count: { type: "integer" },
			ratio: { type: "number" },
			active: { type: "boolean" },
			tags: { type: "array" },
			meta: { type: "object" },
		},
	});

	assert.equal(cleaned.type, "OBJECT");
	assert.equal(cleaned.properties.name.type, "STRING");
	assert.equal(cleaned.properties.count.type, "INTEGER");
	assert.equal(cleaned.properties.ratio.type, "NUMBER");
	assert.equal(cleaned.properties.active.type, "BOOLEAN");
	assert.equal(cleaned.properties.tags.type, "ARRAY");
	assert.equal(cleaned.properties.meta.type, "OBJECT");
});

test("gateway/antigravity: injects STRING items fallback for bare arrays and preserves normalized existing items", () => {
	// Bare array without items gets a STRING fallback
	const bare = normalizeSchemaForCCA({ type: "array" });
	assert.equal(bare.type, "ARRAY");
	assert.deepEqual(bare.items, { type: "STRING" });

	// Existing items are preserved and normalized to uppercase
	const withItems = normalizeSchemaForCCA({
		type: "array",
		items: { type: "number" },
	});
	assert.equal(withItems.type, "ARRAY");
	assert.deepEqual(withItems.items, { type: "NUMBER" });
});

test("gateway/antigravity: prunes required entries referencing missing properties", () => {
	// Case A: partial match keeps only surviving entries
	const partial = normalizeSchemaForCCA({
		type: "object",
		properties: { valid: { type: "string" } },
		required: ["valid", "ghost"],
	});
	assert.deepEqual(partial.required, ["valid"]);

	// Case B: no match deletes required entirely
	const noMatch = normalizeSchemaForCCA({
		type: "object",
		properties: { valid: { type: "string" } },
		required: ["ghost"],
	});
	assert.equal(noMatch.required, undefined);

	// Case C: clean match is preserved unchanged
	const clean = normalizeSchemaForCCA({
		type: "object",
		properties: { valid: { type: "string" } },
		required: ["valid"],
	});
	assert.deepEqual(clean.required, ["valid"]);

	// Case D: prototype pollution safety (e.g. "toString", "valueOf" not declared in properties)
	const protoCheck = normalizeSchemaForCCA({
		type: "object",
		properties: { valid: { type: "string" } },
		required: ["valid", "toString", "valueOf"],
	});
	assert.deepEqual(protoCheck.required, ["valid"]);
});

test("gateway/antigravity: injects empty properties fallback for bare object schemas after uppercase type normalization", () => {
	// Lowercase input type is uppercased AND gets the properties fallback.
	const lower = normalizeSchemaForCCA({ type: "object" });
	assert.equal(lower.type, "OBJECT");
	assert.deepEqual(lower.properties, {});

	// Already-uppercase input type also gets the properties fallback.
	const upper = normalizeSchemaForCCA({ type: "OBJECT" });
	assert.equal(upper.type, "OBJECT");
	assert.deepEqual(upper.properties, {});

	// Nested object properties without properties also receive the fallback.
	const nested = normalizeSchemaForCCA({
		type: "object",
		properties: {
			meta: { type: "object" },
		},
	});
	assert.equal(nested.properties.meta.type, "OBJECT");
	assert.deepEqual(nested.properties.meta.properties, {});

	// Existing properties are preserved untouched.
	const withProps = normalizeSchemaForCCA({
		type: "object",
		properties: { name: { type: "string" } },
	});
	assert.equal(withProps.type, "OBJECT");
	assert.deepEqual(withProps.properties, { name: { type: "STRING" } });
});

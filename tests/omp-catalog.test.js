import test from "node:test";
import assert from "node:assert/strict";
import {
	isNonChatModel,
	isReasoningModel,
	estimateContextWindow,
	parseModelsYaml,
	registerGatewayModels,
} from "../omp/catalog.js";
import { ompHooks } from "../omp/index.js";

test("omp/catalog: isNonChatModel filters embedding and media models", () => {
	assert.equal(isNonChatModel("text-embedding-3-small"), true);
	assert.equal(isNonChatModel("openai/whisper-large-v3"), true);
	assert.equal(isNonChatModel("dall-e-3"), true);
	assert.equal(isNonChatModel("gemini-3.7-flash"), false);
	assert.equal(isNonChatModel("deepseek-v4-flash"), false);
});

test("omp/catalog: isReasoningModel identifies reasoning patterns correctly", () => {
	assert.equal(isReasoningModel("deepseek/deepseek-r1"), true);
	assert.equal(isReasoningModel("openai/o1-preview"), true);
	assert.equal(isReasoningModel("openai/o3-mini"), true);
	assert.equal(isReasoningModel("gemini-3.7-flash-tiered"), true);
	assert.equal(isReasoningModel("qwen/qwq-32b"), true);
	assert.equal(isReasoningModel("gemini-2.5-flash"), false);
});

test("omp/catalog: estimateContextWindow maps known sizes", () => {
	assert.equal(estimateContextWindow("google/gemini-1.5-pro"), 1_000_000);
	assert.equal(estimateContextWindow("qwen-256k"), 256_000);
	assert.equal(estimateContextWindow("llama-3-8b"), 32_000);
	assert.equal(estimateContextWindow("custom-standard"), 200_000);
});

test("omp/catalog: parseModelsYaml parses custom providers correctly", () => {
	const sampleYaml = `
providers:
  kilo:
    name: "Kilo Gateway"
    baseUrl: "https://api.kilo.ai/api/gateway"
    api: "openai-completions"
    apiKey: "KILO_API_KEY"
    models:
      - id: "kilo-auto/small"
      - id: "openrouter/free"
`;
	const result = parseModelsYaml(sampleYaml);
	assert.ok(result.kilo);
	assert.equal(result.kilo.name, "Kilo Gateway");
	assert.equal(result.kilo.baseUrl, "https://api.kilo.ai/api/gateway");
	assert.equal(result.kilo.apiKey, "KILO_API_KEY");
	assert.equal(result.kilo.models.length, 2);
	assert.equal(result.kilo.models[0].id, "kilo-auto/small");
});

test("omp/catalog: registerGatewayModels mutates config in-place without overriding declared models", () => {
	const config = {
		provider: {
			omp: {
				models: {
					"custom-pinned": { id: "custom-pinned", name: "User Pinned" },
				},
			},
		},
	};

	const models = [
		{ id: "google-antigravity/gemini-3.7-flash-tiered" },
		{ id: "ollama-cloud/text-embedding-3" }, // Should be filtered out
		{ id: "custom-pinned" }, // Should not overwrite
	];

	registerGatewayModels(config, models, { providerId: "omp" });

	const ompEntry = config.provider.omp;
	assert.ok(ompEntry.models["gemini-3.7-flash-tiered"]);
	assert.equal(ompEntry.models["gemini-3.7-flash-tiered"].reasoning, true);
	assert.equal(ompEntry.models["text-embedding-3"], undefined);
	assert.equal(ompEntry.models["custom-pinned"].name, "User Pinned");
});

test("omp/index: ompHooks respects disabled flag", () => {
	const hooks = ompHooks({}, { config: { omp: { enabled: false } } });
	assert.deepEqual(hooks, {});
});

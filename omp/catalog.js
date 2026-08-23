/**
 * omp/catalog.js — Dynamic OMP Gateway & models.yml Model Aggregator.
 *
 * Fetches models from local OMP Gateway (:4000) and parses ~/.omp/agent/models.yml,
 * automatically registering them into OpenCode's config.provider during the config hook.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_MODELS_YML_PATH = path.join(os.homedir(), ".omp", "agent", "models.yml");

const NON_CHAT_PATTERNS = [
	/\bembed(?:ding)?\b/i,
	/\bwhisper\b/i,
	/\btts\b/i,
	/\bdall-?e\b/i,
	/\brerank\b/i,
	/\bflux\b/i,
	/\bimage-gen\b/i,
];

const REASONING_PATTERNS = [
	/\br1\b/i,
	/\bo1\b/i,
	/\bo3\b/i,
	/\bo4\b/i,
	/\breason(?:er|ing)?\b/i,
	/\bthinking\b/i,
	/\bqwq\b/i,
	/\btiered\b/i,
	/\bdeepseek-v4\b/i,
	/\bclaude-(?:sonnet|opus)-(?:4|5)/i,
	/\bgpt-5/i,
];

export function isNonChatModel(modelId) {
	return NON_CHAT_PATTERNS.some((pattern) => pattern.test(modelId));
}

export function isReasoningModel(modelId) {
	return REASONING_PATTERNS.some((pattern) => pattern.test(modelId));
}

export function estimateContextWindow(modelId) {
	const lower = modelId.toLowerCase();
	if (lower.includes("1m") || lower.includes("1.1m") || lower.includes("gemini")) {
		return 1_000_000;
	}
	if (lower.includes("500k") || lower.includes("400k")) {
		return 400_000;
	}
	if (lower.includes("256k") || lower.includes("262k")) {
		return 256_000;
	}
	if (lower.includes("128k")) {
		return 128_000;
	}
	if (lower.includes("32k") || lower.includes("7b") || lower.includes("8b")) {
		return 32_000;
	}
	return 200_000;
}

export async function fetchGatewayModels(url, timeoutMs = 1000) {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		const normalizedUrl = url.replace(/\/+$/, "");
		const res = await fetch(`${normalizedUrl}/models`, {
			signal: controller.signal,
		});
		clearTimeout(timeout);

		if (!res.ok) return [];
		const data = await res.json();
		return Array.isArray(data?.data) ? data.data : [];
	} catch {
		return [];
	}
}

export function registerGatewayModels(config, models, options = {}) {
	const providerId = options.providerId ?? "omp";
	const providerName = options.providerName ?? "OMP Gateway";
	const baseUrl = options.url ?? "http://127.0.0.1:4000/v1";

	if (!models || models.length === 0) return config;

	const provider = (config.provider ??= {});
	const entry = (provider[providerId] ??= {});

	entry.name ??= providerName;
	entry.npm ??= "@ai-sdk/openai-compatible";
	entry.options ??= {};
	entry.options.baseURL ??= baseUrl;
	entry.options.apiKey ??= "dummy";
	entry.models ??= {};

	const declaredIds = new Set(
		Object.values(entry.models)
			.map((m) => m?.id)
			.filter((id) => typeof id === "string")
	);

	for (const item of models) {
		const rawId = item.id;
		if (!rawId || isNonChatModel(rawId)) continue;
		if (declaredIds.has(rawId)) continue;

		const shortAlias = rawId.split("/").pop() || rawId;
		const modelKey = entry.models[shortAlias] ? rawId : shortAlias;

		if (entry.models[modelKey]) continue;

		const reasoning = isReasoningModel(rawId);
		const context = estimateContextWindow(rawId);

		entry.models[modelKey] = {
			name: `[OMP] ${shortAlias}`,
			id: rawId,
			reasoning,
			limit: {
				context,
				output: 16000,
			},
		};
		declaredIds.add(rawId);
	}

	return config;
}

export function parseModelsYaml(content) {
	const providers = {};
	const lines = content.split("\n");

	let currentProviderId = null;
	let currentProvider = null;
	let inModels = false;

	for (let line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const providerMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):$/);
		if (providerMatch) {
			currentProviderId = providerMatch[1];
			currentProvider = {
				name: currentProviderId,
				baseUrl: "",
				api: "openai-completions",
				apiKey: "",
				models: [],
			};
			providers[currentProviderId] = currentProvider;
			inModels = false;
			continue;
		}

		if (!currentProvider) continue;

		const nameMatch = line.match(/^ {4}name:\s*["']?([^"']+)["']?$/);
		if (nameMatch) {
			currentProvider.name = nameMatch[1];
			continue;
		}

		const baseUrlMatch = line.match(/^ {4}baseUrl:\s*["']?([^"']+)["']?$/);
		if (baseUrlMatch) {
			currentProvider.baseUrl = baseUrlMatch[1];
			continue;
		}

		const apiMatch = line.match(/^ {4}api:\s*["']?([^"']+)["']?$/);
		if (apiMatch) {
			currentProvider.api = apiMatch[1];
			continue;
		}

		const apiKeyMatch = line.match(/^ {4}apiKey:\s*["']?([^"']+)["']?$/);
		if (apiKeyMatch) {
			currentProvider.apiKey = apiKeyMatch[1];
			continue;
		}

		if (line.match(/^ {4}models:$/)) {
			inModels = true;
			continue;
		}

		if (inModels) {
			const modelMatch = line.match(/^ {6}-\s*id:\s*["']?([^"']+)["']?$/);
			if (modelMatch) {
				currentProvider.models.push({ id: modelMatch[1] });
			}
		}
	}

	return providers;
}

export function registerModelsYaml(config, yamlPath = DEFAULT_MODELS_YML_PATH) {
	if (!existsSync(yamlPath)) return config;

	try {
		const content = readFileSync(yamlPath, "utf8");
		const customProviders = parseModelsYaml(content);

		const provider = (config.provider ??= {});

		for (const [providerId, p] of Object.entries(customProviders)) {
			if (!p.baseUrl || p.models.length === 0) continue;

			const entry = (provider[providerId] ??= {});
			entry.name ??= p.name;
			entry.npm ??= "@ai-sdk/openai-compatible";
			entry.options ??= {};
			entry.options.baseURL ??= p.baseUrl;

			if (p.apiKey) {
				if (process.env[p.apiKey]) {
					entry.env ??= [p.apiKey];
				} else {
					entry.options.apiKey ??= p.apiKey;
				}
			}

			entry.models ??= {};

			const declaredIds = new Set(
				Object.values(entry.models)
					.map((m) => m?.id)
					.filter((id) => typeof id === "string")
			);

			for (const m of p.models) {
				const rawId = m.id;
				if (!rawId || isNonChatModel(rawId)) continue;
				if (declaredIds.has(rawId)) continue;

				const shortAlias = rawId.split("/").pop() || rawId;
				const modelKey = entry.models[shortAlias] ? rawId : shortAlias;

				if (entry.models[modelKey]) continue;

				const reasoning = isReasoningModel(rawId);
				const context = estimateContextWindow(rawId);

				entry.models[modelKey] = {
					name: `[${p.name}] ${shortAlias}`,
					id: rawId,
					reasoning,
					limit: {
						context,
						output: 16000,
					},
				};
				declaredIds.add(rawId);
			}
		}
	} catch {}

	return config;
}

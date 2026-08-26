/**
 * omp/catalog.js — Dynamic OMP Gateway & models.yml Model Aggregator.
 *
 * Fetches models from local OMP Gateway (:4000) and parses ~/.omp/agent/models.yml,
 * automatically registering them into OpenCode's config.provider during the config hook.
 */
import {
	readFileSync,
	existsSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_MODELS_YML_PATH = path.join(
	os.homedir(),
	".omp",
	"agent",
	"models.yml",
);

export function formatModelName(rawId) {
	const parts = rawId.split("/");
	let provider = "omp";
	let modelName = rawId;

	if (parts.length > 1) {
		provider = parts[0].toLowerCase();
		modelName = parts.slice(1).join("/");
	}

	let displayName = modelName
		.split(/[-_\/]/)
		.map((word) => {
			if (!word) return "";
			if (/^[0-9]/.test(word)) return word;
			const lower = word.toLowerCase();
			if (lower === "gemini") return "Gemini";
			if (lower === "claude") return "Claude";
			if (lower === "deepseek") return "DeepSeek";
			if (lower === "gpt") return "GPT";
			if (lower === "qwen") return "Qwen";
			if (lower === "qwq") return "QwQ";
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(" ")
		.trim();

	const aliases = {
		"google-antigravity": "agy",
		openai: "oai",
		"openai-codex": "codex",
		"github-copilot": "copilot",
		"ollama-cloud": "ollama",
		moonshot: "moon",
		nvidia: "nv",
		kilo: "kilo",
		zai: "zai",
		cursor: "cur",
	};

	const alias = aliases[provider] || provider;
	return `${displayName} (${alias})`;
}

function getHealthyModelIds() {
	const healthy = new Set();
	const gnPingCacheDir = path.join(
		os.homedir(),
		".config",
		"gn",
		"cache",
		"ping",
	);
	if (!existsSync(gnPingCacheDir)) return healthy;
	try {
		const files = readdirSync(gnPingCacheDir);
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			const filePath = path.join(gnPingCacheDir, file);
			try {
				const content = JSON.parse(readFileSync(filePath, "utf8"));
				if (Array.isArray(content?.items)) {
					for (const item of content.items) {
						if (item.status === "OK" && item.id) {
							healthy.add(item.id);
						}
					}
				}
			} catch {
				// ignore malformed
			}
		}
	} catch {
		// ignore readdir
	}
	return healthy;
}

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
	if (
		lower.includes("1m") ||
		lower.includes("1.1m") ||
		lower.includes("gemini")
	) {
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
	const cacheDir = path.join(os.homedir(), ".config", "opencode", "cache");
	const cacheFile = path.join(cacheDir, "omp-catalog-cache.json");
	const now = Date.now();
	const TTL = 3600000; // 1 hour

	let cachedData = null;
	if (existsSync(cacheFile)) {
		try {
			cachedData = JSON.parse(readFileSync(cacheFile, "utf8"));
		} catch {}
	}

	if (
		cachedData &&
		cachedData.timestamp &&
		now - cachedData.timestamp < TTL &&
		Array.isArray(cachedData.models)
	) {
		return cachedData.models;
	}

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		const normalizedUrl = url.replace(/\/+$/, "");
		const res = await fetch(`${normalizedUrl}/models`, {
			signal: controller.signal,
		});
		clearTimeout(timeout);

		if (res.ok) {
			const data = await res.json();
			const liveModels = Array.isArray(data?.data) ? data.data : [];
			if (liveModels.length > 0) {
				if (!existsSync(cacheDir)) {
					mkdirSync(cacheDir, { recursive: true });
				}
				writeFileSync(
					cacheFile,
					JSON.stringify(
						{
							timestamp: now,
							models: liveModels,
						},
						null,
						2,
					),
					"utf8",
				);
				return liveModels;
			}
		}
	} catch {
		// fallback to stale cache on network failure
	}

	if (cachedData && Array.isArray(cachedData.models)) {
		return cachedData.models;
	}
	return [];
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
			.filter((id) => typeof id === "string"),
	);

	const healthyIds = getHealthyModelIds();
	const useFilter = healthyIds.size > 0;

	for (const item of models) {
		const rawId = item.id;
		if (!rawId || isNonChatModel(rawId)) continue;
		if (declaredIds.has(rawId)) continue;
		if (useFilter && !healthyIds.has(rawId)) continue;

		const shortAlias = rawId.split("/").pop() || rawId;
		const modelKey = entry.models[shortAlias] ? rawId : shortAlias;

		if (entry.models[modelKey]) continue;

		const reasoning = isReasoningModel(rawId);
		const context = estimateContextWindow(rawId);
		const formattedName = formatModelName(rawId);

		entry.models[modelKey] = {
			name: formattedName,
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
					.filter((id) => typeof id === "string"),
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
				const formattedName = formatModelName(rawId);

				entry.models[modelKey] = {
					name: formattedName,
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

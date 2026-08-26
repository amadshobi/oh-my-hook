/**
 * omp/extension.ts — Generic Dynamic Models & Auth Loader for Oh-My-Pi (OMP).
 *
 * Automatically parses ~/.omp/agent/models.yml and dynamically registers ALL
 * custom providers, baseUrls, API keys, and models into OMP runtime via `pi.registerProvider()`.
 * Zero hardcoding — any provider added to models.yml becomes instantly available in OMP!
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_MODELS_YML = path.join(os.homedir(), ".omp", "agent", "models.yml");

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

function isReasoningModel(modelId: string): boolean {
	return REASONING_PATTERNS.some((pattern) => pattern.test(modelId));
}

function estimateContextWindow(modelId: string): number {
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

interface ParsedProvider {
	name: string;
	baseUrl: string;
	api: any;
	apiKey: string;
	models: { id: string }[];
}

function parseModelsYaml(content: string): Record<string, ParsedProvider> {
	const providers: Record<string, ParsedProvider> = {};
	const lines = content.split("\n");

	let currentProviderId: string | null = null;
	let currentProvider: ParsedProvider | null = null;
	let inModels = false;

	for (const line of lines) {
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

export default async function (pi: any) {
	if (!existsSync(DEFAULT_MODELS_YML)) return;

	try {
		const content = readFileSync(DEFAULT_MODELS_YML, "utf8");
		const providers = parseModelsYaml(content);

		for (const [providerId, p] of Object.entries(providers)) {
			if (!p.baseUrl || p.models.length === 0) continue;

			pi.registerProvider(providerId, {
				baseUrl: p.baseUrl,
				apiKey: p.apiKey,
				api: p.api || "openai-completions",
				models: p.models.map((m) => {
					const shortName = m.id.split("/").pop() || m.id;
					const reasoning = isReasoningModel(m.id);
					const contextWindow = estimateContextWindow(m.id);

					return {
						id: m.id,
						name: shortName,
						api: p.api || "openai-completions",
						reasoning,
						input: ["text", "image"],
						contextWindow,
						maxTokens: 16000,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					};
				}),
			});
		}
	} catch (e) {
		// Silent fail if parsing fails to avoid interrupting OMP startup
	}
}

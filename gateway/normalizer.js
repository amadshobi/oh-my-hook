/**
 * gateway/normalizer.js — Model Name Formatter, Capabilities & Metadata Normalizer
 */

import { generateModelVariants, lookupOmpModel } from "./variants.js";

const CTX_1M = 1000000;
const CTX_500K = 500000;
const CTX_256K = 256000;
const CTX_128K = 128000;

/**
 * Format model display name for OpenCode TUI cleanly and dynamically.
 *
 * @param {string} rawId
 * @param {string} [catalogName]
 * @returns {string}
 */
export function formatModelDisplayName(rawId, catalogName) {
	const parts = rawId.split("/");
	let provider = "gateway";
	let modelPart = rawId;

	if (parts.length > 1) {
		provider = parts[0].toLowerCase();
		modelPart = parts[parts.length - 1];
	}

	if (catalogName && typeof catalogName === "string" && catalogName.trim()) {
		return `${catalogName.trim()} (${provider})`;
	}

	// Clean up model name fallback
	let name = modelPart
		.replace(/[-_]/g, " ")
		.replace(/\b(\w)/g, (c) => c.toUpperCase());

	// Preserve specific brand capitalizations
	name = name
		.replace(/\bGpt\b/gi, "GPT")
		.replace(/\bClaude\b/gi, "Claude")
		.replace(/\bGemini\b/gi, "Gemini")
		.replace(/\bDeepseek\b/gi, "DeepSeek")
		.replace(/\bQwen\b/gi, "Qwen")
		.replace(/\bQwq\b/gi, "QwQ")
		.replace(/\bKimi\b/gi, "Kimi")
		.replace(/\bGlm\b/gi, "GLM")
		.replace(/\bMistral\b/gi, "Mistral")
		.replace(/\bCodestral\b/gi, "Codestral")
		.replace(/\bMinimax\b/gi, "MiniMax")
		.replace(/\bGrok\b/gi, "Grok")
		.replace(/\bLlama\b/gi, "Llama")
		.replace(/\bNemotron\b/gi, "Nemotron")
		.replace(/\bErnie\b/gi, "Ernie")
		.replace(/\bSolar\b/gi, "Solar")
		.replace(/\bPhi\b/gi, "Phi");

	return `${name} (${provider})`;
}

/**
 * Heuristic check if model supports reasoning / extended thinking.
 */
export function isReasoningModel(rawId) {
	const lower = rawId.toLowerCase();
	return (
		lower.includes("r1") ||
		lower.includes("o1") ||
		lower.includes("o3") ||
		lower.includes("o4") ||
		lower.includes("qwq") ||
		lower.includes("reason") ||
		lower.includes("thinking") ||
		lower.includes("tiered") ||
		lower.includes("deepseek-v4") ||
		lower.includes("claude-sonnet-4") ||
		lower.includes("claude-sonnet-5") ||
		lower.includes("claude-opus-4") ||
		lower.includes("claude-opus-5") ||
		lower.includes("claude-haiku-4") ||
		lower.includes("claude-fable") ||
		lower.includes("claude-3.7") ||
		lower.includes("gemini-3") ||
		lower.includes("gpt-5") ||
		lower.includes("grok-3") ||
		lower.includes("grok-4") ||
		lower.includes("kimi-k3") ||
		lower.includes("minimax-m3") ||
		lower.includes("glm-5") ||
		lower.includes("qwen3.8")
	);
}

/**
 * Context window size estimator based on known model family architectures.
 */
export function estimateContextWindow(rawId) {
	const lower = rawId.toLowerCase();
	if (lower.includes("gpt-5") || lower.includes("gpt-4.1")) return CTX_1M;
	if (lower.includes("gemini")) return CTX_1M;
	if (lower.includes("claude")) return CTX_1M;
	if (lower.includes("deepseek")) return CTX_500K;
	if (lower.includes("qwen") || lower.includes("minimax")) return CTX_256K;
	if (lower.includes("kimi") || lower.includes("moonshot")) return CTX_256K;
	if (lower.includes("ox-alpha")) return CTX_1M;
	return CTX_128K;
}

/**
 * Normalize raw model array from gateway into OpenCode Provider Models Map.
 * Enriches metadata (cost, contextWindow, thinking efforts) from OMP catalog.
 */
export function normalizeGatewayModels(
	rawModels,
	baseUrl = "http://127.0.0.1:4010/v1",
	providerId = "local-gateway",
) {
	const normalized = {};

	for (const m of rawModels) {
		if (!m.id || typeof m.id !== "string") continue;
		const rawId = m.id;

		// Filter out non-chat / embedding / moderation models
		const lower = rawId.toLowerCase();
		if (
			lower.includes("embedding") ||
			lower.includes("moderation") ||
			lower.includes("tts") ||
			lower.includes("whisper") ||
			lower.includes("dall-e") ||
			lower.includes("flux")
		) {
			continue;
		}

		// Preserve full upstream model ID as key to prevent provider namespace collisions
		const modelKey = rawId;

		// 1. Authoritative lookup from OMP catalog database
		const catalogModel = lookupOmpModel(rawId);

		// Pricing from OMP catalog
		const cost = catalogModel?.cost
			? {
					input: catalogModel.cost.input ?? 0,
					output: catalogModel.cost.output ?? 0,
					cache_read: catalogModel.cost.cacheRead ?? 0,
					cache_write: catalogModel.cost.cacheWrite ?? 0,
				}
			: {
					input: 0,
					output: 0,
					cache_read: 0,
					cache_write: 0,
				};

		// Reasoning & Context intelligence
		const reasoning =
			catalogModel?.reasoning !== undefined
				? Boolean(catalogModel.reasoning)
				: isReasoningModel(rawId);

		const context = catalogModel?.contextWindow || estimateContextWindow(rawId);
		const maxOutput = catalogModel?.maxTokens || 16000;

		const displayName = formatModelDisplayName(rawId, catalogModel?.name);
		const variants = generateModelVariants(rawId);

		normalized[modelKey] = {
			id: rawId,
			providerID: providerId,
			name: displayName,
			family: "",
			status: "active",
			api: {
				id: rawId,
				url: baseUrl,
				npm: "@ai-sdk/openai-compatible",
			},
			capabilities: {
				temperature: !(lower.includes("o1") || lower.includes("o3")),
				reasoning,
				attachment: false,
				toolcall: true,
				input: {
					text: true,
					audio: false,
					image: false,
					video: false,
					pdf: false,
				},
				output: {
					text: true,
					audio: false,
					image: false,
					video: false,
					pdf: false,
				},
				interleaved: reasoning
					? lower.includes("deepseek")
						? { field: "reasoning_content" }
						: true
					: false,
			},
			cost,
			limit: {
				context,
				output: maxOutput,
			},
			options: {},
			headers: {},
			release_date: "",
			variants,
		};
	}

	return normalized;
}

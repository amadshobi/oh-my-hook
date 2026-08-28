/**
 * gateway/index.js — Master OpenCode Local Gateway Plugin
 *
 * Implements:
 * 1. `auth`: Interactive login for port/target, custom name, and optional API key.
 * 2. `config`: Dynamic provider registration and model ingestion into OpenCode config database.
 * 3. `provider.models`: Dynamic discovery of models from Local Gateway (:4010 / :4000).
 * 4. Antigravity CCA schema sanitization guard.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fetchGatewayModels } from "./discovery.js";
import { normalizeSchemaForCCA } from "./antigravity.js";

const PROVIDER_ID = "local-gateway";
const DEFAULT_GATEWAY_PORT = "4010";
const DEFAULT_GATEWAY_URL = `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/v1`;

// Keyless local gateway: auth.json may hold a real key after `opencode auth login -p local-gateway`;
// otherwise send a benign placeholder (the local gateway ignores it).
const DUMMY_GATEWAY_KEY = "dummy";

const ALLOWED_LOOPBACK_HOSTS = new Set([
	"127.0.0.1",
	"localhost",
	"::1",
	"[::1]",
]);

/**
 * Normalize port or url input into full valid baseURL with loopback security guard.
 *
 * @param {string} [input]
 * @returns {string}
 */
export function resolveGatewayUrl(input) {
	if (!input || !input.trim()) return DEFAULT_GATEWAY_URL;
	const trimmed = input.trim();

	// If input is just a port number (e.g. 4010, 4000, 8080)
	if (/^\d+$/.test(trimmed)) {
		return `http://127.0.0.1:${trimmed}/v1`;
	}

	// If input is full URL, ensure /v1 suffix if not present
	const noSlash = trimmed.replace(/\/+$/, "");
	const fullUrl = noSlash.endsWith("/v1") ? noSlash : `${noSlash}/v1`;

	try {
		const u = new URL(fullUrl);
		if (!ALLOWED_LOOPBACK_HOSTS.has(u.hostname)) {
			// Fallback to loopback default if external host is attempted
			return DEFAULT_GATEWAY_URL;
		}
	} catch {
		return DEFAULT_GATEWAY_URL;
	}

	return fullUrl;
}

/**
 * Read stored authentication credentials directly for early config() hook initialization
 *
 * @returns {{ name?: string; target?: string; apiKey?: string }}
 */
export function getStoredAuth() {
	try {
		const dataDir =
			process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
		const authFile = join(dataDir, "opencode", "auth.json");
		if (existsSync(authFile)) {
			const data = JSON.parse(readFileSync(authFile, "utf8"));
			const local = data[PROVIDER_ID];
			if (local && local.type === "api") {
				return {
					name: local.metadata?.name,
					target: local.metadata?.target,
					apiKey: local.key,
				};
			}
		}
	} catch {
		// ignore disk read error
	}
	return {};
}

/**
 * OpenCode Plugin Factory for Local AI Gateway integration
 *
 * @param {any} [_input]
 * @param {{ config?: any }} [opts]
 * @returns {any}
 */
export function gatewayHooks(_input, opts = {}) {
	const gwConfig = opts.config?.gateway ?? {};
	if (gwConfig.enabled === false) {
		return {};
	}

	return {
		config: async (cfg) => {
			const auth = getStoredAuth();
			const target =
				auth.target || process.env.OPENCODE_GATEWAY_URL || DEFAULT_GATEWAY_PORT;
			const apiKey = auth.apiKey || DUMMY_GATEWAY_KEY;
			const customProviderName = auth.name || "gn gateway";
			const resolvedUrl = resolveGatewayUrl(target);

			const discovered = await fetchGatewayModels(
				resolvedUrl,
				apiKey,
				PROVIDER_ID,
			);

			const modelsMap = {};
			for (const [key, m] of Object.entries(discovered)) {
				modelsMap[key] = {
					id: m.id,
					name: m.name,
					tool_call: m.capabilities.toolcall,
					reasoning: m.capabilities.reasoning,
					temperature: m.capabilities.temperature,
					interleaved:
						typeof m.capabilities.interleaved === "object" &&
						m.capabilities.interleaved !== null
							? m.capabilities.interleaved.field
							: m.capabilities.interleaved,
					limit: m.limit,
					cost: m.cost,
					variants: m.variants,
				};
			}

			if (!cfg.provider) cfg.provider = {};
			cfg.provider[PROVIDER_ID] = {
				name: customProviderName,
				npm: "@ai-sdk/openai-compatible",
				api: resolvedUrl,
				options: {
					baseURL: resolvedUrl,
					apiKey: apiKey,
				},
				models: modelsMap,
			};
		},

		auth: {
			provider: PROVIDER_ID,
			methods: [
				{
					type: "api",
					label: "Local AI Gateway (Port / URL & Name)",
					prompts: [
						{
							type: "text",
							key: "name",
							message: "Gateway Name / Provider Label (Kolom Kanan TUI)",
							placeholder: "e.g. omp gateway / gn gateway",
						},
						{
							type: "text",
							key: "target",
							message:
								"Port or Base URL (e.g. 4010, 4000, or http://127.0.0.1:4010/v1)",
							placeholder: "4010",
						},
					],
				},
			],
		},

		provider: {
			id: PROVIDER_ID,
			async models(_provider, ctx) {
				// Read auth configuration saved during `opencode auth login -p local-gateway`
				const auth = ctx.auth?.type === "api" ? ctx.auth : undefined;
				const metadata = auth?.metadata ?? {};
				const target =
					metadata.target ||
					process.env.OPENCODE_GATEWAY_URL ||
					DEFAULT_GATEWAY_PORT;
				const apiKey = auth?.key || DUMMY_GATEWAY_KEY;

				const resolvedUrl = resolveGatewayUrl(target);

				// Fetch dynamic models from local gateway (no-op provider mutation removed)
				return fetchGatewayModels(resolvedUrl, apiKey, PROVIDER_ID);
			},
		},

		// Antigravity CCA JSON Schema Normalizer (Anti-Malformed Guard)
		// Intercepts tool parameters schema before it gets sent to Google Cloud Code Assist
		"tool.definition": async (_input, output) => {
			if (output?.parameters) {
				output.parameters = normalizeSchemaForCCA(output.parameters);
			}
			if (output?.jsonSchema) {
				output.jsonSchema = normalizeSchemaForCCA(output.jsonSchema);
			}
		},
	};
}

export async function LocalGatewayPlugin(_input) {
	return gatewayHooks(_input);
}

export default {
	id: PROVIDER_ID,
	server: LocalGatewayPlugin,
};

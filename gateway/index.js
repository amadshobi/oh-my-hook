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
const VANS_PROVIDER_ID = "vans-gateway";

const DEFAULT_GATEWAY_PORT = "4010";
const DEFAULT_GATEWAY_URL = `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/v1`;

const DEFAULT_VANS_PORT = "20128";
const DEFAULT_VANS_URL = `http://127.0.0.1:${DEFAULT_VANS_PORT}/v1`;

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
 * @param {string} [defaultUrl=DEFAULT_GATEWAY_URL]
 * @returns {string}
 */
export function resolveGatewayUrl(input, defaultUrl = DEFAULT_GATEWAY_URL) {
	if (!input || !input.trim()) return defaultUrl;
	const trimmed = input.trim();

	// If input is just a port number (e.g. 4010, 4000, 20128, 8080)
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
			return defaultUrl;
		}
	} catch {
		return defaultUrl;
	}

	return fullUrl;
}

/**
 * Read stored authentication credentials directly for early config() hook initialization
 *
 * @param {string} [providerId=PROVIDER_ID]
 * @returns {{ name?: string; target?: string; apiKey?: string }}
 */
export function getStoredAuth(providerId = PROVIDER_ID) {
	try {
		const dataDir =
			process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
		const authFile = join(dataDir, "opencode", "auth.json");
		if (existsSync(authFile)) {
			const data = JSON.parse(readFileSync(authFile, "utf8"));
			const entry = data[providerId];
			if (entry && entry.type === "api") {
				return {
					name: entry.metadata?.name,
					target: entry.metadata?.target,
					apiKey: entry.key,
				};
			}
		}
	} catch {
		// ignore disk read error
	}
	return {};
}

function buildModelsMap(discovered) {
	const map = {};
	for (const [key, m] of Object.entries(discovered)) {
		map[key] = {
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
	return map;
}

/**
 * OpenCode Plugin Factory for Local AI Gateway integration
 * Supports Dual-Provider setup: `local-gateway` (OMP) and `vans-gateway` (VansRouter)
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
		// OpenCode plugin config hook contract: OpenCode passes the mutable global
		// config object for plugins to register their custom AI provider definitions.
		config: async (cfg) => {
			if (!cfg.provider) cfg.provider = {};

			// ── 1. Register Local Gateway (OMP / GN Gateway) ────────────────
			const localAuth = getStoredAuth(PROVIDER_ID);
			const localTarget =
				localAuth.target ||
				process.env.OPENCODE_GATEWAY_URL ||
				DEFAULT_GATEWAY_PORT;
			const localApiKey = localAuth.apiKey || DUMMY_GATEWAY_KEY;
			const localName = localAuth.name || "gn gateway";
			const localUrl = resolveGatewayUrl(localTarget, DEFAULT_GATEWAY_URL);

			const localDiscovered = await fetchGatewayModels(
				localUrl,
				localApiKey,
				PROVIDER_ID,
			);

			const localModelsMap = buildModelsMap(localDiscovered);

			cfg.provider[PROVIDER_ID] = {
				name: localName,
				npm: "@ai-sdk/openai-compatible",
				api: localUrl,
				options: {
					baseURL: localUrl,
					apiKey: localApiKey,
				},
				models: localModelsMap,
			};

			// ── 2. Register Vans Gateway (VansRouter) ───────────────────────
			const vansAuth = getStoredAuth(VANS_PROVIDER_ID);
			const vansTarget =
				vansAuth.target ||
				process.env.OPENCODE_VANS_GATEWAY_URL ||
				DEFAULT_VANS_PORT;
			const vansApiKey = vansAuth.apiKey || DUMMY_GATEWAY_KEY;
			const vansName = vansAuth.name || "vans router";
			const vansUrl = resolveGatewayUrl(vansTarget, DEFAULT_VANS_URL);

			const vansDiscovered = await fetchGatewayModels(
				vansUrl,
				vansApiKey,
				VANS_PROVIDER_ID,
			);

			const vansModelsMap = buildModelsMap(vansDiscovered);

			cfg.provider[VANS_PROVIDER_ID] = {
				name: vansName,
				npm: "@ai-sdk/openai-compatible",
				api: vansUrl,
				options: {
					baseURL: vansUrl,
					apiKey: vansApiKey,
				},
				models: vansModelsMap,
			};
		},

		auth: {
			provider: PROVIDER_ID,
			methods: [
				{
					type: "api",
					label: "GN Gateway / OMP (Port / URL & Name)",
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
					async authorize(inputs) {
						return {
							type: "success",
							provider: PROVIDER_ID,
							key: inputs.key || DUMMY_GATEWAY_KEY,
							metadata: {
								name: inputs.name || "gn gateway",
								target: inputs.target || DEFAULT_GATEWAY_PORT,
							},
						};
					},
				},
				{
					type: "api",
					label: "VansRouter Gateway (Port / URL & Name)",
					prompts: [
						{
							type: "text",
							key: "name",
							message: "VansRouter Name / Provider Label (Kolom Kanan TUI)",
							placeholder: "e.g. vans router",
						},
						{
							type: "text",
							key: "target",
							message:
								"Port or Base URL (e.g. 20128, or http://127.0.0.1:20128/v1)",
							placeholder: "20128",
						},
					],
					async authorize(inputs) {
						return {
							type: "success",
							provider: VANS_PROVIDER_ID,
							key: inputs.key || DUMMY_GATEWAY_KEY,
							metadata: {
								name: inputs.name || "vans router",
								target: inputs.target || DEFAULT_VANS_PORT,
							},
						};
					},
				},
			],
		},

		provider: {
			id: PROVIDER_ID,
			async models(provider, ctx) {
				const providerId = provider?.id || PROVIDER_ID;
				const isVans = providerId === VANS_PROVIDER_ID;
				const auth = ctx.auth?.type === "api" ? ctx.auth : undefined;
				const metadata = auth?.metadata ?? {};
				const defaultPort = isVans ? DEFAULT_VANS_PORT : DEFAULT_GATEWAY_PORT;
				const defaultUrl = isVans ? DEFAULT_VANS_URL : DEFAULT_GATEWAY_URL;
				const envUrl = isVans
					? process.env.OPENCODE_VANS_GATEWAY_URL
					: process.env.OPENCODE_GATEWAY_URL;

				const target = metadata.target || envUrl || defaultPort;
				const apiKey = auth?.key || DUMMY_GATEWAY_KEY;
				const resolvedUrl = resolveGatewayUrl(target, defaultUrl);

				return fetchGatewayModels(resolvedUrl, apiKey, providerId);
			},
		},

		// Antigravity CCA JSON Schema Normalizer (Anti-Malformed Guard)
		// OpenCode tool.definition contract: output is an in-flight tool schema container;
		// normalizeSchemaForCCA produces immutable sanitized copies of parameters and jsonSchema.
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

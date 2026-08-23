/**
 * omp/gateway-proxy.ts — Unified OMP Gateway Proxy & models.yml Aggregator.
 *
 * Runs on port 4000.
 * Aggregates:
 * 1. Curated models from ~/.omp/agent/models.yml (Kilo, OpenCode Zen, OpenRouter, Charm Hyper, etc.)
 * 2. OAuth & Broker models from internal OMP Auth-Gateway (port 4002)
 *
 * Exposes standard OpenAI API:
 *   - GET  /v1/models
 *   - POST /v1/chat/completions
 *   - GET  /healthz
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const MODELS_YML_PATH = path.join(os.homedir(), ".omp", "agent", "models.yml");
const INTERNAL_GATEWAY_URL = process.env.OMP_INTERNAL_GATEWAY_URL || "http://127.0.0.1:4002";
const PROXY_PORT = parseInt(process.env.OMP_GATEWAY_PORT || "4000", 10);

interface CustomProvider {
	name: string;
	baseUrl: string;
	apiKey: string;
	api: string;
	models: { id: string }[];
}

function parseModelsYaml(): Record<string, CustomProvider> {
	if (!existsSync(MODELS_YML_PATH)) return {};
	try {
		const content = readFileSync(MODELS_YML_PATH, "utf8");
		const providers: Record<string, CustomProvider> = {};
		const lines = content.split("\n");

		let currentProviderId: string | null = null;
		let currentProvider: CustomProvider | null = null;
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
	} catch {
		return {};
	}
}

function resolveApiKey(keyOrEnv: string): string {
	if (!keyOrEnv) return "";
	if (process.env[keyOrEnv]) return process.env[keyOrEnv] || "";
	return keyOrEnv;
}

const server = Bun.serve({
	port: PROXY_PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const pathname = url.pathname;

		// CORS preflight
		if (req.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "*",
				},
			});
		}

		// 1. Healthcheck
		if (pathname === "/healthz" || pathname === "/status") {
			return Response.json({ status: "ok", gateway: "unified-omp-proxy" });
		}

		const customProviders = parseModelsYaml();

		// 2. GET /v1/models
		if (req.method === "GET" && pathname === "/v1/models") {
			let internalModels: any[] = [];
			try {
				const res = await fetch(`${INTERNAL_GATEWAY_URL}/v1/models`, {
					signal: AbortSignal.timeout(1500),
				});
				if (res.ok) {
					const json: any = await res.json();
					internalModels = json.data || [];
				}
			} catch {}

			// Add custom models from models.yml
			const customModels: any[] = [];
			for (const [providerId, p] of Object.entries(customProviders)) {
				for (const m of p.models) {
					customModels.push({
						id: `${providerId}/${m.id}`,
						object: "model",
						created: Math.floor(Date.now() / 1000),
						owned_by: providerId,
						permission: [],
						root: m.id,
						parent: null,
					});
					// Also expose bare id if unique
					customModels.push({
						id: m.id,
						object: "model",
						created: Math.floor(Date.now() / 1000),
						owned_by: providerId,
						permission: [],
						root: m.id,
						parent: null,
					});
				}
			}

			// Deduplicate models
			const seen = new Set<string>();
			const allModels: any[] = [];
			for (const m of [...customModels, ...internalModels]) {
				if (!seen.has(m.id)) {
					seen.add(m.id);
					allModels.push(m);
				}
			}

			return Response.json({ object: "list", data: allModels }, {
				headers: { "Access-Control-Allow-Origin": "*" },
			});
		}

		// 3. POST /v1/chat/completions
		if (req.method === "POST" && pathname === "/v1/chat/completions") {
			try {
				const bodyText = await req.text();
				const payload = JSON.parse(bodyText);
				const requestedModel = payload.model || "";

				// Check if model belongs to custom models.yml
				let matchedProvider: CustomProvider | null = null;
				let targetModelId = requestedModel;

				for (const [providerId, p] of Object.entries(customProviders)) {
					if (requestedModel.startsWith(`${providerId}/`)) {
						matchedProvider = p;
						targetModelId = requestedModel.slice(providerId.length + 1);
						break;
					}
					const hasModel = p.models.some((m) => m.id === requestedModel);
					if (hasModel) {
						matchedProvider = p;
						targetModelId = requestedModel;
						break;
					}
				}

				if (matchedProvider && matchedProvider.baseUrl) {
					// Route to custom provider (Kilo, OpenCode Zen, OpenRouter, Charm Hyper)
					const targetBaseUrl = matchedProvider.baseUrl.replace(/\/+$/, "");
					const targetApiKey = resolveApiKey(matchedProvider.apiKey);
					payload.model = targetModelId;

					const upstreamRes = await fetch(`${targetBaseUrl}/chat/completions`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${targetApiKey}`,
						},
						body: JSON.stringify(payload),
					});

					const responseHeaders = new Headers(upstreamRes.headers);
					responseHeaders.set("Access-Control-Allow-Origin", "*");

					return new Response(upstreamRes.body, {
						status: upstreamRes.status,
						headers: responseHeaders,
					});
				}

				// Fallback to internal OMP Auth-Gateway (port 4002) for Antigravity & Ollama
				const upstreamRes = await fetch(`${INTERNAL_GATEWAY_URL}/v1/chat/completions`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": req.headers.get("Authorization") || "Bearer dummy",
					},
					body: bodyText,
				});

				const responseHeaders = new Headers(upstreamRes.headers);
				responseHeaders.set("Access-Control-Allow-Origin", "*");

				return new Response(upstreamRes.body, {
					status: upstreamRes.status,
					headers: responseHeaders,
				});
			} catch (e: any) {
				return Response.json(
					{ error: { message: `Unified Gateway Proxy Error: ${e.message}`, type: "gateway_proxy_error" } },
					{ status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
				);
			}
		}

		// Fallback proxy for all other endpoints
		return fetch(`${INTERNAL_GATEWAY_URL}${pathname}${url.search}`, {
			method: req.method,
			headers: req.headers,
			body: req.body,
		});
	},
});

console.log(`Unified OMP Gateway Proxy running on http://127.0.0.1:${PROXY_PORT}`);
console.log(`Routing: models.yml (Curated Providers) + OMP Auth-Gateway (${INTERNAL_GATEWAY_URL})`);

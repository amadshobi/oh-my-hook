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
import { randomUUID } from "node:crypto";

const MODELS_YML_PATH = path.join(os.homedir(), ".omp", "agent", "models.yml");
const COMMANDCODE_MODELS_PATH = path.join(
	os.homedir(),
	".omp",
	"agent",
	"commandcode-models.json",
);
const INTERNAL_GATEWAY_URL =
	process.env.OMP_INTERNAL_GATEWAY_URL || "http://127.0.0.1:4002";
const PROXY_PORT = parseInt(process.env.OMP_GATEWAY_PORT || "4000", 10);

interface CustomProvider {
	name: string;
	baseUrl: string;
	apiKey: string;
	api: string;
	models: { id: string }[];
}

function getCommandCodeApiKey(): string {
	if (process.env.COMMANDCODE_API_KEY) return process.env.COMMANDCODE_API_KEY;
	const p1 = path.join(os.homedir(), ".commandcode", "auth.json");
	if (existsSync(p1)) {
		try {
			const data = JSON.parse(readFileSync(p1, "utf8"));
			if (data.apiKey) return data.apiKey;
		} catch {}
	}
	const p2 = path.join(os.homedir(), ".omp", "agent", "auth.json");
	if (existsSync(p2)) {
		try {
			const data = JSON.parse(readFileSync(p2, "utf8"));
			const key =
				data["command-code"]?.key ||
				data.commandcode?.key ||
				data.commandcode?.access;
			if (key) return key;
		} catch {}
	}
	return "";
}

function loadCommandCodeModels(): any[] {
	if (!existsSync(COMMANDCODE_MODELS_PATH)) return [];
	try {
		const raw = readFileSync(COMMANDCODE_MODELS_PATH, "utf8");
		const data = JSON.parse(raw);
		const list = Array.isArray(data) ? data : data.models || [];
		return list.map((m: any) => ({
			id: `commandcode/${m.id}`,
			object: "model",
			created: Math.floor(Date.now() / 1000),
			owned_by: "commandcode",
			permission: [],
			root: m.id,
			parent: null,
		}));
	} catch {
		return [];
	}
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

			// Add Command Code models
			const ccModels = loadCommandCodeModels();

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
			for (const m of [...customModels, ...ccModels, ...internalModels]) {
				if (!seen.has(m.id)) {
					seen.add(m.id);
					allModels.push(m);
				}
			}

			return Response.json(
				{ object: "list", data: allModels },
				{
					headers: { "Access-Control-Allow-Origin": "*" },
				},
			);
		}

		// 3. POST /v1/chat/completions
		if (req.method === "POST" && pathname === "/v1/chat/completions") {
			try {
				const bodyText = await req.text();
				const payload = JSON.parse(bodyText);
				const requestedModel = payload.model || "";

				// A. Handle Command Code Provider
				if (requestedModel.startsWith("commandcode/")) {
					const targetModelId = requestedModel.slice(12);
					const ccApiKey = getCommandCodeApiKey();
					if (!ccApiKey) {
						return Response.json(
							{
								error: {
									message: "Missing Command Code API Key",
									type: "authentication_error",
								},
							},
							{ status: 401, headers: { "Access-Control-Allow-Origin": "*" } },
						);
					}

					const systemMessage = payload.messages?.find(
						(m: any) => m.role === "system",
					);
					const conversationMessages =
						payload.messages?.filter((m: any) => m.role !== "system") || [];

					const ccPayload = {
						config: {
							workingDir: os.homedir(),
							date: new Date().toISOString().split("T")[0],
							environment: `${process.platform}-${process.arch}, Node.js ${process.version}`,
							structure: [],
							isGitRepo: false,
							currentBranch: "main",
							mainBranch: "main",
							gitStatus: "",
							recentCommits: [],
						},
						memory: "",
						taste: "",
						skills: "",
						params: {
							model: targetModelId,
							messages: conversationMessages.map((m: any) => ({
								role: m.role,
								content:
									typeof m.content === "string"
										? m.content
										: JSON.stringify(m.content),
							})),
							tools: payload.tools || [],
							system:
								typeof systemMessage?.content === "string"
									? systemMessage.content
									: "",
							max_tokens: payload.max_tokens || 4096,
							temperature: payload.temperature ?? 0.3,
							stream: true,
						},
						threadId: randomUUID(),
					};

					const upstreamRes = await fetch(
						"https://api.commandcode.ai/alpha/generate",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${ccApiKey}`,
								"x-command-code-version": "1.15.1",
								"x-cli-environment": "production",
								"x-project-slug": "civil-projects",
								"x-taste-learning": "true",
								"x-co-flag": "false",
							},
							body: JSON.stringify(ccPayload),
						},
					);

					if (!upstreamRes.ok) {
						const errText = await upstreamRes.text();
						return new Response(errText, {
							status: upstreamRes.status,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						});
					}

					// Non-streaming response
					if (!payload.stream) {
						const streamText = await upstreamRes.text();
						let fullContent = "";
						let reasoningText = "";
						let finishReason = "stop";

						for (const line of streamText.split("\n")) {
							const trimmed = line.trim();
							if (!trimmed) continue;
							try {
								const evt = JSON.parse(trimmed);
								if (evt.type === "text-delta" && evt.text)
									fullContent += evt.text;
								if (evt.type === "reasoning-delta" && evt.text)
									reasoningText += evt.text;
								if (evt.type === "finish" || evt.type === "finish-step") {
									finishReason = evt.finishReason || "stop";
								}
							} catch {}
						}

						const completionId = `chatcmpl-${randomUUID()}`;
						return Response.json(
							{
								id: completionId,
								object: "chat.completion",
								created: Math.floor(Date.now() / 1000),
								model: targetModelId,
								choices: [
									{
										index: 0,
										message: {
											role: "assistant",
											content: fullContent,
											...(reasoningText ? { reasoning: reasoningText } : {}),
										},
										finish_reason: finishReason,
									},
								],
								usage: {
									prompt_tokens: 0,
									completion_tokens: fullContent.length,
									total_tokens: fullContent.length,
								},
							},
							{
								headers: { "Access-Control-Allow-Origin": "*" },
							},
						);
					}

					// Streaming response (SSE)
					const reader = upstreamRes.body?.getReader();
					if (!reader) {
						return Response.json(
							{ error: { message: "No response body" } },
							{ status: 500 },
						);
					}

					const completionId = `chatcmpl-${randomUUID()}`;
					const encoder = new TextEncoder();
					const decoder = new TextDecoder();

					const stream = new ReadableStream({
						async start(controller) {
							let buffer = "";
							try {
								while (true) {
									const { done, value } = await reader.read();
									if (done) break;

									buffer += decoder.decode(value, { stream: true });
									const lines = buffer.split("\n");
									buffer = lines.pop() ?? "";

									for (const line of lines) {
										const trimmed = line.trim();
										if (!trimmed) continue;
										try {
											const evt = JSON.parse(trimmed);
											if (evt.type === "text-delta" && evt.text) {
												const chunk = {
													id: completionId,
													object: "chat.completion.chunk",
													created: Math.floor(Date.now() / 1000),
													model: targetModelId,
													choices: [
														{
															index: 0,
															delta: { content: evt.text },
															finish_reason: null,
														},
													],
												};
												controller.enqueue(
													encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
												);
											}
											if (evt.type === "finish" || evt.type === "finish-step") {
												const chunk = {
													id: completionId,
													object: "chat.completion.chunk",
													created: Math.floor(Date.now() / 1000),
													model: targetModelId,
													choices: [
														{
															index: 0,
															delta: {},
															finish_reason: evt.finishReason || "stop",
														},
													],
												};
												controller.enqueue(
													encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
												);
											}
										} catch {}
									}
								}
								controller.enqueue(encoder.encode("data: [DONE]\n\n"));
								controller.close();
							} catch (err: any) {
								controller.error(err);
							}
						},
					});

					return new Response(stream, {
						headers: {
							"Content-Type": "text/event-stream",
							"Cache-Control": "no-cache",
							Connection: "keep-alive",
							"Access-Control-Allow-Origin": "*",
						},
					});
				}

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
							Authorization: `Bearer ${targetApiKey}`,
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
				const upstreamRes = await fetch(
					`${INTERNAL_GATEWAY_URL}/v1/chat/completions`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: req.headers.get("Authorization") || "Bearer dummy",
						},
						body: bodyText,
					},
				);

				const responseHeaders = new Headers(upstreamRes.headers);
				responseHeaders.set("Access-Control-Allow-Origin", "*");

				return new Response(upstreamRes.body, {
					status: upstreamRes.status,
					headers: responseHeaders,
				});
			} catch (e: any) {
				return Response.json(
					{
						error: {
							message: `Unified Gateway Proxy Error: ${e.message}`,
							type: "gateway_proxy_error",
						},
					},
					{ status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
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

console.log(
	`Unified OMP Gateway Proxy running on http://127.0.0.1:${PROXY_PORT}`,
);
console.log(
	`Routing: models.yml (Curated Providers) + OMP Auth-Gateway (${INTERNAL_GATEWAY_URL})`,
);

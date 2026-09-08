/**
 * memory/client.js — OpenAI-compatible Gateway client for memory reflection & distillation.
 *
 * Direct HTTP client using native Node.js fetch() with zero external dependencies.
 * Queries local/remote OpenAI-compatible gateways (e.g. OMP :4000, Local Gateway :4010, Ollama :11434, OpenRouter):
 *   - analyzeTurnReview: Evaluate a turn's conversation for new user preferences, global quirks, or repo rules.
 *   - distillTranscript: Distill session transcript into high-signal memory bullets for /memory capture.
 */

export const DEFAULT_GATEWAY_URL =
	process.env.OMH_MEMORY_GATEWAY || "http://127.0.0.1:4000/v1/chat/completions";
export const DEFAULT_MEMORY_MODEL =
	process.env.OMH_MEMORY_MODEL || "google-antigravity/gemini-2.5-flash";

/**
 * Execute chat completion query against OpenAI-compatible gateway.
 *
 * @param {object} params
 * @param {Array<{ role: string, content: string }>} params.messages
 * @param {string} [params.gatewayUrl]
 * @param {string} [params.model]
 * @param {string} [params.apiKey]
 * @param {number} [params.timeoutMs]
 * @returns {Promise<string>}
 */
export async function queryMemoryGateway({
	messages,
	gatewayUrl = DEFAULT_GATEWAY_URL,
	model = DEFAULT_MEMORY_MODEL,
	apiKey = process.env.OMP_API_KEY || process.env.OPENAI_API_KEY || "dummy",
	timeoutMs = 30000,
}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const targetUrl = gatewayUrl.endsWith("/chat/completions")
			? gatewayUrl
			: `${gatewayUrl.replace(/\/+$/, "")}/chat/completions`;

		const res = await fetch(targetUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages,
				temperature: 0.1,
			}),
			signal: controller.signal,
		});

		if (!res.ok) {
			const errText = await res.text().catch(() => "");
			throw new Error(
				`Gateway returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
			);
		}

		const data = await res.json();
		const text = data?.choices?.[0]?.message?.content;
		if (typeof text !== "string") {
			throw new Error("Invalid response format from memory gateway");
		}
		return text.trim();
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Parse JSON safely from markdown code blocks or plain text.
 */
function parseJsonSafe(text) {
	try {
		const trimmed = text.trim();
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
			return JSON.parse(trimmed);
		}
		const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (match && match[1]) {
			return JSON.parse(match[1].trim());
		}
		const start = trimmed.indexOf("{");
		const end = trimmed.lastIndexOf("}");
		if (start !== -1 && end !== -1 && end > start) {
			return JSON.parse(trimmed.slice(start, end + 1));
		}
	} catch {}
	return null;
}

/**
 * Evaluate conversation turns and extract memory operations (Hermes background reflection).
 *
 * @param {string} turnConversation Text excerpt of recent conversation.
 * @param {object} [opts]
 * @param {string} [opts.gatewayUrl]
 * @param {string} [opts.model]
 * @param {string} [opts.apiKey]
 * @param {string} [opts.projectSlug]
 * @returns {Promise<Array<{ action: string, target: string, content?: string, old_text?: string }>>}
 */
export async function analyzeTurnReview(turnConversation, opts = {}) {
	if (!turnConversation || !turnConversation.trim()) return [];

	const existingMemories = opts.existingMemories ? `\n\nALREADY STORED MEMORIES (DO NOT DUPLICATE THESE):\n${opts.existingMemories}\n` : "";

	const systemPrompt =
		`You are a Hermes-style memory reflection engine. Your job is to analyze the recent conversation ` +
		`between the user and AI assistant and determine if ANY new persistent facts should be stored or updated.\n\n` +
		`TARGETS:\n` +
		`1. "user": User persona, user preferences (e.g. "panggil saya BOSS", language preference, developer habits).\n` +
		`2. "global": Technical environment facts across repos (CLI quirks, global tool flags).\n` +
		`3. "project": Repository-specific rules, architecture decisions, test commands, conventions.\n\n` +
		`RULES:\n` +
		`- Be selective: only capture durable, high-signal rules, corrections, and explicit preferences.\n` +
		`- STRICTLY DO NOT repeat or duplicate facts already listed in "ALREADY STORED MEMORIES".\n` +
		`- DO NOT save temporary task progress, file contents, code diffs, or trivial discussion.\n` +
		`- Output STRICT JSON ONLY in the following format:\n` +
		`{\n` +
		`  "operations": [\n` +
		`    { "action": "add", "target": "user" | "global" | "project", "content": "..." },\n` +
		`    { "action": "replace", "target": "...", "old_text": "...", "content": "..." },\n` +
		`    { "action": "remove", "target": "...", "old_text": "..." }\n` +
		`  ]\n` +
		`}\n` +
		`If no new facts or corrections are found, return: { "operations": [] }`;

	const userMessage =
		`Project workspace: ${opts.projectSlug || "general"}${existingMemories}\n\n` +
		`RECENT CONVERSATION:\n${turnConversation.slice(-6000)}`;

	try {
		const raw = await queryMemoryGateway({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userMessage },
			],
			gatewayUrl: opts.gatewayUrl,
			model: opts.model,
			apiKey: opts.apiKey,
			timeoutMs: opts.timeoutMs || 25000,
		});

		const parsed = parseJsonSafe(raw);
		if (Array.isArray(parsed?.operations)) {
			return parsed.operations;
		}
	} catch (e) {
		// Non-fatal background review error
	}
	return [];
}

/**
 * Distill a full session transcript into bullet points for /memory capture.
 *
 * @param {string} transcript
 * @param {object} [opts]
 * @returns {Promise<string[]>}
 */
export async function distillTranscript(transcript, opts = {}) {
	if (!transcript || !transcript.trim()) return [];

	const systemPrompt =
		`You are an expert developer assistant. Distill the given session transcript into 3 to 5 ` +
		`high-signal memory bullet points (architectural choices, conventions, gotchas, user preferences).\n` +
		`OUTPUT FORMAT:\n` +
		`One concise bullet per line, starting with "- ".\n` +
		`Do not include conversational filler or temporary task details.`;

	const raw = await queryMemoryGateway({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: transcript.slice(0, 10000) },
		],
		gatewayUrl: opts.gatewayUrl,
		model: opts.model,
		apiKey: opts.apiKey,
		timeoutMs: opts.timeoutMs || 30000,
	});

	const bullets = raw
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.startsWith("- "))
		.map((l) => l.replace(/^-\s*/, "").trim())
		.filter(Boolean);

	const maxBullets = opts.maxBullets || 5;
	return bullets.slice(0, maxBullets);
}

/**
 * imgsee/client.js — Multimodal Vision Model HTTP Client.
 *
 * Dispatches one-shot vision requests to OpenAI-compatible endpoints
 * (e.g. Oh-My-Pi gateway on port 4000, OpenRouter, OpenAI, etc).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT_FILE = path.join(__dirname, "prompts", "vision-system.md");

export function loadVisionSystemPrompt() {
	try {
		if (existsSync(SYSTEM_PROMPT_FILE)) {
			return readFileSync(SYSTEM_PROMPT_FILE, "utf8").trim();
		}
	} catch {}
	return "You are an expert visual inspection engine. Analyze images accurately and concisely.";
}

/**
 * Send image to vision model and retrieve text analysis.
 *
 * @param {object} params
 * @param {Buffer} params.buffer
 * @param {string} params.mime
 * @param {string} params.question
 * @param {string} [params.gatewayUrl]
 * @param {string} [params.model]
 * @param {string} [params.apiKey]
 * @param {number} [params.timeoutMs]
 * @param {string} [params.mode]
 * @returns {Promise<{ content: string, model: string, durationMs: number }>}
 */
export async function analyzeImage({
	buffer,
	mime,
	question,
	gatewayUrl = "http://127.0.0.1:4000/v1/chat/completions",
	model = "google-antigravity/gemini-2.5-flash",
	apiKey = process.env.OMP_API_KEY || process.env.OPENAI_API_KEY || "dummy",
	timeoutMs = 60000,
	mode = "general",
}) {
	const startTime = Date.now();
	const base64 = buffer.toString("base64");
	const dataUrl = `data:${mime};base64,${base64}`;

	let userPrompt = question;
	if (mode === "ocr") {
		userPrompt = `Extract all visible text verbatim. Format as clean reading order bullets.\n\nAdditional instructions: ${question}`;
	} else if (mode === "layout") {
		userPrompt = `Analyze the UI layout, component hierarchy, alignments, and responsive structure.\n\nAdditional instructions: ${question}`;
	} else if (mode === "debug") {
		userPrompt = `Identify any errors, bugs, broken elements, or unexpected state in this screenshot. Provide diagnosis and root cause.\n\nAdditional instructions: ${question}`;
	}

	const systemPrompt = loadVisionSystemPrompt();

	const payload = {
		model,
		messages: [
			{
				role: "system",
				content: systemPrompt,
			},
			{
				role: "user",
				content: [
					{
						type: "text",
						text: userPrompt,
					},
					{
						type: "image_url",
						image_url: {
							url: dataUrl,
						},
					},
				],
			},
		],
	};

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(gatewayUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(payload),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!res.ok) {
			const errText = await res.text().catch(() => "");
			throw new Error(
				`Vision Gateway request failed with status ${res.status} (${res.statusText}): ${errText.slice(0, 300)}`,
			);
		}

		const data = await res.json();
		const message = data?.choices?.[0]?.message;
		const content =
			typeof message?.content === "string"
				? message.content.trim()
				: Array.isArray(message?.content)
					? message.content
							.map((c) => c.text || "")
							.join("\n")
							.trim()
					: "";

		if (!content) {
			throw new Error("Vision model returned an empty response.");
		}

		return {
			content,
			model: data?.model || model,
			durationMs: Date.now() - startTime,
		};
	} catch (err) {
		clearTimeout(timeoutId);
		if (err.name === "AbortError") {
			throw new Error(
				`Vision request timed out after ${Math.round(timeoutMs / 1000)}s.`,
			);
		}
		throw err;
	}
}

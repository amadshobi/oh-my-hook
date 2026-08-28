/**
 * imgsee/tool.js — Native OpenCode agent tool definition for Multimodal Vision.
 *
 * Exposes the `imgsee` tool to coding agents:
 *   - Inspects local image files, screenshots, UI mockups, and URLs
 *   - Delegates visual analysis to the local multimodal vision gateway (:4000)
 *   - Formats clean Markdown output with execution metadata
 */
import path from "node:path";
import { loadImage } from "./loader.js";
import { optimizeImage } from "./resizer.js";
import { analyzeImage } from "./client.js";

export const TOOL_DESCRIPTION = `INSPECT, DESCRIBE, AND ANALYZE IMAGES, SCREENSHOTS, DIAGRAMS, OR UI MOCKUPS.

Use this tool whenever you need to:
1. Inspect a screenshot (e.g. from Playwright, web captures, terminal output, or error popups)
2. Extract text / OCR from images verbatim
3. Analyze UI layouts, alignment, styling, and visual bugs
4. Understand architecture diagrams, flowcharts, or wireframes

ALWAYS use this tool instead of attempting to read binary image files with text tools.`;

/**
 * Execute the `imgsee` visual analysis.
 *
 * @param {object} args
 * @param {string} args.path Path to image file, screenshot, or URL
 * @param {string} [args.question] Question or inspection instructions
 * @param {"general" | "ocr" | "layout" | "debug"} [args.mode] Specialized analysis mode
 * @param {object} [context] Tool execution context
 * @param {object} [config] Module configuration from omh.jsonc
 * @returns {Promise<{ output: string }>}
 */
export async function executeImgseeTool(args, context = {}, config = {}) {
	const imagePath = args?.path;
	if (!imagePath || typeof imagePath !== "string") {
		return {
			output:
				"Error: `path` parameter is required for imgsee (path to local image file or URL).",
		};
	}

	const question =
		typeof args?.question === "string" && args.question.trim()
			? args.question.trim()
			: "Inspect, extract text/OCR, and analyze this image in detail.";

	const mode = args?.mode || "general";
	const directory = context?.directory || process.cwd();

	try {
		// 1. Load & Sniff Image
		const { buffer, mime, resolvedPath, size } = await loadImage(
			imagePath,
			directory,
		);

		// 2. Budget & Optimization check
		const { buffer: processedBuffer } = optimizeImage(buffer, {
			maxBytes: config.maxBytes,
		});

		// 3. Vision API Call via Gateway
		const result = await analyzeImage({
			buffer: processedBuffer,
			mime,
			question,
			gatewayUrl: config.gatewayUrl,
			model: config.model,
			timeoutMs: config.timeoutMs,
			mode,
		});

		const sizeKb = (size / 1024).toFixed(1);
		const durationSec = (result.durationMs / 1000).toFixed(2);
		const cleanPath = path.relative(directory, resolvedPath) || resolvedPath;

		// Structured for OpenCode TUI accordion preview with solid horizontal divider
		const formattedOutput = [
			`󰈈 imgsee: ${cleanPath} · ${result.model} (${durationSec}s, ${sizeKb} KB)`,
			`↳ Prompt: "${question}" [mode: ${mode}]`,
			`──────────────────────────────────────────────────`,
			result.content,
		].join("\n");

		return {
			output: formattedOutput,
		};
	} catch (err) {
		return {
			output: `Error during image inspection: ${err.message}`,
		};
	}
}

/**
 * Factory for OpenCode `imgsee` tool definition.
 *
 * @param {object} [opts]
 * @param {object} [opts.config]
 * @param {string} [opts.directory]
 * @returns {object} OpenCode tool definition
 */
export function createImgseeTool(opts = {}) {
	const config = opts.config || {};

	return {
		description: TOOL_DESCRIPTION,
		args: {
			path: {
				type: "string",
				description:
					"Absolute or relative path to the image file, screenshot, or HTTP URL to inspect.",
			},
			question: {
				type: "string",
				description:
					"Specific question, instruction, or extraction goal for this image (e.g. 'What error is shown?').",
			},
			mode: {
				type: "string",
				enum: ["general", "ocr", "layout", "debug"],
				description:
					"Analysis mode: 'general' (default), 'ocr' (extract verbatim text), 'layout' (UI/UX analysis), 'debug' (error diagnosis).",
			},
		},
		async execute(args, toolCtx) {
			const ctx = {
				directory: toolCtx?.directory || opts.directory || process.cwd(),
				...toolCtx,
			};
			const res = await executeImgseeTool(args, ctx, config);
			return res.output;
		},
	};
}

/**
 * prompts/router.js — Dynamic system prompt router for custom & gateway models.
 *
 * Resolves model-specific system prompts from ~/.opencode/assets/provider/
 * (or user overrides in ~/.config/opencode/prompts/) and dynamically transforms
 * system[0] in experimental.chat.system.transform while preserving all environment
 * metadata, AGENTS.md instructions, MCP, skills, and memory context.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const cache = new Map();

const BOUNDARY_MARKERS = [
	"\nYou are powered by the model named ",
	"\nHere is some useful information about the environment you are running in:",
	"\n<env>",
	"\n# Workspace & Environment Context",
	"\n# AGENTS.md",
	"\n<available_references>",
	"\n<mcp_instructions>",
	"\nSkills provide specialized instructions",
];

// First-line fingerprints of OpenCode's built-in base prompts (session/prompt/*.txt).
// If system[0] starts with none of these, the agent carries a custom persona
// that must never be overwritten by a model preset.
const BUILTIN_PROMPT_PREFIXES = [
	"You are opencode, an interactive CLI tool that helps users with software engineering tasks.",
	"You are OpenCode, the best coding agent on the planet.",
	"You are opencode, an agent - please keep going until the user’s query is completely resolved",
	"You are OpenCode, You and the user share the same workspace and collaborate to achieve the user's goals.",
	"You are opencode, an interactive CLI agent specializing in software engineering tasks.",
	"You are an expert AI programming assistant",
	"You are OpenCode, an interactive general AI agent running on a user's computer.",
	"You are OpenCode, a coding agent that helps users with software engineering tasks.",
];

function expandHome(p) {
	if (!p) return "";
	if (p === "~") return os.homedir();
	if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
	return p;
}

/**
 * Match a pattern against a string (exact or wildcard prefix/suffix).
 */
function matchPattern(pattern, str) {
	if (pattern === str) return true;
	if (pattern.endsWith("*") && str.startsWith(pattern.slice(0, -1)))
		return true;
	if (pattern.startsWith("*") && str.endsWith(pattern.slice(1))) return true;
	return false;
}

/**
 * Resolve provider assets path for a given model.
 */
export function resolvePresetPath(model, cfg = {}) {
	if (!model) return null;

	const baseDir = expandHome(cfg.directory || "~/.opencode/assets/provider");
	const customDir = expandHome(
		cfg.customDirectory || "~/.config/opencode/prompts",
	);
	const routes = cfg.routes || {};

	const rawId = model.id || "";
	const apiId = model.api?.id || "";
	const provider = model.providerID || "";
	const fullSlug = provider ? `${provider}/${rawId}` : rawId;
	const candidates = [fullSlug, rawId, apiId, provider].filter(Boolean);

	// 1. Explicit user routes from omh.jsonc
	for (const [routePattern, target] of Object.entries(routes)) {
		for (const cand of candidates) {
			if (matchPattern(routePattern, cand)) {
				const targetPath = expandHome(target);
				if (path.isAbsolute(targetPath) && existsSync(targetPath))
					return targetPath;
				const inCustom = path.join(customDir, target);
				if (existsSync(inCustom)) return inCustom;
				const inAssets = path.join(baseDir, target);
				if (existsSync(inAssets)) return inAssets;
				return targetPath;
			}
		}
	}

	// 2. User custom directory overrides (~/.config/opencode/prompts/)
	if (existsSync(customDir)) {
		// 2a. Exact match on rawId, apiId, or provider/id slug
		for (const cand of [fullSlug, rawId, apiId, provider]) {
			if (!cand) continue;
			const safeName = cand.replace(/[^a-zA-Z0-9._-]/g, "_");
			for (const ext of [".md", ".txt"]) {
				const candidateFile = path.join(customDir, `${safeName}${ext}`);
				if (existsSync(candidateFile)) return candidateFile;
			}
		}

		// 2b. Family keyword matching
		const searchTarget = `${provider}/${apiId}/${rawId}`.toLowerCase();
		const families = [
			{ re: /deepseek/, name: "deepseek" },
			{ re: /minimax|abab/, name: "minimax" },
			{ re: /qwen|qwq/, name: "qwen" },
			{ re: /kimi|moonshot/, name: "kimi" },
			{ re: /mistral|codestral|devstral/, name: "mistral" },
			{ re: /glm|zhipu/, name: "glm" },
			{ re: /hy3|hunyuan/, name: "hy3" },
			{ re: /gemini/, name: "gemini" },
			{ re: /claude|anthropic/, name: "claude" },
			{ re: /codex/, name: "codex" },
			{ re: /gpt|o1|o3|o4/, name: "gpt" },
			{ re: /grok|xai/, name: "grok" },
			{ re: /opencode/, name: "opencode" },
		];

		for (const fam of families) {
			if (fam.re.test(searchTarget)) {
				for (const ext of [".md", ".txt"]) {
					const familyFile = path.join(customDir, `${fam.name}${ext}`);
					if (existsSync(familyFile)) return familyFile;
				}
			}
		}

		// 2c. Custom default fallback in ~/.config/opencode/prompts/
		for (const ext of [".md", ".txt"]) {
			const customDefault = path.join(customDir, `default${ext}`);
			if (existsSync(customDefault)) return customDefault;
		}
	}

	// 3. Built-in provider assets catalog (~/.opencode/assets/provider/)
	const searchTarget = `${provider}/${apiId}/${rawId}`.toLowerCase();

	if (/minimax|abab/.test(searchTarget)) {
		return path.join(baseDir, "Misc/minimax-m2.5.md");
	}

	if (/deepseek/.test(searchTarget)) {
		return path.join(baseDir, "DeepSeek/deepseek-chat.md");
	}

	if (/qwen|qwq/.test(searchTarget)) {
		if (/max/.test(searchTarget)) {
			return path.join(baseDir, "Qwen/qwen3.8-max.md");
		}
		return path.join(baseDir, "Qwen/qwen3.6-plus.md");
	}

	if (/mistral|codestral|devstral/.test(searchTarget)) {
		return path.join(baseDir, "Mistral/mistral-code.md");
	}

	if (/glm|zhipu/.test(searchTarget)) {
		return path.join(baseDir, "GLM/README.md");
	}

	if (/kimi|moonshot/.test(searchTarget)) {
		if (/2\.6|26/.test(searchTarget)) {
			return path.join(baseDir, "Kimi/kimi-2.6.md");
		}
		return path.join(baseDir, "Kimi/kimi-3.md");
	}

	if (/gemini/.test(searchTarget)) {
		if (/3\.7/.test(searchTarget))
			return path.join(baseDir, "Google/gemini-3.7-flash.md");
		if (/3\.5/.test(searchTarget))
			return path.join(baseDir, "Google/gemini-3.5-flash.md");
		if (/3\.1/.test(searchTarget))
			return path.join(baseDir, "Google/gemini-3.1-pro-api.md");
		if (/2\.5/.test(searchTarget))
			return path.join(baseDir, "Google/gemini-2.5-pro-api.md");
		return path.join(baseDir, "Google/gemini-3.7-flash.md");
	}

	if (/claude|anthropic/.test(searchTarget)) {
		if (/opus/.test(searchTarget))
			return path.join(
				baseDir,
				"Anthropic/claude-code/claude-code-opus-4.6.md",
			);
		if (/haiku/.test(searchTarget))
			return path.join(
				baseDir,
				"Anthropic/claude-code/claude-code-haiku-4.5.md",
			);
		return path.join(
			baseDir,
			"Anthropic/claude-code/claude-code-sonnet-4.6.md",
		);
	}

	if (/codex/.test(searchTarget)) {
		return path.join(baseDir, "OpenAI/Codex/gpt-5.4.md");
	}

	if (/gpt-5|o3|o4/.test(searchTarget)) {
		return path.join(baseDir, "OpenAI/gpt-5.5-thinking.md");
	}

	if (/grok|xai/.test(searchTarget)) {
		return path.join(baseDir, "xAI/grok-4.5.md");
	}

	if (/opencode/.test(searchTarget)) {
		return path.join(baseDir, "OpenCode/opencode.md");
	}

	return null;
}

/**
 * Load prompt content from file path (cached in memory).
 */
export function loadPromptContent(filePath) {
	if (!filePath) return null;
	const expanded = expandHome(filePath);
	if (cache.has(expanded)) return cache.get(expanded);

	try {
		if (existsSync(expanded)) {
			const text = readFileSync(expanded, "utf8").trim();
			cache.set(expanded, text);
			return text;
		}
	} catch {}

	return null;
}

/**
 * True when system[0] starts with a custom agent persona instead of one of
 * OpenCode's built-in base prompts. Custom personas are user-authored and
 * must take precedence over model presets.
 */
export function hasCustomPersona(systemArray) {
	if (!Array.isArray(systemArray) || systemArray.length === 0) return false;
	const head = (systemArray[0] || "").trimStart();
	if (!head) return false;
	return !BUILTIN_PROMPT_PREFIXES.some((prefix) => head.startsWith(prefix));
}

/**
 * Transform system prompt by replacing base prompt and preserving environment/metadata tail.
 */
export function replaceSystemPrompt(systemArray, newPrompt) {
	if (!newPrompt) return systemArray;
	if (!Array.isArray(systemArray) || systemArray.length === 0) {
		return [newPrompt.trim()];
	}

	const original = systemArray[0] || "";
	let boundaryIdx = -1;

	for (const marker of BOUNDARY_MARKERS) {
		const idx = original.indexOf(marker);
		if (idx !== -1 && (boundaryIdx === -1 || idx < boundaryIdx)) {
			boundaryIdx = idx;
		}
	}

	if (boundaryIdx !== -1) {
		const tail = original.slice(boundaryIdx);
		systemArray[0] = `${newPrompt.trim()}\n\n${tail.trimStart()}`;
	} else {
		systemArray[0] = newPrompt.trim();
	}

	return systemArray;
}

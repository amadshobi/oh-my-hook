/**
 * share/config.js — oh-my-hook config loader.
 *
 * Reads ~/.config/opencode/omh.jsonc (or .json / .yaml / .yml — just pick
 * the extension), keeping plugin config OUT of opencode.jsonc.
 *
 * Multifile support: tries in order .jsonc → .json → .yaml → .yml, first
 * existing wins. Missing file = defaults.
 *
 * Config is layered: file config merged over DEFAULTS (deep, per section).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export const CONFIG_DIR = path.join(os.homedir(), ".config", "opencode");
export const CONFIG_BASENAME = "omh";

const EXTENSIONS = ["jsonc", "json", "yaml", "yml"];

export const DEFAULTS = {
	memory: {
		enabled: true,
		captureAdapter: "commandcode", // commandcode | opencode | omp
		// Model per adapter (biar gak nyampur ekosistem). Kosong = default adapter.
		captureModels: {
			commandcode: "", // kosong → model default cmd (set di config Command Code)
			opencode: "omp/hy3:free",
			omp: "gemini-3.6-flash",
		},
		maxBullets: 10,
		injectToSubagents: false,
		captureAuto: false, // auto-capture on session idle (distill via AI)
	},
	sandbox: {
		readBeforeWrite: true,
		staleWrite: true,
		secretScanner: true,
		commitGuard: true,
		devServerGuard: true,
		dangerousBash: true,
	},
	plans: {
		enabled: true,
		planMode: true,
		// Auto-detect explicit plan/execute intent from user text. When false,
		// mode switching is 100% via slash commands (/plan, /design, /approve).
		autoDetectIntent: true,
		directory: "~/.opencode/plans",
		versionLimit: 20,
	},
	compress: {
		enabled: true,
		// Compression mode: "auto" (deterministic), "model" (model-driven tool),
		// or "hybrid" (both — model can trigger, auto kicks in at hard threshold).
		mode: "hybrid",
		pruning: {
			enabled: true,
			recentTurns: 2,
			keepHeadChars: 500,
			keepTailChars: 1500,
			minOutputChars: 2000,
			keepImportantLines: true,
			toast: {
				enabled: true,
				cooldownMs: 30000,
			},
			debug: {
				enabled: true,
				maxSessions: 20,
			},
			// Deterministic auto range compression (DCP-style, balanced)
			compress: {
				recentTurns: 2,
				// Stop once ~50% of used tokens freed — LLM keeps context.
				targetSaveRatio: 0.5,
				// Only compress when total context exceeds this (avoid tiny sessions)
				minTokensToCompress: 30000,
				// Auto-compress triggers when usage % (of model context) exceeds this
				triggerRatio: 0.8,
			},
			// Automatic strategies (DCP-style)
			strategies: {
				deduplication: {
					enabled: true,
					protectedTools: ["read", "write", "edit", "grep", "glob"],
				},
				purgeErrors: {
					enabled: true,
					turns: 4,
				},
			},
			idempotent: true,
			protectedTools: {
				read: true,
				write: true,
				edit: true,
				patch: true,
				grep: true,
				glob: true,
				find: true,
				ls: true,
				todowrite: true,
				webfetch: true,
			},
			eligibleTools: {
				bash: true,
			},
			commandPatterns: {
				alwaysPrune: [
					"npm (install|ci|run build|test)",
					"pnpm (install|test|build)",
					"yarn (install|test|build)",
					"bun (install|test|build)",
					"git (commit|push|log|status|add)",
				],
				neverPrune: [
					"git (diff|show|log -p|blame)",
					"cat .*",
					"kubectl get -o yaml",
					"docker inspect",
				],
			},
			failureSignals: {
				fail: "FAILED|FAILURE|tests? failed",
				crash: "panic:|Traceback|SyntaxError|TypeError|ReferenceError",
				npm: "npm ERR!",
				os: "EACCES|ENOENT|exit status 1|segmentation fault",
			},
		},
		milestones: {
			enabled: true,
			pushAutoCompress: true,
			snapshotEnabled: true,
			snapshotMaxChars: 2500,
			minMessages: 30,
			minTurnsAfterPush: 2,
			idleCooldownMs: 600000,
			maxAutoCompressPerSession: 2,
		},
		commands: {
			compress: true,
		},
		snapshot: {
			compactionSnapshot: true,
			promptCheck: true,
			compactThreshold: 50,
		},
		agent: {
			enabled: true,
			main: [],
			subagent: [],
		},
	},
	context: {
		compactionSnapshot: true,
		promptCheck: true,
		compactThreshold: 50,
		agentEnabled: true,
		agent: {
			main: [],
			subagent: [],
		},
	},
	reminder: {
		verify: true,
		checklist: true,
	},
	gateway: {
		enabled: true,
	},
	prompts: {
		enabled: true,
		directory: "~/.opencode/assets/provider",
		customDirectory: "~/.config/opencode/prompts",
		routes: {},
		overridePersona: false,
	},
	imgsee: {
		enabled: true,
		gatewayUrl: "http://127.0.0.1:4010/v1/chat/completions",
		model: "google-antigravity/gemini-2.5-flash",
		maxBytes: 5242880, // 5 MiB
		timeoutMs: 60000,
	},
	usage: {
		enabled: true,
		tokens: {
			// Show subagent section (tree + last turn). false hides it entirely.
			showSubagents: true,
			// Subagent nodes default to collapsed (mobile-friendly).
			subagentsCollapsed: true,
		},
		quota: {
			ollama: {
				// key-prefix → display name for multi-key accounts
				accounts: {},
			},
		},
	},
	messages: {},
};

export function configPath(format) {
	return path.join(CONFIG_DIR, `${CONFIG_BASENAME}.${format}`);
}

/** Resolve which config file exists (jsonc > json > yaml > yml). */
export function resolveConfigPath() {
	return (
		EXTENSIONS.map((ext) => configPath(ext)).find((p) => existsSync(p)) ?? null
	);
}

/** Strip comments from JSONC (line + block comments), preserving strings. */
export function stripJsoncComments(text) {
	let out = "";
	let inString = false;
	let inLineComment = false;
	let inBlockComment = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		const next = text[i + 1];
		if (inLineComment) {
			if (ch === "\n") {
				inLineComment = false;
				out += ch;
			}
			continue;
		}
		if (inBlockComment) {
			if (ch === "*" && next === "/") {
				inBlockComment = false;
				i++;
			}
			continue;
		}
		if (inString) {
			out += ch;
			if (ch === "\\") {
				out += next ?? "";
				i++;
			} else if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			out += ch;
			continue;
		}
		if (ch === "/" && next === "/") {
			inLineComment = true;
			i++;
			continue;
		}
		if (ch === "/" && next === "*") {
			inBlockComment = true;
			i++;
			continue;
		}
		out += ch;
	}
	return out;
}

/** Minimal YAML subset parser (flat keys + nested via indentation). */
export function parseYamlSimple(text) {
	const result = {};
	const lines = text.split("\n");
	const stack = [{ indent: -1, obj: result }];
	for (const raw of lines) {
		const line = raw.replace(/\t/g, "  ").trimEnd();
		if (!line.trim() || line.trim().startsWith("#")) continue;
		const indent = line.length - line.trimStart().length;
		const content = line.trim();
		const match = content.match(/^([^:]+):\s*(.*)$/);
		if (!match) continue;
		const key = match[1].trim();
		let value = match[2].trim();
		// Pop stack to correct parent by indentation.
		while (stack.length > 1 && indent <= stack[stack.length - 1].indent)
			stack.pop();
		const parent = stack[stack.length - 1].obj;
		if (value === "" || value === "|" || value === ">") {
			// Nested object.
			const child = {};
			parent[key] = child;
			stack.push({ indent, obj: child });
			continue;
		}
		// Scalar coercion.
		if (value === "true") value = true;
		else if (value === "false") value = false;
		else if (/^-?\d+$/.test(value)) value = Number(value);
		else if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
		parent[key] = value;
	}
	return result;
}

function parseConfigText(text, ext) {
	if (ext === "yaml" || ext === "yml") return parseYamlSimple(text);
	// jsonc / json: strip comments (no-op for pure json) then parse.
	return JSON.parse(stripJsoncComments(text));
}

/** Load config, merged over defaults. Returns { config, source }. */
export function loadConfig() {
	const file = resolveConfigPath();
	if (!file) return { config: structuredClone(DEFAULTS), source: null };
	try {
		const text = readFileSync(file, "utf8");
		const ext = path.extname(file).slice(1).toLowerCase();
		const parsed = parseConfigText(text, ext);
		return { config: mergeConfig(DEFAULTS, parsed), source: file };
	} catch (e) {
		return {
			config: structuredClone(DEFAULTS),
			source: null,
			error: e.message,
		};
	}
}

/** Deep-merge user config over defaults (section by section). */
export function mergeConfig(base, override) {
	const out = structuredClone(base);
	if (!override || typeof override !== "object") return out;
	for (const [section, values] of Object.entries(override)) {
		if (!values || typeof values !== "object" || Array.isArray(values)) {
			out[section] = values;
			continue;
		}
		out[section] = { ...(out[section] ?? {}), ...values };
	}
	return out;
}

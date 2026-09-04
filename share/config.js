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

export const DEFAULT_PROTECTED_FILES = {
	enabled: true,
	blacklist: [
		"**/.env*",
		"**/auth.json",
		"**/settings.json",
		"**/*.pem",
		"**/*.key",
		"**/id_rsa*",
		"**/id_ed25519*",
		"**/exports.sh",
		"**/secrets.sh",
	],
	whitelist: [
		"**/.env.example",
		"**/.env.sample",
		"**/.env.template",
		"**/.env.dist",
	],
};

export const DEFAULTS = {
	memory: {
		enabled: true,
		baseURL: "http://127.0.0.1:4000/v1", // OpenAI-compatible gateway (OMP :4000, local :4010, etc.)
		model: "google-antigravity/gemini-2.5-flash",
		apiKey: "dummy",
		maxBullets: 10,
		injectToSubagents: false,
		budgets: {
			user: 1500,
			global: 2500,
			project: 3500,
		},
		review: {
			enabled: true, // Hermes-style background self-improvement review
			idleDelayMs: 3000,
		},
	},
	sandbox: {
		enabled: true,
		readBeforeWrite: true,
		staleWrite: true,
		secretScanner: true,
		commitGuard: true,
		devServerGuard: true,
		dangerousBash: true,
		readGuard: {
			enabled: true,
			readBeforeWrite: true,
			staleWrite: true,
			interceptBashMutation: true,
		},
		secretScannerConfig: {
			enabled: true,
			scanBash: true,
			protectedFiles: DEFAULT_PROTECTED_FILES,
		},
		commitGuardConfig: {
			enabled: true,
			maxChars: 72,
			requireCoAuthor: false,
			blockNoVerify: true,
			interceptGh: true,
		},
		dangerousBashConfig: {
			enabled: true,
			blockWipeHome: true,
			blockWipeGit: true,
			blockWipeWorkspace: true,
			blockGitDestructive: true,
		},
		devServerGuardConfig: {
			enabled: true,
		},
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
			recentTurns: 1,
			keepHeadChars: 500,
			keepTailChars: 1500,
			minOutputChars: 2000,
			massiveOutputChars: 10000,
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

/**
 * Normalize modular and flat sandbox configuration into a unified structure.
 * Supports backward-compatible flat booleans and modern nested modules.
 *
 * @param {object} raw
 * @returns {object}
 */
export function isFeatureEnabled(cfg, fallback = true) {
	if (cfg === false) return false;
	if (cfg === true) return true;
	if (cfg && typeof cfg === "object") {
		return cfg.enabled !== false;
	}
	return fallback;
}

export function normalizeSandboxConfig(raw = {}) {
	const cfg = structuredClone(raw || {});

	// 1. readGuard
	const rg = typeof cfg.readGuard === "object" ? cfg.readGuard : {};
	const rbw =
		typeof raw.readBeforeWrite === "boolean"
			? raw.readBeforeWrite
			: (rg.readBeforeWrite ?? cfg.readBeforeWrite ?? true);
	const sw =
		typeof raw.staleWrite === "boolean"
			? raw.staleWrite
			: (rg.staleWrite ?? cfg.staleWrite ?? true);
	const ibm = rg.interceptBashMutation ?? true;

	cfg.readGuard = {
		enabled: rg.enabled ?? (rbw || sw),
		readBeforeWrite: rbw,
		staleWrite: sw,
		interceptBashMutation: ibm,
	};
	cfg.readBeforeWrite = rbw;
	cfg.staleWrite = sw;

	// 2. secretScanner
	if (typeof raw.secretScanner === "boolean") {
		cfg.secretScanner = raw.secretScanner;
	} else {
		const sec = typeof cfg.secretScanner === "object" ? cfg.secretScanner : {};
		cfg.secretScanner = {
			enabled: sec.enabled ?? true,
			scanBash: sec.scanBash ?? true,
			protectedFiles: {
				enabled: sec.protectedFiles?.enabled ?? true,
				blacklist: Array.isArray(sec.protectedFiles?.blacklist)
					? sec.protectedFiles.blacklist
					: DEFAULT_PROTECTED_FILES.blacklist,
				whitelist: Array.isArray(sec.protectedFiles?.whitelist)
					? sec.protectedFiles.whitelist
					: DEFAULT_PROTECTED_FILES.whitelist,
			},
		};
	}

	// 3. commitGuard
	if (typeof raw.commitGuard === "boolean") {
		cfg.commitGuard = raw.commitGuard;
	} else {
		const commit = typeof cfg.commitGuard === "object" ? cfg.commitGuard : {};
		cfg.commitGuard = {
			enabled: commit.enabled ?? true,
			maxChars: Number(commit.maxChars) || 72,
			requireCoAuthor: commit.requireCoAuthor === true,
			blockNoVerify: commit.blockNoVerify ?? true,
			interceptGh: commit.interceptGh ?? true,
		};
	}

	// 4. dangerousBash
	if (typeof raw.dangerousBash === "boolean") {
		cfg.dangerousBash = raw.dangerousBash;
	} else {
		const bash = typeof cfg.dangerousBash === "object" ? cfg.dangerousBash : {};
		const bashEnabled = bash.enabled ?? true;
		cfg.dangerousBash = {
			enabled: bashEnabled,
			blockWipeHome: bash.blockWipeHome ?? bashEnabled,
			blockWipeGit: bash.blockWipeGit ?? bashEnabled,
			blockWipeWorkspace: bash.blockWipeWorkspace ?? bashEnabled,
			blockGitDestructive: bash.blockGitDestructive ?? bashEnabled,
		};
	}

	// 5. devServerGuard
	if (typeof raw.devServerGuard === "boolean") {
		cfg.devServerGuard = raw.devServerGuard;
	} else {
		const dev =
			typeof cfg.devServerGuard === "object" ? cfg.devServerGuard : {};
		cfg.devServerGuard = {
			enabled: dev.enabled ?? true,
		};
	}

	return cfg;
}

function deepMergeHelper(base, override) {
	if (!override || typeof override !== "object") return override;
	if (Array.isArray(override)) return [...override];
	const out = structuredClone(base || {});
	for (const [k, v] of Object.entries(override)) {
		if (Array.isArray(v)) {
			out[k] = [...v];
		} else if (
			v &&
			typeof v === "object" &&
			out[k] &&
			typeof out[k] === "object" &&
			!Array.isArray(out[k])
		) {
			out[k] = deepMergeHelper(out[k], v);
		} else {
			out[k] = v;
		}
	}
	return out;
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
		out[section] = deepMergeHelper(out[section] ?? {}, values);
	}
	if (out.sandbox) {
		out.sandbox = normalizeSandboxConfig(out.sandbox);
	}
	return out;
}

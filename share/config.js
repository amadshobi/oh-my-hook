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
		directory: "~/.opencode/plans",
		versionLimit: 20,
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

/**
 * compress/agent-context.js — Inject file/URL-based context into the system
 * prompt, gated by agent mode (main vs subagent).
 */
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import os from "node:os";
import {
	isSubagent,
	loadAgentModes,
	rememberSessionAgent,
} from "../share/agent.js";

const FETCH_TIMEOUT_MS = 5000;
const cache = new Map();

function expandHome(p) {
	if (!p) return "";
	if (p === "~") return os.homedir();
	if (p.startsWith("~/")) return resolve(os.homedir(), p.slice(2));
	return p;
}

function isHttpUrl(p) {
	return /^https?:\/\//i.test(p);
}

function resolveLocalPath(p, directory) {
	const expanded = expandHome(p);
	if (isAbsolute(expanded)) return expanded;
	return resolve(directory || process.cwd(), expanded);
}

async function readSource(source, directory) {
	const key = `${directory ?? ""}\u0000${source}`;
	if (cache.has(key)) return cache.get(key);

	let text = "";
	if (isHttpUrl(source)) {
		text = await fetchRemote(source);
	} else {
		text = readLocal(resolveLocalPath(source, directory));
	}

	cache.set(key, text);
	return text;
}

function readLocal(filePath) {
	try {
		return readFileSync(filePath, "utf8").trim();
	} catch {
		return "";
	}
}

async function fetchRemote(url) {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(timer);
		if (!res.ok) return "";
		return (await res.text()).trim();
	} catch {
		return "";
	}
}

async function buildContextBlock(sources, directory) {
	if (!Array.isArray(sources) || sources.length === 0) return "";
	const parts = [];
	for (const source of sources) {
		if (typeof source !== "string" || !source.trim()) continue;
		const text = await readSource(source.trim(), directory);
		if (text) parts.push(text);
	}
	return parts.join("\n\n");
}

export const agentContextHooks = async ({ directory }, opts = {}) => {
	const cfg = opts?.config ?? {};
	const agentCfg = cfg.agent ?? {};
	const enabled = agentCfg.enabled ?? cfg.agentEnabled ?? true;

	const mainSources = agentCfg.main ?? [];
	const subagentSources = agentCfg.subagent ?? [];
	const agentModes = loadAgentModes(directory);

	return {
		"chat.message": async (input) => {
			rememberSessionAgent(input?.sessionID, input?.agent);
		},

		"experimental.chat.system.transform": async (input, output) => {
			if (!enabled) return;
			const sources = isSubagent(input, agentModes)
				? subagentSources
				: mainSources;
			if (!Array.isArray(sources) || sources.length === 0) return;

			const block = await buildContextBlock(sources, directory);
			if (block) {
				output.system = output.system || [];
				output.system.push(`\n## AGENT CONTEXT\n${block}\n`);
			}
		},
	};
};

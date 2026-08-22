/**
 * share/messages.js — centralized message dictionary with hybrid override support.
 *
 * All messages are concise, informative, and standardized in English.
 */
import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { blockMessage, warnMessage } from "./block.js";

export const DEFAULT_MESSAGES = {
	modePlanTool: {
		title: "Plan Mode Active",
		reason: "Cannot modify project code while session is in Plan Mode.",
		suggestion: "Run '/approve' or wait for execution trigger to modify files.",
	},
	modePlanBash: {
		title: "Plan Mode Active",
		reason: 'Command "{command}" mutates state, but session is in Plan Mode.',
		suggestion: "Run read-only inspection commands or run '/approve'.",
	},
	readGuardUnread: {
		title: "Unread File",
		reason: 'File "{file}" has not been read in this session.',
		suggestion: "Use read tool to inspect file before editing.",
	},
	readGuardStale: {
		title: "Stale File",
		reason: 'File "{file}" changed on disk after last read.',
		suggestion: "Re-read file to fetch latest changes before writing.",
	},
	secretDetected: {
		title: "Secret Detected",
		reason: "Payload contains sensitive credentials:\n{detail}",
		suggestion: "Use environment variables or .env files instead.",
	},
	dangerousBash: {
		title: "Dangerous Command Blocked",
		reason: 'Command "{command}" matches destructive system patterns.',
		suggestion: "Action requires explicit user confirmation.",
	},
	commitGuard: {
		title: "Invalid Commit Format",
		reason: "{reason}",
		suggestion: "Use Conventional Commits: type(scope): description",
	},
	devServerGuard: {
		title: "Dev Server Blocked",
		reason: 'Command "{command}" cannot run as orphan foreground process.',
		suggestion: "Run dev servers inside a tmux or screen session.",
	},
	pushWarning: {
		title: "Git Push Warning",
		reason: "{warning}",
		suggestion: "Verify remote branch target before pushing.",
	},
	strayMarkdown: {
		title: "Non-standard Markdown",
		reason: 'File "{file}" created outside standard docs directories.',
		suggestion: "Keep project documentation within docs/ or root docs.",
	},
	checklistNudge: {
		title: "Multi-step Task",
		reason: "Complex task detected. Break steps into structured todos.",
		suggestion: "Track implementation milestones with todowrite.",
	},
	toolBlocked: {
		title: "Tool Blocked",
		reason: "Tool '{tool}' is restricted by policy ({policy}).",
		suggestion: "Check sandbox/tool configuration in omh.jsonc.",
	},
};

function resolvePath(filePath, cwd = process.cwd()) {
	if (filePath.startsWith("~")) {
		return path.join(os.homedir(), filePath.slice(1));
	}
	return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
}

function loadExternalFile(fileRef, cwd) {
	const match = fileRef.match(/^\{file:\s*(.+?)\s*\}$/);
	if (!match) return null;
	const rawPath = match[1];
	const fullPath = resolvePath(rawPath, cwd);
	if (!existsSync(fullPath)) return null;
	try {
		const content = readFileSync(fullPath, "utf8").trim();
		if (content.startsWith("{") && content.endsWith("}")) {
			try {
				return JSON.parse(content);
			} catch {}
		}
		return content;
	} catch {
		return null;
	}
}

export function interpolate(template, params = {}) {
	if (typeof template !== "string") return "";
	return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
		const val = params[key];
		return val !== undefined && val !== null ? String(val) : match;
	});
}

export function resolveMessage(
	key,
	params = {},
	config = {},
	cwd = process.cwd(),
) {
	const fallback = DEFAULT_MESSAGES[key] || {
		title: "Notice",
		reason: `Notice for ${key}`,
		suggestion: "Check configuration and parameters.",
	};

	const messagesConfig = config?.messages || config;
	let override = messagesConfig?.[key];

	if (typeof override === "string" && override.startsWith("{file:")) {
		const loaded = loadExternalFile(override, cwd);
		if (loaded) override = loaded;
	}

	let resolvedTitle = fallback.title;
	let resolvedReason = fallback.reason;
	let resolvedSuggestion = fallback.suggestion;

	if (typeof override === "string") {
		resolvedReason = override;
	} else if (override && typeof override === "object") {
		if (override.title !== undefined) resolvedTitle = override.title;
		if (override.reason !== undefined) resolvedReason = override.reason;
		if (override.suggestion !== undefined)
			resolvedSuggestion = override.suggestion;
	}

	return {
		title: interpolate(resolvedTitle, params),
		reason: interpolate(resolvedReason, params),
		suggestion: interpolate(resolvedSuggestion, params),
	};
}

export function formatBlockMessage(
	key,
	params = {},
	config = {},
	cwd = process.cwd(),
) {
	const { title, reason, suggestion } = resolveMessage(
		key,
		params,
		config,
		cwd,
	);
	return blockMessage(title, reason, suggestion);
}

export function formatWarnMessage(
	key,
	params = {},
	config = {},
	cwd = process.cwd(),
) {
	const { title, reason } = resolveMessage(key, params, config, cwd);
	return warnMessage(title, reason);
}

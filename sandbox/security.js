/**
 * sandbox/security.js — deep content & behavior safety guards:
 * secret scanner, dangerous bash, conventional commit guard, dev-server guard,
 * git push safety, and stray .md warnings.
 */
import path from "node:path";
import { formatBlockMessage, formatWarnMessage } from "../share/messages.js";
import {
	toolArgs,
	bashCommand,
	filePathOf,
	writeContent,
} from "../share/hook.js";
import { createNotifier } from "../share/notify.js";

// Secret scanning is a shared primitive (also used by memory/) — the logic
// lives in share/, re-exported here for backward compatibility.
import { scanContentForSecrets } from "../share/security.js";

export { scanContentForSecrets };

const DANGEROUS_PATTERNS = [
	/rm\s+-(?:r[a-z]*f|f[a-z]*r)\s+\/(?:\*|\s|$)/i, // rm -rf /, rm -fr /*, rm -rf /
	/mkfs\./i,
	/dd\s+if=.*of=\/dev\/(?:sd|nvme|vd)/i,
	/:\(\)\s*\{\s*:\|:&\s*\};:/, // fork bomb
	/>\s*\/dev\/(?:sd|nvme|vd)/i,
	/chmod\s+-R\s+777\s+\//i,
	/(?:curl|wget)[^\n|&;]*\|\s*(?:ba|z)?sh/i,
];

export function dangerousBashPatterns(command) {
	if (!command || typeof command !== "string") return false;
	return DANGEROUS_PATTERNS.some((re) => re.test(command));
}

const DEV_SERVER_PATTERNS = [
	"npm run dev",
	"npm start",
	"yarn dev",
	"pnpm dev",
	"bun dev",
	"next dev",
	"vite",
	"webpack serve",
	"nodemon",
	"ts-node-dev",
	"python manage.py runserver",
	"flask run",
	"uvicorn",
	"cargo watch",
];

export function isDevServer(command) {
	if (!command || typeof command !== "string") return false;
	return DEV_SERVER_PATTERNS.some((p) => command.includes(p));
}

const MD_ALLOWED_PATTERNS = [
	"/docs/",
	"/documentation/",
	"AGENTS.md",
	"README.md",
	"CHANGELOG.md",
	"CONTRIBUTING.md",
	"LICENSE.md",
	"OPENCODE.md",
	"CODEMAP.md",
	"SKILL.md",
	"/commands/",
	"/skills/",
	"/agents/",
	"/rules/",
	"/templates/",
];

const CONVENTIONAL_RE =
	/^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?!?:\s.+/;

export function checkCommitMessage(command) {
	if (!command || !command.includes("git commit")) return null;
	const msgMatch = command.match(
		/-m\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/,
	);
	if (!msgMatch) return null;
	const msg = msgMatch[1] || msgMatch[2] || msgMatch[3];
	const errors = [];

	if (!CONVENTIONAL_RE.test(msg)) {
		errors.push(
			"Message does not follow conventional commit format: type(scope): description",
		);
	}
	if (msg.length > 72) {
		errors.push(`Subject line is ${msg.length} chars (max 72)`);
	}
	if (msg.endsWith(".")) {
		errors.push("Subject line should not end with a period");
	}
	const firstChar = msg.replace(
		/^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?!?:\s/,
		"",
	)[0];
	if (firstChar && firstChar === firstChar.toUpperCase()) {
		errors.push("Description should start with lowercase letter");
	}

	return errors.length > 0
		? {
				block: true,
				reason: "Commit message issues:\n  - " + errors.join("\n  - "),
			}
		: null;
}

export function checkPush(command) {
	if (!command || !/\bgit\s+push\b/.test(command)) return null;
	const isForce = /(?:^|\s)(-f|--force|--force-with-lease)(?:\s|$)/.test(
		command,
	);
	const isMain = /(?:^|\s)(origin\s+)?(main|master)(?:\s|$)/.test(command);

	if (isMain && isForce) {
		return {
			block: true,
			reason:
				"Force pushing to main/master is strictly blocked. Consider creating a PR instead.",
		};
	}

	const warnings = [];
	if (isForce) {
		warnings.push(
			"Force push detected. This rewrites remote history and may affect collaborators.",
		);
	}
	if (!command.includes("origin") && !command.includes("-u")) {
		warnings.push("No remote specified. Pushing to default remote.");
	}
	return warnings.length > 0
		? { block: false, warning: warnings.join(" | ") }
		: null;
}

export const securityHooks = async ({ client }, opts = {}) => {
	const cfg =
		opts?.config?.guard ?? opts?.config?.sandbox ?? opts?.config ?? {};
	const messagesConfig = opts?.messages ?? opts?.config?.messages ?? {};
	const secretScanner = cfg.secretScanner ?? true;
	const dangerousBash = cfg.dangerousBash ?? true;
	const commitGuard = cfg.commitGuard ?? true;
	const devServerGuard = cfg.devServerGuard ?? true;

	const notify = createNotifier(client, "security", "warn");

	return {
		"tool.execute.before": async (input, output) => {
			const tool = input?.tool;
			const args = toolArgs(input, output);

			// --- secret scanner: block Write/Edit with secrets ---
			if (
				secretScanner &&
				(tool === "write" || tool === "edit" || tool === "patch")
			) {
				const filePath = filePathOf(args);
				const content = writeContent(args);
				if (filePath || content) {
					const findings = scanContentForSecrets(content);
					if (findings.length > 0) {
						const detail = findings
							.map((f) => `  - Line ${f.line}: ${f.type}`)
							.join("\n");
						await notify(
							`Potential secrets detected in ${path.basename(filePath) || "content"}`,
						);
						throw new Error(
							formatBlockMessage(
								"secretDetected",
								{ detail, file: filePath || "content" },
								messagesConfig,
							),
						);
					}
				}
			}

			// --- bash command guardrails ---
			if (tool === "bash") {
				const command = bashCommand(args);
				if (!command) return;

				if (dangerousBash && dangerousBashPatterns(command)) {
					await notify(
						`Blocked dangerous bash command: ${command.slice(0, 120)}`,
					);
					throw new Error(
						formatBlockMessage(
							"dangerousBash",
							{ command: command.slice(0, 80) },
							messagesConfig,
						),
					);
				}

				const commitIssue = commitGuard ? checkCommitMessage(command) : null;
				if (commitIssue?.block) {
					await notify(`Blocked commit: ${commitIssue.reason.slice(0, 120)}`);
					throw new Error(
						formatBlockMessage(
							"commitGuard",
							{ reason: commitIssue.reason },
							messagesConfig,
						),
					);
				}

				if (devServerGuard && isDevServer(command)) {
					const inTmux =
						Boolean(process.env.TMUX) ||
						command.trim().startsWith("tmux ") ||
						command.trim().startsWith("screen ");
					const inScreen = Boolean(process.env.STY);
					if (!inTmux && !inScreen) {
						await notify(
							`Blocked dev server outside tmux/screen: ${command.slice(0, 80)}`,
						);
						throw new Error(
							formatBlockMessage(
								"devServerGuard",
								{ command: command.slice(0, 60) },
								messagesConfig,
							),
						);
					}
				}

				const pushIssue = checkPush(command);
				if (pushIssue?.block) {
					await notify(`Blocked dangerous git push: ${pushIssue.reason}`);
					throw new Error(
						formatBlockMessage(
							"pushWarning",
							{ warning: pushIssue.reason, command },
							messagesConfig,
						),
					);
				} else if (pushIssue?.warning) {
					const warnMsg = formatWarnMessage(
						"pushWarning",
						{ warning: pushIssue.warning, command },
						messagesConfig,
					);
					await notify(warnMsg, "warn");
				}
			}

			// --- .md creation guard (warn only, not block) ---
			if (tool === "write") {
				const filePath = filePathOf(args);
				if (filePath && filePath.endsWith(".md")) {
					const allowed = MD_ALLOWED_PATTERNS.some((p) => filePath.includes(p));
					if (!allowed) {
						const warnMsg = formatWarnMessage(
							"strayMarkdown",
							{ file: path.basename(filePath), path: filePath },
							messagesConfig,
						);
						await notify(warnMsg, "warn");
					}
				}
			}
		},
	};
};

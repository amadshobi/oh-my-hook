/**
 * sandbox/security.js — deep content & behavior safety guards:
 * secret scanner, dangerous bash, conventional commit guard, dev-server guard,
 * protected files shield, git push safety, and stray .md warnings.
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
import { isPathBlocked } from "../share/path.js";
import {
	normalizeSandboxConfig,
	isFeatureEnabled,
	DEFAULT_PROTECTED_FILES,
} from "../share/config.js";

// Secret scanning is a shared primitive (also used by memory/) — the logic
// lives in share/, re-exported here for backward compatibility.
import { scanContentForSecrets } from "../share/security.js";

export { scanContentForSecrets };

const DANGEROUS_ROOT_RES = [
	/rm\s+-(?:r[a-z]*f|f[a-z]*r)\s+\/(?:\*|\s|$)/i, // rm -rf /, rm -fr /*
];

const DANGEROUS_SYSTEM_RES = [
	/mkfs\./i,
	/dd\s+if=.*of=\/dev\/(?:sd|nvme|vd)/i,
	/:\(\)\s*\{\s*:\|:&\s*\};:/, // fork bomb
	/>\s*\/dev\/(?:sd|nvme|vd)/i,
	/chmod\s+-R\s+777\s+\//i,
	/(?:curl|wget)[^\n|&;]*\|\s*(?:ba|z)?sh/i,
];

const DANGEROUS_HOME_RE =
	/rm\s+-(?:r[a-z]*f|f[a-z]*r)\s+(?:~|\$HOME|\${HOME})(?:\/|\s|$)/i;
const DANGEROUS_GIT_RE = /rm\s+-(?:r[a-z]*f|f[a-z]*r)\s+\.git(?:\/|\s|$)/i;
const DANGEROUS_WORKSPACE_RE =
	/rm\s+-(?:r[a-z]*f|f[a-z]*r)\s+(?:\.|\*)(?:\s|$)/i;
const DANGEROUS_GIT_OPS = [/git\s+reset\s+--hard/i, /git\s+clean\s+-[a-z]*f/i];

export function dangerousBashPatterns(command, opts = {}) {
	if (!command || typeof command !== "string") return false;

	// Always blocked system destroyers
	if (DANGEROUS_ROOT_RES.some((re) => re.test(command))) return true;
	if (DANGEROUS_SYSTEM_RES.some((re) => re.test(command))) return true;

	// Granular configurable wipeouts
	if (opts.blockWipeHome !== false && DANGEROUS_HOME_RE.test(command)) {
		return true;
	}
	if (opts.blockWipeGit !== false && DANGEROUS_GIT_RE.test(command)) {
		return true;
	}
	if (
		opts.blockWipeWorkspace !== false &&
		DANGEROUS_WORKSPACE_RE.test(command)
	) {
		return true;
	}
	if (
		opts.blockGitDestructive !== false &&
		DANGEROUS_GIT_OPS.some((re) => re.test(command))
	) {
		return true;
	}

	return false;
}

const DEV_SERVER_PATTERNS = [
	/\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?dev\b/i,
	/\b(?:npm|pnpm|yarn|bun)\s+start\b/i,
	/\bnext\s+dev\b/i,
	/\bvite(?:\s+(?:dev|serve))?\s*(?:$|--)/i,
	/\bwebpack\s+serve\b/i,
	/\bnodemon\b/i,
	/\bts-node-dev\b/i,
	/\bpython\s+manage\.py\s+runserver\b/i,
	/\bflask\s+run\b/i,
	/\buvicorn\b/i,
	/\bcargo\s+watch\b/i,
	/(?:^|[\s;&|])air(?:\s|$)/i,
];

export function isDevServer(command) {
	if (!command || typeof command !== "string") return false;
	// Safe commands like help, grep, echo are not running servers
	if (
		/\b(?:grep|cat|echo|--help|-h)\b/.test(command) &&
		!command.includes(";") &&
		!command.includes("&&")
	) {
		return false;
	}
	return DEV_SERVER_PATTERNS.some((re) => re.test(command));
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
	"/.opencode/",
	"/.github/",
];

const CONVENTIONAL_RE =
	/^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?!?:\s.+/;

/**
 * Validate commit commands (supports git commit and gh pr merge/create).
 *
 * @param {string} command
 * @param {object} [opts]
 * @returns {null | { block: boolean, reason: string }}
 */
export function checkCommitMessage(command, opts = {}) {
	if (!command || typeof command !== "string") return null;

	const maxChars = Number(opts?.maxChars) || 72;
	const requireCoAuthor = opts?.requireCoAuthor ?? false;
	const blockNoVerify = opts?.blockNoVerify ?? true;
	const interceptGh = opts?.interceptGh ?? true;

	// 1. Intercept git commit
	if (command.includes("git commit")) {
		// Block --no-verify / -n
		if (blockNoVerify && /(?:^|\s)(?:--no-verify|-n)(?:\s|$)/.test(command)) {
			return {
				block: true,
				reason:
					"Bypassing git hooks via --no-verify / -n is strictly prohibited.",
			};
		}

		const msgMatch = command.match(
			/-m\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/,
		);
		if (!msgMatch) return null;
		const msg = msgMatch[1] || msgMatch[2] || msgMatch[3];
		const errors = [];

		if (!CONVENTIONAL_RE.test(msg)) {
			errors.push(
				"Message does not follow Conventional Commits format: type(scope): description",
			);
		}
		if (msg.length > maxChars) {
			errors.push(`Subject line is ${msg.length} chars (max ${maxChars})`);
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

		// Require Co-Author Attribution
		if (requireCoAuthor) {
			const hasTrailer =
				command.includes("--trailer") &&
				/Co-authored-by:\s*.+<.+@.+>/i.test(command);
			const hasBodyCoAuthor =
				/-m\s+["'].*Co-authored-by:\s*.+<.+@.+>.*["']/is.test(command);
			if (!hasTrailer && !hasBodyCoAuthor) {
				errors.push(
					'Missing mandatory Co-Author Attribution trailer: --trailer "Co-authored-by: ... <...>"',
				);
			}
		}

		return errors.length > 0
			? {
					block: true,
					reason: "Commit message issues:\n  - " + errors.join("\n  - "),
				}
			: null;
	}

	// 2. Intercept gh pr merge --subject
	if (interceptGh && command.includes("gh pr merge")) {
		const subjMatch = command.match(
			/(?:--subject|-s)\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/,
		);
		if (subjMatch) {
			const subj = subjMatch[1] || subjMatch[2] || subjMatch[3];
			if (subj.length > maxChars) {
				return {
					block: true,
					reason: `PR merge subject is ${subj.length} chars (max ${maxChars})`,
				};
			}
		}
	}

	return null;
}

export function checkPush(command) {
	if (!command || !/\bgit\s+push\b/.test(command)) return null;
	const isForce = /(?:^|\s)(-f|--force|--force-with-lease)(?:\s|$)/.test(
		command,
	);
	const isMain = /(?:^|\s)(?:origin\s+)?(main|master)(?:\s|$)/.test(command);
	const isDelete =
		/(?:^|\s)(?:--delete\s+(?:origin\s+)?(main|master)|:main|:master)(?:\s|$)/.test(
			command,
		);

	if (isMain && isForce) {
		return {
			block: true,
			reason:
				"Force pushing to main/master is strictly blocked. Consider creating a PR instead.",
		};
	}

	if (isDelete) {
		return {
			block: true,
			reason: "Deleting main/master branch on remote is strictly blocked.",
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

/**
 * Extract target file paths from reading commands in bash (cat, head, tail, grep, source, <).
 *
 * @param {string} command
 * @returns {string[]}
 */
export function extractReadingFilePaths(command) {
	if (!command || typeof command !== "string") return [];
	const paths = [];

	// 1. Match commands that output/read files
	const READ_CMD_RE =
		/\b(?:cat|head|tail|grep|awk|less|more|source|\.)\s+([^|;&\n]+)/gi;
	let match;
	while ((match = READ_CMD_RE.exec(command)) !== null) {
		const argsStr = match[1];
		const tokens = argsStr.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
		for (const raw of tokens) {
			const clean = raw.replace(/^["']|["']$/g, "").trim();
			if (
				clean &&
				!clean.startsWith("-") &&
				!clean.startsWith("$") &&
				!clean.includes("=")
			) {
				paths.push(clean);
			}
		}
	}

	// 2. Match redirection input: < file
	const REDIRECT_IN_RE = /<\s*([^\s|;&\n]+)/g;
	while ((match = REDIRECT_IN_RE.exec(command)) !== null) {
		const clean = match[1].replace(/^["']|["']$/g, "").trim();
		if (clean && !clean.startsWith("&")) {
			paths.push(clean);
		}
	}

	return paths;
}

export const securityHooks = async ({ client, directory }, opts = {}) => {
	const rawCfg =
		opts?.config?.guard ?? opts?.config?.sandbox ?? opts?.config ?? {};
	const cfg = normalizeSandboxConfig(rawCfg);
	const messagesConfig = opts?.messages ?? opts?.config?.messages ?? {};

	const secEnabled = isFeatureEnabled(cfg.secretScanner);
	const secConfig =
		typeof cfg.secretScanner === "object" ? cfg.secretScanner : {};
	const protectedAcl = secEnabled
		? secConfig.protectedFiles ||
			(typeof cfg.secretScannerConfig === "object"
				? cfg.secretScannerConfig.protectedFiles
				: DEFAULT_PROTECTED_FILES)
		: null;

	const bashEnabled = isFeatureEnabled(cfg.dangerousBash);
	const bashConfig =
		typeof cfg.dangerousBash === "object" ? cfg.dangerousBash : {};

	const commitEnabled = isFeatureEnabled(cfg.commitGuard);
	const commitConfig =
		typeof cfg.commitGuard === "object" ? cfg.commitGuard : {};

	const devEnabled = isFeatureEnabled(cfg.devServerGuard);

	const notify = createNotifier(client, "security", "warn");
	const cwd = directory || process.cwd();

	return {
		"tool.execute.before": async (input, output) => {
			const tool = input?.tool;
			const args = toolArgs(input, output);

			// --- 1. Protected Sensitive Files Shield (tool: read) ---
			if (tool === "read" && protectedAcl && protectedAcl.enabled !== false) {
				const filePath = filePathOf(args);
				if (filePath && isPathBlocked(filePath, protectedAcl, cwd)) {
					const fileName = path.basename(filePath);
					await notify(`Blocked read access to protected file: ${fileName}`);
					throw new Error(
						formatBlockMessage(
							"protectedFile",
							{ file: fileName, path: filePath },
							messagesConfig,
						),
					);
				}
			}

			// --- 2. Secret Scanner: block Write/Edit with secrets ---
			if (
				secEnabled &&
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

			// --- 3. Bash command guardrails ---
			if (tool === "bash") {
				const command = bashCommand(args);
				if (!command) return;

				// 3a. Secret scanner on bash command payloads (curl -H, export KEY=)
				if (secEnabled && secConfig?.scanBash !== false) {
					const findings = scanContentForSecrets(command);
					if (findings.length > 0) {
						const detail = findings.map((f) => `  - ${f.type}`).join("\n");
						await notify("Blocked bash command containing plain-text secrets");
						throw new Error(
							formatBlockMessage(
								"secretDetected",
								{ detail, file: "bash command" },
								messagesConfig,
							),
						);
					}
				}

				// 3b. Protected files shield in bash (cat .env, head auth.json)
				if (protectedAcl && protectedAcl.enabled !== false) {
					const targetFiles = extractReadingFilePaths(command);
					for (const file of targetFiles) {
						if (isPathBlocked(file, protectedAcl, cwd)) {
							const fileName = path.basename(file);
							await notify(
								`Blocked bash reading of protected file: ${fileName}`,
							);
							throw new Error(
								formatBlockMessage(
									"protectedFile",
									{ file: fileName, path: file },
									messagesConfig,
								),
							);
						}
					}
				}

				// 3c. Dangerous bash destructive patterns
				if (bashEnabled && dangerousBashPatterns(command, bashConfig)) {
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

				// 3d. Git push safety (evaluated before commit in chained push commands)
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

				// 3e. Commit message validation (conventional commit, maxChars, co-author)
				if (commitEnabled) {
					const commitIssue = checkCommitMessage(command, commitConfig);
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
				}

				// 3f. Dev server orphan process check
				if (devEnabled && isDevServer(command)) {
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
			}

			// --- 4. Stray Markdown creation guard ---
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

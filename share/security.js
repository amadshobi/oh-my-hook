/**
 * share/security.js — agent-agnostic security primitives shared across modules.
 *
 * Pure pattern matching with zero hook/framework dependencies so any module
 * (and any future agent adapter) can reuse it via the share/ layer only.
 */

export const SECRET_PATTERNS = [
	{
		name: "AWS Access/Session Key",
		regex: /(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}/g,
	},
	{
		name: "AWS Secret Key",
		regex: /aws_secret_access_key\s*=\s*["']?[A-Za-z0-9/+=]{40}/gi,
	},
	{
		name: "GitHub Token",
		regex: /(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g,
	},
	{
		name: "OpenAI API Key",
		regex: /sk-(?:proj-|admin-|svcacct-)?[A-Za-z0-9_-]{20,}/g,
	},
	{ name: "Anthropic API Key", regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
	{ name: "Google AI Key", regex: /AIza[0-9A-Za-z-_]{35}/g },
	{
		name: "Private Key",
		regex: /-----BEGIN (?:[A-Z0-9_-]+\s+)?PRIVATE KEY-----/g,
	},
	{
		name: "Generic API Key",
		regex: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/gi,
	},
	{ name: "Slack Token", regex: /xox[bpors]-[0-9a-zA-Z-]{10,}/g },
	{
		name: "Database URL",
		regex: /(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@\s]+@/g,
	},
	{
		name: "JWT Token",
		regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
	},
];

export function scanContentForSecrets(content) {
	if (!content || typeof content !== "string") return [];
	const lines = content.split("\n");
	const findings = [];
	for (const pattern of SECRET_PATTERNS) {
		for (let i = 0; i < lines.length; i++) {
			pattern.regex.lastIndex = 0;
			if (pattern.regex.test(lines[i])) {
				findings.push({ type: pattern.name, line: i + 1 });
			}
		}
	}
	return findings;
}

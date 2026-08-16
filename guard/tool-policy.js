/**
 * guard/tool-policy.js — Granular per-tool policy guardrails.
 *
 * Supports:
 * - String policy: "allow", "deny", "readonly" (blocks mutating tools write/edit/patch/delete/rename)
 * - Object policy: { policy: "allow" | "deny", denyPatterns?: string[], reason?: string }
 * - Wildcard matching: e.g. "mcp:github:*" or "*"
 */
import { formatBlockMessage } from "../share/messages.js";
import { toolArgs, bashCommand, filePathOf } from "../share/hook.js";
import { createNotifier } from "../share/notify.js";

const MUTATING_TOOLS = new Set(["edit", "write", "patch", "delete", "rename", "create"]);

/**
 * Check if a tool name matches a configured pattern (supporting wildcards like `mcp:github:*` or `*`).
 */
function matchesPattern(tool, pattern) {
  if (tool === pattern) return true;
  if (pattern === "*") return true;
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(tool);
  }
  return false;
}

/**
 * Calculate pattern specificity score.
 * More specific patterns (longer literal prefix/content) get higher scores.
 */
function patternSpecificity(pattern) {
  if (pattern === "*") return 0;
  const literalChars = pattern.replace(/\*/g, "").length;
  const prefixLength = pattern.indexOf("*") === -1 ? pattern.length : pattern.indexOf("*");
  // Weight prefix length higher, then total literal length, then full pattern length
  return prefixLength * 100 + literalChars * 10 + pattern.length;
}

/**
 * Resolve matching policy entry from tools config.
 * Priority:
 * 1. Exact match
 * 2. Specific wildcard match (sorted by specificity: most-specific first)
 * 3. Catch-all `*`
 */
function resolveToolPolicy(tool, toolsConfig = {}) {
  if (!toolsConfig || typeof toolsConfig !== "object") return null;

  // 1. Exact match
  if (tool in toolsConfig) {
    return toolsConfig[tool];
  }

  const entries = Object.entries(toolsConfig);

  // 2. Filter & sort wildcard patterns by descending specificity
  const wildcards = entries
    .filter(([pattern]) => pattern !== "*" && pattern.includes("*"))
    .sort(([patA], [patB]) => patternSpecificity(patB) - patternSpecificity(patA));

  for (const [pattern, policy] of wildcards) {
    if (matchesPattern(tool, pattern)) {
      return policy;
    }
  }

  // 3. Check catch-all wildcard "*"
  if ("*" in toolsConfig) {
    return toolsConfig["*"];
  }

  return null;
}

/**
 * Check if tool invocation matches denyPatterns in object policy.
 */
function matchesDenyPatterns(tool, args, patterns = []) {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;

  const cmd = bashCommand(args);
  const file = filePathOf(args);
  const candidateTexts = [
    cmd,
    file,
    typeof args === "string" ? args : "",
    JSON.stringify(args),
  ].filter(Boolean);

  for (const pattern of patterns) {
    let re;
    try {
      re = new RegExp(pattern);
    } catch {
      re = new RegExp(pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
    }

    if (candidateTexts.some((text) => re.test(text))) {
      return true;
    }
  }

  return false;
}

export function toolPolicyHooks(input, opts = {}) {
  const client = input?.client ?? input;
  const toolsConfig =
    opts.config?.tools ??
    opts.tools ??
    opts.config?.guard?.tools ??
    opts.guard?.tools ??
    {};
  const messagesConfig = opts.messages ?? opts.config?.messages ?? {};
  const notify = createNotifier(client, "tool-policy", "warn");

  return {
    "tool.execute.before": async (hookInput) => {
      const tool = hookInput?.tool;
      if (!tool) return;

      const policyRule = resolveToolPolicy(tool, toolsConfig);
      if (!policyRule) return;

      const args = toolArgs(hookInput);

      // Handle string policy
      if (typeof policyRule === "string") {
        const normalizedPolicy = policyRule.toLowerCase();

        if (normalizedPolicy === "deny") {
          await notify(`Tool '${tool}' diblokir oleh kebijakan deny`);
          throw new Error(
            formatBlockMessage(
              "toolBlocked",
              { tool, policy: "deny" },
              messagesConfig
            )
          );
        }

        if (normalizedPolicy === "readonly" && MUTATING_TOOLS.has(tool)) {
          await notify(`Tool '${tool}' diblokir oleh kebijakan readonly`);
          throw new Error(
            formatBlockMessage(
              "toolBlocked",
              { tool, policy: "readonly" },
              messagesConfig
            )
          );
        }

        if (normalizedPolicy === "allow" || normalizedPolicy === "readonly") {
          return;
        }

        // Fail-closed on invalid policy strings (e.g. typos like "denyy")
        await notify(`Tool '${tool}' memiliki konfigurasi policy tidak valid: '${policyRule}'`);
        throw new Error(
          formatBlockMessage(
            "toolBlocked",
            { tool, policy: `invalid (${policyRule})` },
            messagesConfig
          )
        );
      }

      // Handle object policy
      if (typeof policyRule === "object" && policyRule !== null) {
        const policyType = (policyRule.policy ?? "allow").toLowerCase();
        const reason = policyRule.reason;

        if (policyType === "deny") {
          await notify(`Tool '${tool}' diblokir oleh kebijakan deny`);
          throw new Error(
            formatBlockMessage(
              "toolBlocked",
              { tool, policy: reason || "deny" },
              messagesConfig
            )
          );
        }

        if (policyType === "readonly" && MUTATING_TOOLS.has(tool)) {
          await notify(`Tool '${tool}' diblokir oleh kebijakan readonly`);
          throw new Error(
            formatBlockMessage(
              "toolBlocked",
              { tool, policy: reason || "readonly" },
              messagesConfig
            )
          );
        }

        if (policyRule.denyPatterns && matchesDenyPatterns(tool, args, policyRule.denyPatterns)) {
          const policyLabel = reason || `denyPattern: ${policyRule.denyPatterns.join(", ")}`;
          await notify(`Tool '${tool}' diblokir oleh denyPattern`);
          throw new Error(
            formatBlockMessage(
              "toolBlocked",
              { tool, policy: policyLabel },
              messagesConfig
            )
          );
        }
      }
    },
  };
}

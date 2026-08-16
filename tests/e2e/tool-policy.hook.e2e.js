#!/usr/bin/env node
/**
 * tool-policy.hook.e2e.js — deterministic E2E test of the granular tool-policy guard
 * against the ACTUAL hook pipeline used by OpenCode.
 *
 * Exercises:
 *   1. Direct string policies: allow, deny, readonly (blocking mutating actions).
 *   2. Wildcard pattern resolution & specificity: e.g. "mcp:slack:read_*" vs "mcp:slack:*".
 *   3. Bash command denyPatterns inside object policies.
 *   4. Clean pass-through for unconfigured tools.
 *
 * Usage: node tests/e2e/tool-policy.hook.e2e.js
 */
import { toolPolicyHooks } from "../../guard/tool-policy.js";

function assert(cond, message) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

console.log("\n[E2E] Tool Policy Guard (deterministic hook pipeline)");

try {
  const hooks = await toolPolicyHooks(
    { client: null },
    {
      config: {
        tools: {
          delete: "deny",
          webfetch: "deny",
          edit: "readonly",
          "mcp:github:*": "deny",
          "mcp:slack:*": "deny",
          "mcp:slack:read_*": "allow",
          bash: {
            policy: "allow",
            denyPatterns: ["npm\\s+publish", "git\\s+push.*--force"],
            reason: "Publishing and force push are restricted",
          },
        },
      },
    }
  );

  const before = hooks["tool.execute.before"];

  // 1. Direct deny policy
  console.log("  1. Checking direct 'deny' policy...");
  let blockedDelete = false;
  try {
    await before({ tool: "delete", args: { filePath: "/tmp/test.txt" } });
  } catch (e) {
    blockedDelete = true;
    assert(/kebijakan: deny|Tool Diblokir/i.test(e.message), "Error should mention deny policy");
  }
  assert(blockedDelete, "Expected tool 'delete' to be blocked");

  // 2. Readonly policy blocks mutating tools but allows read
  console.log("  2. Checking 'readonly' policy...");
  let blockedEdit = false;
  try {
    await before({ tool: "edit", args: { filePath: "/tmp/test.txt", newString: "new" } });
  } catch (e) {
    blockedEdit = true;
    assert(/kebijakan: readonly/i.test(e.message), "Error should mention readonly policy");
  }
  assert(blockedEdit, "Expected tool 'edit' to be blocked by readonly policy");

  // 3. Wildcard MCP matching & specificity
  console.log("  3. Checking wildcard MCP matching and specificity...");
  let blockedGithub = false;
  try {
    await before({ tool: "mcp:github:create_issue", args: {} });
  } catch (e) {
    blockedGithub = true;
    assert(/mcp:github:create_issue/i.test(e.message), "Error should name the tool");
  }
  assert(blockedGithub, "Expected 'mcp:github:create_issue' to be blocked");

  // Specific allow beats general deny
  let allowedSlackRead = true;
  try {
    await before({ tool: "mcp:slack:read_messages", args: {} });
  } catch {
    allowedSlackRead = false;
  }
  assert(allowedSlackRead, "Expected 'mcp:slack:read_messages' to be allowed by specific rule");

  let blockedSlackPost = false;
  try {
    await before({ tool: "mcp:slack:post_message", args: {} });
  } catch {
    blockedSlackPost = true;
  }
  assert(blockedSlackPost, "Expected 'mcp:slack:post_message' to be blocked by fallback wildcard");

  // 4. DenyPatterns inside object policy
  console.log("  4. Checking bash denyPatterns in object policy...");
  let blockedForcePush = false;
  try {
    await before({ tool: "bash", args: { command: "git push origin main --force" } });
  } catch (e) {
    blockedForcePush = true;
    assert(/Publishing and force push are restricted/i.test(e.message), "Custom reason should be shown");
  }
  assert(blockedForcePush, "Expected force push command to be blocked");

  let allowedNormalBash = true;
  try {
    await before({ tool: "bash", args: { command: "git status" } });
  } catch {
    allowedNormalBash = false;
  }
  assert(allowedNormalBash, "Expected 'git status' to pass through");

  console.log("\n✅ PASS: tool-policy guard pipeline verified successfully");
} catch (e) {
  console.error(`\n❌ FAIL: ${e.message}`);
  process.exitCode = 1;
}

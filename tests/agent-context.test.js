import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAgentModes, rememberSessionAgent, isSubagent, resolveAgentMode } from "../share/agent.js";
import { agentContextHooks } from "../context/agent-context.js";

test("loadAgentModes reads primary and subagent modes", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agent-modes-"));
  writeFileSync(
    path.join(dir, "opencode.jsonc"),
    `{
      "agent": {
        "assistant": { "mode": "primary" },
        "explore": { "mode": "subagent" }
      }
    }`
  );
  const modes = loadAgentModes(dir);
  assert.equal(modes.assistant, "primary");
  assert.equal(modes.explore, "subagent");
  rmSync(dir, { recursive: true, force: true });
});

test("isSubagent uses config mode over session heuristic", () => {
  const modes = { assistant: "primary", explore: "subagent" };
  rememberSessionAgent("s1", "assistant");
  rememberSessionAgent("s2", "explore");

  assert.equal(isSubagent({ sessionID: "s1" }, modes), false);
  assert.equal(isSubagent({ sessionID: "s2" }, modes), true);
});

test("resolveAgentMode falls back to primary when sessionID present", () => {
  assert.equal(resolveAgentMode({ sessionID: "unknown" }, {}), "primary");
  assert.equal(resolveAgentMode({}, {}), "subagent");
});

test("agentContextHooks injects main context only for primary agent", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agent-ctx-"));
  const mainFile = path.join(dir, "main-rules.md");
  const subFile = path.join(dir, "sub-rules.md");
  writeFileSync(mainFile, "MAIN RULE");
  writeFileSync(subFile, "SUB RULE");
  writeFileSync(
    path.join(dir, "opencode.jsonc"),
    `{
      "agent": {
        "assistant": { "mode": "primary" },
        "explore": { "mode": "subagent" }
      }
    }`
  );

  const hooks = await agentContextHooks({ directory: dir }, {
    config: {
      agent: { main: [mainFile], subagent: [subFile] },
    },
  });

  const mainOut = { system: [] };
  await hooks["experimental.chat.system.transform"]({ sessionID: "s1", agent: "assistant" }, mainOut);
  assert.ok(mainOut.system.some((s) => s.includes("MAIN RULE")));
  assert.ok(!mainOut.system.some((s) => s.includes("SUB RULE")));

  const subOut = { system: [] };
  await hooks["experimental.chat.system.transform"]({ sessionID: "s2", agent: "explore" }, subOut);
  assert.ok(subOut.system.some((s) => s.includes("SUB RULE")));
  assert.ok(!subOut.system.some((s) => s.includes("MAIN RULE")));

  rmSync(dir, { recursive: true, force: true });
});

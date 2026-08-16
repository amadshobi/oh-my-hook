#!/usr/bin/env node
/**
 * plans-commands.hook.e2e.js — deterministic E2E test for the /plan, /design,
 * /approve, /exec, /mode slash command lifecycle and guardrail whitelist.
 *
 * Flow:
 *   1. User triggers `/plan to-file auth-system`.
 *   2. Session mode switches to "plan", target file is whitelisted.
 *   3. Writing to `~/.opencode/plans/auth-system.md` is ALLOWED.
 *   4. Writing to project code `src/auth.js` is BLOCKED.
 *   5. User triggers `/approve`.
 *   6. Session mode switches to "execute", writing to `src/auth.js` is now ALLOWED.
 *
 * Usage: node tests/e2e/plans-commands.hook.e2e.js
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { planHooks } from "../../plans/index.js";
import { modeHooks } from "../../guard/mode.js";
import { loadModeState, saveModeState } from "../../share/state.js";

function assert(cond, message) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

console.log("\n[E2E] Plans Slash Commands & Whitelist Pipeline");

const TEST_SESSION = "e2e-plans-session-" + Date.now();
const tmpDir = path.join(os.tmpdir(), "omh-plans-e2e-" + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

const originalState = loadModeState();

try {
  const customConfig = {
    plans: {
      enabled: true,
      directory: tmpDir,
    },
    guard: {
      planMode: true,
      plansDirectory: tmpDir,
    },
  };

  const p規Hooks = await planHooks({ client: null, directory: tmpDir }, { config: customConfig });
  const mHooks = await modeHooks({ client: null, directory: tmpDir }, { config: customConfig.guard });

  const commandBefore = p規Hooks["command.execute.before"];
  const toolBefore = mHooks["tool.execute.before"];

  // 1. Trigger /plan to-file feature-xyz
  console.log("  1. Triggering /plan to-file feature-xyz...");
  const planOutput = { parts: [] };
  await commandBefore(
    { command: "plan", arguments: "to-file feature-xyz fokus ke security", sessionID: TEST_SESSION },
    planOutput
  );

  const stateAfterPlan = loadModeState();
  assert(stateAfterPlan[TEST_SESSION]?.mode === "plan", "Session mode should be 'plan'");
  assert(
    stateAfterPlan[TEST_SESSION]?.planFile === path.join(tmpDir, "feature-xyz.md"),
    "Target plan file should be recorded"
  );
  assert(planOutput.parts.length > 0, "Prompt parts should be generated");
  assert(planOutput.parts[0].text.includes("Mode Plan"), "Prompt should contain Plan mode template");
  console.log("  → Mode plan set and template prompt injected");

  // 2. Test Plan Whitelist: write to plan file is ALLOWED
  console.log("  2. Verifying write to plan file is ALLOWED in Plan Mode...");
  const planTargetFile = path.join(tmpDir, "feature-xyz.md");
  let planWriteBlocked = false;
  try {
    await toolBefore({
      tool: "write",
      args: { filePath: planTargetFile, content: "# Feature XYZ Plan" },
      sessionID: TEST_SESSION,
    });
  } catch {
    planWriteBlocked = true;
  }
  assert(!planWriteBlocked, "Writing to whitelisted plan file should be ALLOWED");
  console.log("  → Plan file write allowed successfully");

  // 3. Test Project Code: write to src/app.js is BLOCKED
  console.log("  3. Verifying write to regular project file is BLOCKED in Plan Mode...");
  let projectWriteBlocked = false;
  try {
    await toolBefore({
      tool: "write",
      args: { filePath: "/home/user/project/src/app.js", content: "console.log('hack');" },
      sessionID: TEST_SESSION,
    });
  } catch (e) {
    projectWriteBlocked = true;
    assert(/Plan Mode/i.test(e.message), "Error should mention Plan Mode");
  }
  assert(projectWriteBlocked, "Writing to regular project file must be BLOCKED");
  console.log("  → Regular project file write blocked successfully");

  // 4. Trigger /approve
  console.log("  4. Triggering /approve...");
  const approveOutput = { parts: [] };
  await commandBefore(
    { command: "approve", arguments: "lanjut implementasi", sessionID: TEST_SESSION },
    approveOutput
  );

  const stateAfterApprove = loadModeState();
  assert(stateAfterApprove[TEST_SESSION]?.mode === "execute", "Session mode should switch to 'execute'");
  assert(approveOutput.parts[0].text.includes("Mode Eksekusi"), "Approve prompt should be injected");
  console.log("  → Mode switched to 'execute'");

  // 5. Test Project Code now ALLOWED in Execute Mode
  console.log("  5. Verifying write to regular project file is now ALLOWED in Execute Mode...");
  let executeWriteBlocked = false;
  try {
    await toolBefore({
      tool: "write",
      args: { filePath: "/home/user/project/src/app.js", content: "console.log('ok');" },
      sessionID: TEST_SESSION,
    });
  } catch {
    executeWriteBlocked = true;
  }
  assert(!executeWriteBlocked, "Writing to project file should now be ALLOWED");
  console.log("  → Project file write allowed in Execute Mode");

  console.log("\n✅ PASS: plans slash commands and whitelist verified successfully");
} catch (e) {
  console.error(`\n❌ FAIL: ${e.message}`);
  process.exitCode = 1;
} finally {
  // Cleanup test session & tmpDir
  const state = loadModeState();
  delete state[TEST_SESSION];
  saveModeState(state);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

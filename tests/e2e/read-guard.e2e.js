#!/usr/bin/env node
/**
 * e2e/read-guard.e2e.js — end-to-end test of the read-guard plugin
 * against a REAL headless OpenCode run.
 *
 * Flow:
 *   1. Create a temp project with an existing file.
 *   2. Run `opencode run --format json` with a prompt that asks the model
 *      to edit the file WITHOUT reading it first.
 *   3. The oh-my-hook read-guard should BLOCK the edit.
 *   4. Assert the model's output acknowledges the block.
 *   5. Auto-delete the session (opencode has no --no-session flag).
 *
 * Usage: node tests/e2e/read-guard.e2e.js [model]
 * Default model: omp/hy3:free
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const MODEL = process.argv[2] || "omp/hy3:free";
const TIMEOUT_MS = 120_000;

function runOpencode(cwd, prompt) {
  const out = execFileSync("opencode", ["run", "--format", "json", "-m", MODEL, "--dir", cwd, prompt], {
    encoding: "utf8",
    timeout: TIMEOUT_MS,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const lines = out.trim().split("\n").filter(Boolean);
  const events = lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);

  const sessionIDs = [...new Set(events.map((e) => e.sessionID).filter(Boolean))];
  const texts = events.filter((e) => e.type === "text").map((e) => e.part?.text ?? "");
  const finalText = texts.join("\n").trim();
  return { sessionID: sessionIDs[0], finalText, events };
}

function deleteSession(sessionID) {
  if (!sessionID) return;
  try {
    execFileSync("opencode", ["session", "delete", sessionID], { stdio: "ignore", timeout: 15000 });
    console.log(`  [cleanup] deleted session ${sessionID}`);
  } catch (e) {
    console.error(`  [cleanup] FAILED to delete session ${sessionID}: ${e.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

// --- main ---
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "ohmyhook-e2e-"));
const targetFile = path.join(tmpDir, "greeting.js");
writeFileSync(targetFile, "const greeting = 'hello';\nconsole.log(greeting);\n");

console.log(`\n[1/1] Testing read-before-write guard (model: ${MODEL})`);
console.log(`  project: ${tmpDir}`);
console.log(`  file:    ${targetFile}`);
console.log("  prompt: ask model to edit file WITHOUT reading it first");

let sessionID;
try {
  const result = runOpencode(
    tmpDir,
    `In this project, there is a file called greeting.js. DO NOT read it first. \
Directly edit greeting.js to change the greeting text to "hi" using the edit tool. \
If you are blocked or told to read the file first, say the exact phrase "BLOCKED_READ_FIRST". \
Otherwise say "EDIT_OK".`
  );
  sessionID = result.sessionID;
  console.log(`  session: ${sessionID}`);
  console.log(`  final text: ${JSON.stringify(result.finalText.slice(0, 300))}`);

  // The read-guard should block the edit, and the model should report being blocked.
  assert(
    result.finalText.includes("BLOCKED_READ_FIRST") ||
      /baca|read.*(first|dulu|sebelum)/i.test(result.finalText),
    `Expected read-before-write block, but model said: ${result.finalText.slice(0, 200)}`
  );

  // The file must NOT have been modified (the guard blocked the actual edit).
  const after = readFileSync(targetFile, "utf8");
  assert(
    after.includes("hello"),
    `File was modified despite read-before-write guard. Content: ${after.slice(0, 200)}`
  );

  console.log("\n✅ PASS: read-before-write guard blocked the edit");
} catch (e) {
  console.error(`\n❌ FAIL: ${e.message}`);
  process.exitCode = 1;
} finally {
  deleteSession(sessionID);
  rmSync(tmpDir, { recursive: true, force: true });
}

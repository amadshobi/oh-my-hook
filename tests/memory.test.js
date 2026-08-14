import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  projectSlug,
  projectMemoryFile,
  GLOBAL_FILE,
  readMemory,
  readAllMemory,
  appendMemory,
  parseBullets,
} from "../memory/store.js";
import { memoryHooks } from "../memory/index.js";

// Memory files write to the REAL ~/.config/opencode/memory/. Tests use a
// temp project dir (memory is keyed by project path) and clean up after.
function makeProject() {
  return mkdtempSync(path.join(os.tmpdir(), "mem-"));
}

test("projectSlug strips leading slash", () => {
  assert.equal(projectSlug("/home/user/proj"), "home/user/proj");
  assert.equal(projectSlug(""), "");
});

test("appendMemory writes bullet lines", () => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "memfile-")), "MEMORY.md");
  appendMemory(file, "satu");
  appendMemory(file, "dua");
  const content = readFileSync(file, "utf8");
  assert.ok(content.includes("- satu"));
  assert.ok(content.includes("- dua"));
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test("parseBullets extracts topic lines", () => {
  const md = "# Memory\n\n- alpha\n- beta\n\n## Notes\n- gamma";
  assert.deepEqual(parseBullets(md), ["alpha", "beta", "gamma"]);
});

test("readAllMemory merges global + project", () => {
  const project = makeProject();
  const projFile = projectMemoryFile(project);
  appendMemory(projFile, "proj-specific");
  // Avoid clobbering real global memory: only assert project part shows up.
  const all = readAllMemory(project);
  assert.ok(all.includes("proj-specific"));
  rmSync(path.dirname(projFile), { recursive: true, force: true });
});

test("memoryHooks: /remember writes project memory", async () => {
  const project = makeProject();
  const hooks = await memoryHooks({ client: {}, directory: project });
  await hooks["command.execute.before"]({ command: "remember", arguments: "pakai kebab-case" });
  const projFile = projectMemoryFile(project);
  assert.ok(existsSync(projFile));
  assert.ok(readFileSync(projFile, "utf8").includes("pakai kebab-case"));
  rmSync(path.dirname(projFile), { recursive: true, force: true });
});

test("memoryHooks: system.transform injects for main agent, not subagent", async () => {
  const project = makeProject();
  const hooks = await memoryHooks({ client: {}, directory: project });
  await hooks["command.execute.before"]({ command: "remember", arguments: "memory-test-note" });

  const mainOut = { system: [] };
  await hooks["experimental.chat.system.transform"]({ sessionID: "s1", model: {} }, mainOut);
  assert.ok(mainOut.system.some((s) => s.includes("memory-test-note")), "main agent should get memory");

  const subOut = { system: [] };
  await hooks["experimental.chat.system.transform"]({ agent: "explore", model: {} }, subOut);
  assert.equal(subOut.system.length, 0, "subagent should NOT get memory");

  rmSync(path.dirname(projectMemoryFile(project)), { recursive: true, force: true });
});

test("memoryHooks: compaction injects memory", async () => {
  const project = makeProject();
  const hooks = await memoryHooks({ client: {}, directory: project });
  await hooks["command.execute.before"]({ command: "remember", arguments: "compact-note" });

  const out = { context: [] };
  await hooks["experimental.session.compacting"]({ sessionID: "s1" }, out);
  assert.ok(out.context.some((c) => c.includes("compact-note")), "compaction should include memory");

  rmSync(path.dirname(projectMemoryFile(project)), { recursive: true, force: true });
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distTuiPath = path.join(__dirname, "..", "tui", "dist", "tui.js");

test("tui/dist/tui.js is compiled and exports plugin interface", async () => {
  assert.ok(fs.existsSync(distTuiPath), "tui/dist/tui.js should exist");
  const content = fs.readFileSync(distTuiPath, "utf8");
  assert.ok(content.includes("export const tui"), "Should export tui function");
  assert.ok(content.includes("oh-my-hook-sidebar"), "Should register oh-my-hook-sidebar slots");
  assert.ok(content.includes("session_prompt_right"), "Should register session_prompt_right slot");
  assert.ok(content.includes("sidebar_content"), "Should register sidebar_content slot");
});

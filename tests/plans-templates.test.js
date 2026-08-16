import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadTemplate, renderTemplate } from "../plans/templates.js";

test("loadTemplate loads built-in plan and design templates", () => {
  const planTpl = loadTemplate("plan");
  assert.ok(planTpl.includes("Mode Plan"));

  const designTpl = loadTemplate("design");
  assert.ok(designTpl.includes("Design Mode"));

  const approveTpl = loadTemplate("approve");
  assert.ok(approveTpl.includes("Mode Eksekusi"));
});

test("loadTemplate honors project-level override if exists", () => {
  const tmpProject = path.join(os.tmpdir(), "oh-my-hook-project-test-" + Date.now());
  const projectPrompts = path.join(tmpProject, ".opencode", "prompts");
  fs.mkdirSync(projectPrompts, { recursive: true });
  fs.writeFileSync(path.join(projectPrompts, "plan.md"), "# Custom Project Plan Template");

  const loaded = loadTemplate("plan", tmpProject);
  assert.equal(loaded, "# Custom Project Plan Template");

  fs.rmSync(tmpProject, { recursive: true, force: true });
});

test("renderTemplate interpolates placeholders cleanly", () => {
  const template = "Plan for {topic} in file {plan_file} (Session: {session_id})";
  const rendered = renderTemplate(template, {
    topic: "Google Auth",
    plan_file: "/path/to/plan.md",
    session_id: "ses_123",
  });
  assert.equal(rendered, "Plan for Google Auth in file /path/to/plan.md (Session: ses_123)");
});

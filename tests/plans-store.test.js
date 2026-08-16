import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveTargetPlanPath, archivePlanFile, sanitizePlanName } from "../plans/store.js";

test("sanitizePlanName cleans non-alphanumeric characters and trims .md", () => {
  assert.equal(sanitizePlanName("My Cool Feature.md"), "my-cool-feature");
  assert.equal(sanitizePlanName("feature/v1-auth!"), "feature-v1-auth");
});

test("resolveTargetPlanPath handles plan vs design kind", () => {
  const plansDir = "/tmp/test-plans";
  const planTarget = resolveTargetPlanPath(plansDir, "auth-system", "plan");
  assert.equal(planTarget.filePath, "/tmp/test-plans/auth-system.md");

  const designTarget = resolveTargetPlanPath(plansDir, "auth-modal", "design");
  assert.equal(designTarget.filePath, "/tmp/test-plans/designs/auth-modal.md");
});

test("archivePlanFile moves existing plan file to versions/ with incrementing version", () => {
  const tmpDir = path.join(os.tmpdir(), "oh-my-hook-store-test-" + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const targetFile = path.join(tmpDir, "my-feature.md");
  fs.writeFileSync(targetFile, "# Original Content");

  // First archive -> v1
  const archived1 = archivePlanFile(targetFile, tmpDir, "my-feature");
  assert.ok(archived1);
  assert.equal(path.basename(archived1), "my-feature-v1.md");
  assert.equal(fs.existsSync(targetFile), false);
  assert.equal(fs.existsSync(archived1), true);

  // Write new file and archive again -> v2
  fs.writeFileSync(targetFile, "# Second Content");
  const archived2 = archivePlanFile(targetFile, tmpDir, "my-feature");
  assert.ok(archived2);
  assert.equal(path.basename(archived2), "my-feature-v2.md");
  assert.equal(fs.existsSync(archived2), true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

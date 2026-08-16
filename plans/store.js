/**
 * plans/store.js — manages plan files, directories, and auto-versioning.
 */
import { existsSync, mkdirSync, renameSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Sanitize a string for safe usage as a filename.
 *
 * @param {string} rawName
 * @returns {string}
 */
export function sanitizePlanName(rawName) {
  if (!rawName) return "plan-" + Date.now();
  let clean = rawName
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "plan-" + Date.now();
}

/**
 * Resolve target absolute plan file path.
 *
 * @param {string} plansDir Base plans directory
 * @param {string} rawName Feature or design name
 * @param {"plan"|"design"} [kind="plan"]
 * @returns {{ filePath: string, sanitizedName: string, targetDir: string }}
 */
export function resolveTargetPlanPath(plansDir, rawName, kind = "plan") {
  const sanitizedName = sanitizePlanName(rawName);
  const targetDir = kind === "design" ? path.join(plansDir, "designs") : plansDir;
  const filePath = path.join(targetDir, `${sanitizedName}.md`);
  return { filePath, sanitizedName, targetDir };
}

/**
 * If target plan file already exists, archives it to `versions/<name>-v<N>.md`.
 *
 * @param {string} targetFilePath
 * @param {string} targetDir
 * @param {string} sanitizedName
 * @returns {string|null} Archived file path or null if none existed
 */
export function archivePlanFile(targetFilePath, targetDir, sanitizedName) {
  if (!existsSync(targetFilePath)) return null;

  const versionsDir = path.join(targetDir, "versions");
  mkdirSync(versionsDir, { recursive: true });

  let highestVersion = 0;
  try {
    const files = readdirSync(versionsDir);
    const prefix = `${sanitizedName}-v`;
    for (const f of files) {
      if (f.startsWith(prefix) && f.endsWith(".md")) {
        const numPart = f.slice(prefix.length, -3);
        const v = parseInt(numPart, 10);
        if (!isNaN(v) && v > highestVersion) {
          highestVersion = v;
        }
      }
    }
  } catch {}

  const nextVersion = highestVersion + 1;
  const archivePath = path.join(versionsDir, `${sanitizedName}-v${nextVersion}.md`);

  try {
    renameSync(targetFilePath, archivePath);
    return archivePath;
  } catch {
    return null;
  }
}

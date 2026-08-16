/**
 * plans/templates.js — 3-level template loader and macro interpolator.
 *
 * Precedence:
 * 1. Project-level: `<projectDir>/.opencode/prompts/<name>.md`
 * 2. Global-level: `~/.config/opencode/prompts/<name>.md`
 * 3. Built-in: `<moduleDir>/prompts/<name>.md`
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILTIN_PROMPTS_DIR = path.join(__dirname, "prompts");
const GLOBAL_PROMPTS_DIR = path.join(os.homedir(), ".config", "opencode", "prompts");

/**
 * Load template text with 3-level fallback.
 *
 * @param {string} name Template name without extension (e.g. 'plan', 'design', 'approve')
 * @param {string} [projectDir]
 * @returns {string}
 */
export function loadTemplate(name, projectDir = process.cwd()) {
  const filename = `${name}.md`;

  // 1. Project-level
  if (projectDir) {
    const projectPath = path.join(projectDir, ".opencode", "prompts", filename);
    if (existsSync(projectPath)) {
      try {
        return readFileSync(projectPath, "utf8");
      } catch {}
    }
  }

  // 2. Global-level
  const globalPath = path.join(GLOBAL_PROMPTS_DIR, filename);
  if (existsSync(globalPath)) {
    try {
      return readFileSync(globalPath, "utf8");
    } catch {}
  }

  // 3. Built-in fallback
  const builtinPath = path.join(BUILTIN_PROMPTS_DIR, filename);
  if (existsSync(builtinPath)) {
    try {
      return readFileSync(builtinPath, "utf8");
    } catch {}
  }

  return "";
}

/**
 * Render template by interpolating `{key}` placeholders.
 *
 * @param {string} templateText
 * @param {Record<string, any>} vars
 * @returns {string}
 */
export function renderTemplate(templateText, vars = {}) {
  if (typeof templateText !== "string") return "";
  return templateText.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : "";
  });
}

/**
 * share/path.js — path utilities for home expansion and boundary checks.
 */
import path from "node:path";
import os from "node:os";

/**
 * Expand leading ~ or ~/ to user home directory.
 *
 * @param {string} filepath
 * @returns {string}
 */
export function expandHome(filepath) {
  if (!filepath || typeof filepath !== "string") return "";
  if (filepath === "~") return os.homedir();
  if (filepath.startsWith("~/") || filepath.startsWith("~\\")) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Normalize a filepath for reliable comparisons (resolves absolute path, lowercase on Windows).
 *
 * @param {string} filepath
 * @param {string} [cwd]
 * @returns {string}
 */
export function normalizeForCompare(filepath, cwd = process.cwd()) {
  if (!filepath || typeof filepath !== "string") return "";
  const expanded = expandHome(filepath);
  const resolved = path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(cwd, expanded);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/**
 * Check if targetPath is inside (or equals) parentDir.
 *
 * @param {string} parentDir
 * @param {string} targetPath
 * @param {string} [cwd]
 * @returns {boolean}
 */
export function isPathInside(parentDir, targetPath, cwd = process.cwd()) {
  if (!parentDir || !targetPath) return false;
  const normParent = normalizeForCompare(parentDir, cwd);
  const normTarget = normalizeForCompare(targetPath, cwd);

  if (normParent === normTarget) return true;

  const relative = path.relative(normParent, normTarget);
  return Boolean(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * share/path.js — path utilities for home expansion, boundary checks, and wildcard matching.
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
	const resolved = path.isAbsolute(expanded)
		? path.normalize(expanded)
		: path.resolve(cwd, expanded);
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
	return Boolean(
		relative && !relative.startsWith("..") && !path.isAbsolute(relative),
	);
}

/**
 * Convert a glob pattern into a regular expression.
 * Supports **, *, ?, and escapes standard regex characters.
 *
 * @param {string} pattern
 * @returns {RegExp}
 */
export function globToRegex(pattern) {
	if (!pattern || typeof pattern !== "string") return /^$/;
	let p = pattern.trim().split(path.sep).join("/");

	p = p.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	p = p.replace(/\/\*\*\/|\*\*\//g, "(?:/|.*/)");
	p = p.replace(/\*\*/g, ".*");
	p = p.replace(/(?<!\.)\*/g, "[^/]*");
	p = p.replace(/\?/g, "[^/]");

	return new RegExp(`^${p}$`, process.platform === "win32" ? "i" : "");
}

/**
 * Match a file path against a pattern (supports ~, **, *, relative, and basename).
 *
 * @param {string} pattern Glob pattern or path
 * @param {string} filePath File path to check
 * @param {string} [cwd] Working directory for relative resolution
 * @returns {boolean}
 */
export function matchPathPattern(pattern, filePath, cwd = process.cwd()) {
	if (!pattern || !filePath) return false;
	const normFile = normalizeForCompare(filePath, cwd).split(path.sep).join("/");
	const baseName = path.basename(normFile);
	const expandedPattern = expandHome(pattern.trim()).split(path.sep).join("/");

	// 1. If pattern has no slash (e.g. "*.pem", "auth.json", ".env*"): match against basename
	if (!pattern.includes("/") && !pattern.includes("\\")) {
		if (globToRegex(pattern).test(baseName)) return true;
	}

	// 2. If pattern starts with **/ (e.g. "**/.env*"): match basename or anywhere in path
	if (pattern.startsWith("**/")) {
		const basePattern = pattern.slice(3);
		if (!basePattern.includes("/") && globToRegex(basePattern).test(baseName)) {
			return true;
		}
		const subRe = new RegExp(globToRegex(pattern).source.slice(1));
		if (subRe.test(normFile)) return true;
	}

	// 3. Absolute or resolved match
	const normPattern = path.isAbsolute(expandedPattern)
		? expandedPattern
		: path.resolve(cwd, expandedPattern).split(path.sep).join("/");

	if (globToRegex(normPattern).test(normFile)) return true;
	if (globToRegex(expandedPattern).test(normFile)) return true;

	return false;
}

/**
 * Evaluate blacklist and whitelist ACL rules against a file path.
 *
 * @param {string} filePath
 * @param {object} acl
 * @param {string[]} [acl.blacklist]
 * @param {string[]} [acl.whitelist]
 * @param {string} [cwd]
 * @returns {boolean} True if blocked, false if allowed
 */
export function isPathBlocked(filePath, acl = {}, cwd = process.cwd()) {
	if (!filePath) return false;
	const blacklist = Array.isArray(acl?.blacklist) ? acl.blacklist : [];
	const whitelist = Array.isArray(acl?.whitelist) ? acl.whitelist : [];

	// 1. Check blacklist
	const isBlacklisted = blacklist.some((pat) =>
		matchPathPattern(pat, filePath, cwd),
	);
	if (!isBlacklisted) return false;

	// 2. Check whitelist (exceptions)
	const isWhitelisted = whitelist.some((pat) =>
		matchPathPattern(pat, filePath, cwd),
	);
	if (isWhitelisted) return false;

	return true;
}

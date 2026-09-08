/**
 * file-discovery.js — quick file path picker discovery helper.
 *
 * Resolves a flat list of project files for the Alt+P file picker dialog.
 * Tries git-tracked files first (fast, respects .gitignore), then falls back
 * to a BFS directory walk for non-git workspaces. Results are TTL-cached to
 * avoid re-scanning on every keystroke.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

// TTL cache: directory -> { files, expiresAt }. Keyed by resolved directory.
const cache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds

// Directories skipped during fallback walk (dependency/hash/build artifacts).
const IGNORED_DIRS = new Set([
	".git",
	"node_modules",
	"dist",
	"build",
	".next",
	"__pycache__",
	"target",
	"vendor",
	".turbo",
	".cache",
]);

/** Clear the in-memory discovery cache (for test isolation). */
export function clearDiscoveryCache() {
	cache.clear();
}

/** Normalize backslashes to POSIX separators for predictable output. */
function toPosix(relativePath) {
	return relativePath.split(path.sep).join("/");
}

/** Discover files via git ls-files (respects .gitignore and skip-worktree). */
function discoverWithGit(directory, maxFiles) {
	const result = spawnSync(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard"],
		{
			cwd: directory,
			encoding: "utf8",
			timeout: 5000,
			maxBuffer: 10 * 1024 * 1024,
		},
	);
	if (result.status !== 0 || !result.stdout) return null;

	return (
		// Split on newlines, trim whitespace, drop empty lines, then sort
		// before slicing so the top-N is deterministically alphabetical.
		result.stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.sort()
			.slice(0, maxFiles)
	);
}

/**
 * Fallback walk for non-git workspaces: BFS over directories, collecting
 * relative POSIX paths and skipping dependency/build artifact directories.
 */
function discoverWithWalk(directory, maxFiles) {
	const files = [];
	const queue = [directory];
	while (queue.length > 0 && files.length < maxFiles) {
		const dir = queue.shift();
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			// Unreadable entry (perm denied, deleted mid-walk) — skip it.
			continue;
		}
		for (const entry of entries) {
			if (files.length >= maxFiles) break;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!IGNORED_DIRS.has(entry.name)) queue.push(full);
				continue;
			}
			if (!entry.isFile()) continue;
			files.push(toPosix(path.relative(directory, full)));
		}
	}
	return files.sort();
}

/**
 * Discover project files under a directory, sorted alphabetically.
 *
 * Results are cached per directory for CACHE_TTL_MS. Returns an immutable
 * (frozen) array; falls back to `[]` on catastrophic failure.
 *
 * @param {string} directory Root directory to scan.
 * @param {object} [options]
 * @param {number} [options.maxFiles=10000] Maximum number of files to return.
 * @returns {string[]} Frozen array of file paths relative to `directory`.
 */
export function discoverFiles(directory, options = {}) {
	const maxFiles = options.maxFiles ?? 10000;
	let files;

	const now = Date.now();
	const cached = cache.get(directory);
	// Serve from cache while it is still fresh.
	if (cached && now < cached.expiresAt) {
		files = cached.files;
	} else {
		// Prefer git-tracked files for accuracy; walk as fallback.
		files =
			discoverWithGit(directory, maxFiles) ??
			discoverWithWalk(directory, maxFiles) ??
			[];
		cache.set(directory, { files, expiresAt: now + CACHE_TTL_MS });
	}

	// Freeze defensively so callers cannot mutate a cached array.
	return Object.freeze(files);
}

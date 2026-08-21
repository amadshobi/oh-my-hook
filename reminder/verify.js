/**
 * reminder/verify.js — post-edit quality checks, ported from the old
 * plugins/dev-loop.js: type check, lint, auto-fix, related tests, bundle
 * size. Also refreshes the read-ledger after auto-fix so read-guard
 * doesn't treat fixed files as stale.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { refreshReads } from "../sandbox/read-guard.js";
import { statOf } from "../share/state.js";
import { toolArgs, filePathOf } from "../share/hook.js";
import { createNotifier } from "../share/notify.js";

function run(cmd, args, opts = {}) {
	try {
		return {
			ok: true,
			output: execFileSync(cmd, args, {
				stdio: "pipe",
				timeout: opts.timeout ?? 30000,
				cwd: opts.cwd,
				encoding: "utf8",
				env: { ...process.env, NO_COLOR: "1" },
			}),
		};
	} catch (e) {
		const stderr = (e.stderr || e.stdout || "").toString();
		if (opts.silent) return { ok: false, error: stderr };
		return { ok: false, error: stderr, status: e.status };
	}
}

function runQuiet(cmd, args, opts = {}) {
	try {
		execFileSync(cmd, args, {
			stdio: "ignore",
			timeout: opts.timeout ?? 15000,
			cwd: opts.cwd,
		});
		return true;
	} catch {
		return false;
	}
}

const LINT_COMMANDS = {
	".ts": ["npx", ["eslint", "--no-error-on-unmatched-pattern"]],
	".tsx": ["npx", ["eslint", "--no-error-on-unmatched-pattern"]],
	".js": ["npx", ["eslint", "--no-error-on-unmatched-pattern"]],
	".jsx": ["npx", ["eslint", "--no-error-on-unmatched-pattern"]],
	".py": ["ruff", ["check"]],
	".go": ["go", ["vet"]],
	".rs": ["cargo", ["clippy", "--quiet"]],
};

const LINT_FIX_COMMANDS = {
	".ts": ["npx", ["eslint", "--fix", "--no-error-on-unmatched-pattern"]],
	".tsx": ["npx", ["eslint", "--fix", "--no-error-on-unmatched-pattern"]],
	".js": ["npx", ["eslint", "--fix", "--no-error-on-unmatched-pattern"]],
	".jsx": ["npx", ["eslint", "--fix", "--no-error-on-unmatched-pattern"]],
	".py": ["ruff", ["check", "--fix"]],
	".go": ["gofmt", ["-w"]],
	".rs": ["rustfmt", []],
	".css": ["npx", ["prettier", "--write"]],
	".scss": ["npx", ["prettier", "--write"]],
	".json": ["npx", ["prettier", "--write"]],
	".md": ["npx", ["prettier", "--write"]],
};

function findTsconfigDir(filePath) {
	let dir = path.dirname(filePath);
	let prev = null;
	while (dir !== prev) {
		if (existsSync(path.join(dir, "tsconfig.json"))) return dir;
		prev = dir;
		dir = path.dirname(dir);
	}
	return null;
}

function runTypeCheck(filePath) {
	const tsconfigDir = findTsconfigDir(filePath);
	if (!tsconfigDir) return { ok: true, note: "no tsconfig found" };

	const localTsc = path.join(
		tsconfigDir,
		"node_modules",
		".bin",
		process.platform === "win32" ? "tsc.cmd" : "tsc",
	);
	const cmd = existsSync(localTsc) ? localTsc : "npx";
	const args = existsSync(localTsc)
		? ["--noEmit", "--pretty"]
		: ["tsc", "--noEmit", "--pretty"];

	const result = run(cmd, args, {
		timeout: 60000,
		cwd: tsconfigDir,
		silent: true,
	});
	if (result.ok) return { ok: true };
	const output = result.error || "";
	const relevant = output
		.split("\n")
		.filter((line) => line.includes(path.basename(filePath)))
		.slice(0, 5)
		.join("\n");
	return { ok: false, error: relevant || output.slice(0, 500) };
}

const TEST_RUNNERS = {
	".ts": ["npx", ["vitest", "run"]],
	".tsx": ["npx", ["vitest", "run"]],
	".js": ["npx", ["jest", "--no-coverage"]],
	".jsx": ["npx", ["jest", "--no-coverage"]],
	".py": ["python", ["-m", "pytest", "-x", "-q"]],
	".go": ["go", ["test", "-v"]],
	".rs": ["cargo", ["test", "--quiet"]],
};

function findTestFile(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	const dir = path.dirname(filePath);
	const base = path.basename(filePath, ext);

	const patterns = [
		path.join(dir, `${base}.test${ext}`),
		path.join(dir, `${base}.spec${ext}`),
		path.join(dir, "__tests__", `${base}.test${ext}`),
		path.join(dir, "__tests__", `${base}${ext}`),
		path.join(
			dir
				.split(path.sep)
				.join("/")
				.replace("/src/", "/tests/")
				.split("/")
				.join(path.sep),
			`test_${base}.py`,
		),
	];
	return patterns.find((p) => existsSync(p));
}

function dirSize(dir) {
	let size = 0;
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) size += dirSize(full);
			else size += statSync(full).size;
		}
	} catch {}
	return size;
}

const BUNDLE_THRESHOLD_MB = 5;

export const verifyHooks = async ({ client, directory }, opts = {}) => {
	const enabled = opts?.config?.verify ?? true;
	const notify = createNotifier(client, "dev-loop", "info");

	return {
		"tool.execute.after": async (input, output) => {
			if (!enabled) return;
			const tool = input.tool;
			if (tool !== "write" && tool !== "edit") return;

			const sessionID = input?.sessionID || "global";
			const args = toolArgs(input, output);
			const filePath = filePathOf(args);
			if (!filePath) return;

			const ext = path.extname(filePath).toLowerCase();
			const cwd = directory || process.cwd();
			const fixedFiles = [];

			// --- type check (ts/tsx only) ---
			if (ext === ".ts" || ext === ".tsx") {
				const tc = runTypeCheck(filePath);
				if (!tc.ok) {
					output.metadata = {
						...(output.metadata || {}),
						typeCheck: { status: "fail", errors: tc.error },
					};
				}
			}

			// --- lint check ---
			const linter = LINT_COMMANDS[ext];
			if (linter) {
				const [cmd, argsList] = linter;
				const result = run(cmd, [...argsList, filePath], {
					timeout: 15000,
					cwd,
					silent: true,
				});
				if (!result.ok) {
					output.metadata = {
						...(output.metadata || {}),
						lint: {
							status: "issues",
							output: (result.error || "").slice(0, 500),
						},
					};
					await notify(`Lint issues in ${path.basename(filePath)}`);
				}
			}

			// --- auto-fix lint (track fixed files to refresh read-ledger) ---
			const fixer = LINT_FIX_COMMANDS[ext];
			if (fixer) {
				const [cmd, argsList] = fixer;
				const before = statOf(filePath);
				const ok = runQuiet(cmd, [...argsList, filePath], {
					timeout: 15000,
					cwd,
				});
				if (ok) {
					const after = statOf(filePath);
					if (
						!before ||
						before.mtimeMs !== after?.mtimeMs ||
						before.size !== after?.size
					) {
						fixedFiles.push(filePath);
					}
				}
			}

			// --- run related tests ---
			const testFile = findTestFile(filePath);
			if (testFile) {
				const runner = TEST_RUNNERS[ext];
				if (runner) {
					const [cmd, argsList] = runner;
					const result = run(cmd, [...argsList, testFile], {
						timeout: 30000,
						cwd,
						silent: true,
					});
					if (!result.ok) {
						output.metadata = {
							...(output.metadata || {}),
							tests: {
								status: "fail",
								output: (result.error || "").slice(0, 500),
							},
						};
					}
				}
			}

			// --- bundle size check ---
			if ([".ts", ".tsx", ".js", ".jsx", ".css", ".scss"].includes(ext)) {
				try {
					const pkg = JSON.parse(
						readFileSync(path.join(cwd, "package.json"), "utf8"),
					);
					const buildScript =
						pkg.scripts && (pkg.scripts.build || pkg.scripts["build:prod"]);
					if (buildScript) {
						const distDirs = ["dist", "build", ".next", "out"].map((d) =>
							path.join(cwd, d),
						);
						const distDir = distDirs.find((d) => existsSync(d));
						if (distDir) {
							const sizeMB = parseFloat(
								(dirSize(distDir) / 1024 / 1024).toFixed(2),
							);
							if (sizeMB > BUNDLE_THRESHOLD_MB) {
								output.metadata = {
									...(output.metadata || {}),
									bundle: {
										status: "warning",
										size: `${sizeMB}MB`,
										threshold: `${BUNDLE_THRESHOLD_MB}MB`,
									},
								};
								await notify(
									`Bundle size ${sizeMB}MB exceeds ${BUNDLE_THRESHOLD_MB}MB threshold`,
								);
							}
						}
					}
				} catch {}
			}

			// Refresh read-ledger for files auto-fixed by lint/formatter so the
			// next write isn't flagged as stale by read-guard.
			if (fixedFiles.length > 0) {
				refreshReads(fixedFiles, sessionID);
			}
		},
	};
};

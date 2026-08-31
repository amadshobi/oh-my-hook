/**
 * usage/store-db.js — dual-runtime SQLite adapter (Bun + Node).
 *
 * oh-my-hook is a zero-dependency ESM plugin. `bun:sqlite` crashes on Node
 * with ERR_MODULE_NOT_FOUND, so the adapter auto-detects the runtime and
 * loads the matching built-in: Bun's `bun:sqlite` or Node's `node:sqlite`
 * (DatabaseSync, stable since Node 23 / present in 22+).
 *
 * Databases are ALWAYS opened read-only — these files are owned by other
 * processes (omp agent / opencode) and we must never take write locks.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

/** Resolve the omp agent credentials DB (quota source). */
export function agentDbPath() {
	return join(homedir(), ".omp", "agent", "agent.db");
}

/** Resolve the opencode session DB (token tracking source). */
export function opencodeDbPath() {
	return join(homedir(), ".local", "share", "opencode", "opencode.db");
}

let cachedDatabase = null;

/**
 * Lazily resolve the runtime-appropriate Database class.
 * Dynamic import keeps `bun:sqlite` out of Node's static graph.
 *
 * @returns {Promise<typeof import("node:sqlite").DatabaseSync>}
 */
async function resolveDatabase() {
	if (cachedDatabase) return cachedDatabase;
	if (typeof Bun !== "undefined") {
		const mod = await import("bun:sqlite");
		cachedDatabase = mod.Database;
	} else {
		const mod = await import("node:sqlite");
		cachedDatabase = mod.DatabaseSync;
	}
	return cachedDatabase;
}

/**
 * Open a SQLite DB read-only.
 *
 * @param {string} dbPath Absolute path to the database file.
 * @returns {Promise<{ db: object, close: () => void }>} handle with db + close
 */
export async function openReadonly(dbPath) {
	// node:sqlite silently CREATES a missing file even with readonly:true —
	// guard explicitly so a missing DB surfaces a clear, actionable error.
	if (!existsSync(dbPath)) {
		throw new Error(
			`database file not found: "${dbPath}" (login to a provider first)`,
			{ cause: { code: "ENOENT" } },
		);
	}

	const Database = await resolveDatabase();
	let db;
	try {
		db = new Database(dbPath, { readonly: true });
	} catch (err) {
		throw new Error(`cannot open read-only DB "${dbPath}": ${err.message}`, {
			cause: err,
		});
	}
	return {
		db,
		close() {
			try {
				db.close();
			} catch {
				/* already closed — ignore */
			}
		},
	};
}

/**
 * Run a read-only query and return all rows.
 * `params` supported by node:sqlite positional binding; Bun accepts the same.
 *
 * @param {object} db Open SQLite db handle
 * @param {string} sql SQL string (SELECT only)
 * @param {Array<unknown>} [params] Positional bind params
 * @returns {unknown[]} rows
 */
export function queryAll(db, sql, params = []) {
	return db.prepare(sql).all(...params);
}

/**
 * Fetch a single row, or undefined when no match.
 *
 * @param {object} db Open SQLite db handle
 * @param {string} sql SQL string (SELECT only)
 * @param {Array<unknown>} [params] Positional bind params
 * @returns {object|undefined}
 */
export function queryOne(db, sql, params = []) {
	const rows = queryAll(db, sql, params);
	return rows.length > 0 ? rows[0] : undefined;
}

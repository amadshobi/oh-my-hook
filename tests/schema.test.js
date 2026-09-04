import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULTS, stripJsoncComments } from "../share/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, "../schemas/omh.schema.json");

test("schema file exists and is valid JSON", () => {
	assert.ok(existsSync(SCHEMA_PATH), "schemas/omh.schema.json must exist");
	const raw = readFileSync(SCHEMA_PATH, "utf8");
	const schema = JSON.parse(raw);
	assert.ok(schema && typeof schema === "object", "schema must be an object");
	assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
	assert.ok(schema.$id.includes("omh.schema.json"));
	assert.equal(schema.type, "object");
});

test("schema covers all DEFAULTS sections from share/config.js", () => {
	const raw = readFileSync(SCHEMA_PATH, "utf8");
	const schema = JSON.parse(raw);
	const schemaKeys = Object.keys(schema.properties);

	for (const defaultKey of Object.keys(DEFAULTS)) {
		assert.ok(
			schemaKeys.includes(defaultKey),
			`schema.properties must include key "${defaultKey}" from DEFAULTS`,
		);
	}
});

test("schema covers all modular and legacy sandbox properties", () => {
	const raw = readFileSync(SCHEMA_PATH, "utf8");
	const schema = JSON.parse(raw);
	const sandboxProps = schema.properties.sandbox.properties;

	const expected = [
		"enabled",
		"readGuard",
		"secretScanner",
		"secretScannerConfig",
		"commitGuard",
		"commitGuardConfig",
		"dangerousBash",
		"dangerousBashConfig",
		"devServerGuard",
		"devServerGuardConfig",
		"readBeforeWrite",
		"staleWrite",
	];

	for (const prop of expected) {
		assert.ok(
			prop in sandboxProps,
			`sandbox properties must include "${prop}"`,
		);
	}
});

test("active omh.jsonc conforms to known top-level schema properties", () => {
	const raw = readFileSync(SCHEMA_PATH, "utf8");
	const schema = JSON.parse(raw);
	const allowedKeys = new Set(["$schema", ...Object.keys(schema.properties)]);

	const configPath = path.join(
		process.env.HOME || "~",
		".config/opencode/omh.jsonc",
	);
	if (existsSync(configPath)) {
		const rawConfig = readFileSync(configPath, "utf8");
		const parsed = JSON.parse(stripJsoncComments(rawConfig));
		for (const key of Object.keys(parsed)) {
			assert.ok(
				allowedKeys.has(key),
				`Unknown top-level property "${key}" in ${configPath}`,
			);
		}
	}
});

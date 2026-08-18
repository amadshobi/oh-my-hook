import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { tokenize, buildIndex, scoreAll } from "../memory/matcher.js";
import { selectRules, formatSections, injectMemory } from "../memory/inject.js";
import { appendRule } from "../memory/rstore.js";

test("memory/matcher: tokenize removes stopwords and extracts keywords", () => {
	const tokens = tokenize("Jangan pernah memakai npm untuk build proyek ini");
	assert.ok(tokens.includes("jangan"));
	assert.ok(tokens.includes("pernah"));
	assert.ok(tokens.includes("memakai"));
	assert.ok(tokens.includes("npm"));
	assert.ok(tokens.includes("build"));
	assert.ok(tokens.includes("proyek"));
	// "untuk" & "ini" are stopwords, should be dropped
	assert.ok(!tokens.includes("untuk"));
	assert.ok(!tokens.includes("ini"));
});

test("memory/matcher: scoreAll finds relevant rules with BM25", () => {
	const rules = [
		{
			id: "psk_1",
			category: "project_skill",
			triggers: ["vitest", "unit", "test"],
			content: "Selalu tambahkan flag --run saat menjalankan vitest",
			rationale: "Mencegah CI hang",
			status: "active",
			confidence: 0.9,
		},
		{
			id: "prf_1",
			category: "preference",
			triggers: ["boss", "gaya", "komunikasi"],
			content: "Panggil user dengan sebutan BOSS",
			status: "active",
			confidence: 0.8,
		},
		{
			id: "ssk_1",
			category: "shared_skill",
			triggers: ["docker", "container", "compose"],
			content: "Gunakan multi-stage build untuk Dockerfile",
			status: "active",
			confidence: 0.7,
		},
	];

	const testQuery = "tolong jalankan vitest test";
	const scored = scoreAll(testQuery, rules);

	assert.ok(scored.length >= 1);
	assert.equal(scored[0].rule.id, "psk_1");
	assert.ok(scored[0].score > 0.5);

	const selected = selectRules(scored, { topK: 3 });
	assert.equal(selected.length, 1);
	assert.equal(selected[0].id, "psk_1");
});

test("memory/inject: formatSections outputs structured markdown", () => {
	const sampleRules = [
		{
			category: "preference",
			content: "Panggil user BOSS",
		},
		{
			category: "project_skill",
			content: "Selalu gunakan bun test",
			rationale: "Lebih cepat dari node",
		},
	];

	const formatted = formatSections(sampleRules);
	assert.ok(formatted.includes("# Active Learned Memory"));
	assert.ok(formatted.includes("### Preferences (User Habits)"));
	assert.ok(formatted.includes("- Panggil user BOSS"));
	assert.ok(formatted.includes("### Project SOP & Rules"));
	assert.ok(
		formatted.includes(
			"- Selalu gunakan bun test *(Alasan: Lebih cepat dari node)*",
		),
	);
});

test("memory/inject: injectMemory falls back gracefully and retrieves relevant rules", () => {
	const tempDir = path.join(os.tmpdir(), "omh-inject-test-" + Date.now());
	process.env.OMH_MEMORY_ROOT = tempDir;

	try {
		appendRule({
			category: "project_skill",
			content: "Wajib jalankan linter sebelum commit",
			triggers: ["lint", "eslint", "commit"],
			scope: "project",
			project: "path/to/my-project",
		});

		const result = injectMemory({
			directory: "/path/to/my-project",
			query: "saya mau commit perubahan eslint",
		});

		assert.equal(result.count, 1);
		assert.ok(result.text.includes("Wajib jalankan linter"));
		assert.ok(result.hitIds.length === 1);
	} finally {
		delete process.env.OMH_MEMORY_ROOT;
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch {}
	}
});

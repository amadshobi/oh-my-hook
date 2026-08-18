import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
	jaccard,
	hasNegation,
	mergeRule,
	parseRulesJSON,
} from "../memory/distill.js";
import { listRules } from "../memory/rstore.js";

test("memory/distill: jaccard similarity calculation", () => {
	const sim1 = jaccard(
		"gunakan pnpm untuk instalasi",
		"selalu gunakan pnpm untuk instalasi package",
	);
	assert.ok(sim1 > 0.4);

	const sim2 = jaccard("makan nasi goreng", "deploy kubernetes cluster");
	assert.equal(sim2, 0);
});

test("memory/distill: hasNegation detects negative constraints", () => {
	assert.equal(hasNegation("Jangan sentuh folder dist"), true);
	assert.equal(hasNegation("Don't write console log"), true);
	assert.equal(hasNegation("Gunakan kebab case"), false);
});

test("memory/distill: parseRulesJSON handles raw AI JSON arrays cleanly", () => {
	const rawAiText = `
Tentu BOSS! Berikut adalah rules hasil ekstraksi:
[
  {
    "category": "project_skill",
    "content": "Selalu tambahkan flag --run pada vitest",
    "triggers": ["vitest", "test", "run"],
    "rationale": "Mencegah hang di CI"
  }
]
Semoga membantu!
  `;

	const parsed = parseRulesJSON(rawAiText);
	assert.equal(parsed.length, 1);
	assert.equal(parsed[0].category, "project_skill");
	assert.equal(parsed[0].content, "Selalu tambahkan flag --run pada vitest");
});

test("memory/distill: mergeRule supersedes contradicted rules and merges similar ones", () => {
	const tempDir = path.join(os.tmpdir(), "omh-distill-test-" + Date.now());
	process.env.OMH_MEMORY_ROOT = tempDir;

	try {
		// 1. Initial rule: use npm
		const res1 = mergeRule({
			category: "project_skill",
			content: "Gunakan npm untuk build proyek",
			scope: "global",
		});
		assert.equal(res1.action, "appended");

		// 2. Similar rule: update / merge
		const res2 = mergeRule({
			category: "project_skill",
			content: "Gunakan npm run build untuk build proyek",
			scope: "global",
		});
		assert.equal(res2.action, "merged");

		// 3. Contradictory rule: jangan pakai npm
		const res3 = mergeRule({
			category: "project_skill",
			content: "Jangan gunakan npm untuk build proyek",
			scope: "global",
		});
		assert.equal(res3.action, "superseded");

		const active = listRules({ activeOnly: true });
		assert.equal(active.length, 1);
		assert.ok(active[0].content.includes("Jangan gunakan npm"));
	} finally {
		delete process.env.OMH_MEMORY_ROOT;
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch {}
	}
});

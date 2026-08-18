import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
	CATEGORIES,
	fnv1a,
	newRuleId,
	extractTriggers,
	classifyCategory,
	normalizeRule,
	isValidRule,
} from "../memory/schema.js";

import {
	getRulesRoot,
	rulesFile,
	listRules,
	appendRule,
	updateRule,
	removeRule,
	loadMeta,
	saveMeta,
	enqueueJob,
	dequeueJobs,
	markJobDone,
} from "../memory/rstore.js";

test("memory/schema: fnv1a & newRuleId determinism", () => {
	const id1 = fnv1a("test-hash-value");
	const id2 = fnv1a("test-hash-value");
	assert.equal(id1, id2);
	assert.equal(id1.length, 8);

	const rule = {
		category: "preference",
		content: "selalu gunakan pnpm",
		project: null,
	};
	const rId1 = newRuleId(rule);
	const rId2 = newRuleId(rule);
	assert.equal(rId1, rId2);
	assert.ok(rId1.startsWith("prf_"));
});

test("memory/schema: extractTriggers & classifyCategory", () => {
	const triggers = extractTriggers(
		"Selalu gunakan vitest untuk unit test di repo ini",
	);
	assert.ok(triggers.includes("vitest"));
	assert.ok(triggers.includes("unit"));
	assert.ok(triggers.includes("test"));

	assert.equal(
		classifyCategory("Saya lebih suka jawaban singkat dan to the point"),
		"preference",
	);
	assert.equal(
		classifyCategory("Di repo ini build wajib pakai make all"),
		"project_skill",
	);
	assert.equal(
		classifyCategory("Gunakan immutability untuk state management"),
		"shared_skill",
	);
});

test("memory/schema: normalizeRule & isValidRule", () => {
	const norm = normalizeRule({
		content: "  Gunakan kebab-case untuk file   ",
		category: "shared_skill",
	});

	assert.equal(norm.content, "Gunakan kebab-case untuk file");
	assert.equal(norm.category, "shared_skill");
	assert.ok(isValidRule(norm));
	assert.equal(norm.status, "active");
	assert.equal(norm.confidence, 0.5);
});

test("memory/rstore: full CRUD operations on isolated temp dir", () => {
	const tempDir = path.join(os.tmpdir(), "omh-rstore-test-" + Date.now());
	process.env.OMH_MEMORY_ROOT = tempDir;

	try {
		// 1. Append preference
		const pRule = appendRule({
			category: "preference",
			content: "Selalu panggil saya BOSS",
			scope: "global",
		});
		assert.ok(pRule.id.startsWith("prf_"));

		// 2. Append project skill
		const sRule = appendRule({
			category: "project_skill",
			content: "Jangan edit file dist secara langsung",
			scope: "project",
			project: "my-app-slug",
		});
		assert.ok(sRule.id.startsWith("psk_"));

		// 3. List rules
		const all = listRules({ projectSlug: "my-app-slug" });
		assert.equal(all.length, 2);

		// 4. Update rule
		const updated = updateRule(pRule.id, { confidence: 0.9, hits: 5 });
		assert.equal(updated.confidence, 0.9);
		assert.equal(updated.hits, 5);

		// 5. Remove rule (soft delete)
		const removed = removeRule(sRule.id);
		assert.equal(removed, true);

		const activeRules = listRules({
			projectSlug: "my-app-slug",
			activeOnly: true,
		});
		assert.equal(activeRules.length, 1);
		assert.equal(activeRules[0].id, pRule.id);

		// 6. Meta
		saveMeta({ customKey: "test-meta-value" });
		const meta = loadMeta();
		assert.equal(meta.customKey, "test-meta-value");

		// 7. Queue jobs
		const job = enqueueJob({ type: "distill", sessionID: "ses-123" });
		assert.ok(job.id.startsWith("job_"));

		const pending = dequeueJobs(5);
		assert.equal(pending.length, 1);
		assert.equal(pending[0].id, job.id);

		markJobDone(job.id);
		const pendingAfter = dequeueJobs(5);
		assert.equal(pendingAfter.length, 0);
	} finally {
		delete process.env.OMH_MEMORY_ROOT;
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch {}
	}
});

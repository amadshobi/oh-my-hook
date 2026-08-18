import test from "node:test";
import assert from "node:assert/strict";

import { analyzeUserMessage, shouldQueue } from "../memory/detect.js";
import { sessionTracker } from "../memory/ctx.js";

test("memory/detect: recognizes Indonesian correction & prohibition signals", () => {
	const s1 = analyzeUserMessage("jangan pakai npm ya, di repo ini wajib pnpm");
	assert.equal(s1.kind, "correction");
	assert.equal(s1.label, "prohibition_id");
	assert.ok(shouldQueue(s1));

	const s2 = analyzeUserMessage("bukan begitu, harusnya import dari subpath");
	assert.equal(s2.kind, "correction");
	assert.equal(s2.label, "correction_id");
	assert.ok(shouldQueue(s2));
});

test("memory/detect: recognizes English correction & success signals", () => {
	const s1 = analyzeUserMessage("don't use webpack here");
	assert.equal(s1.kind, "correction");
	assert.equal(s1.label, "prohibition_en");

	const s2 = analyzeUserMessage("mantap bagus banget hasilnya");
	assert.equal(s2.kind, "success");
	assert.equal(s2.label, "success_confirmation");
	assert.equal(shouldQueue(s2), false); // success doesn't queue distill
});

test("memory/ctx: tracks session query context accurately", () => {
	const sid = "test-session-ctx-" + Date.now();

	sessionTracker.record(sid, { userMessage: "tolong perbaiki bug di login" });
	sessionTracker.record(sid, { toolName: "read" });
	sessionTracker.record(sid, { filePath: "/src/auth/login.ts" });

	const query = sessionTracker.getQuery(sid);
	assert.ok(query.includes("tolong perbaiki bug di login"));
	assert.ok(query.includes("read"));
	assert.ok(query.includes("login.ts"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
	interpolate,
	resolveMessage,
	formatBlockMessage,
	formatWarnMessage,
	DEFAULT_MESSAGES,
} from "../share/messages.js";

test("interpolate replaces placeholders correctly", () => {
	const tpl = "Tool {tool} on {file} failed: {reason}";
	const res = interpolate(tpl, {
		tool: "edit",
		file: "foo.js",
		reason: "syntax error",
	});
	assert.equal(res, "Tool edit on foo.js failed: syntax error");
});

test("interpolate handles missing placeholders gracefully", () => {
	const tpl = "Hello {name}, your code {file}";
	const res = interpolate(tpl, { name: "Alice" });
	assert.equal(res, "Hello Alice, your code {file}");
});

test("resolveMessage returns default when no override exists", () => {
	const msg = resolveMessage("readGuardUnread", { file: "src/app.js" });
	assert.equal(msg.title, DEFAULT_MESSAGES.readGuardUnread.title);
	assert.ok(msg.reason.includes("src/app.js"));
	assert.equal(msg.suggestion, DEFAULT_MESSAGES.readGuardUnread.suggestion);
});

test("resolveMessage supports string override (replaces reason)", () => {
	const config = {
		messages: {
			dangerousBash: "Aksi '{command}' terlarang di server ini.",
		},
	};
	const msg = resolveMessage("dangerousBash", { command: "rm -rf /" }, config);
	assert.equal(msg.title, DEFAULT_MESSAGES.dangerousBash.title);
	assert.equal(msg.reason, "Aksi 'rm -rf /' terlarang di server ini.");
	assert.equal(msg.suggestion, DEFAULT_MESSAGES.dangerousBash.suggestion);
});

test("resolveMessage supports structured object override", () => {
	const config = {
		messages: {
			secretDetected: {
				title: "API Key Terbuka!",
				suggestion: "Simpan token di vault.",
			},
		},
	};
	const msg = resolveMessage(
		"secretDetected",
		{ detail: "Line 10: GitHub Token" },
		config,
	);
	assert.equal(msg.title, "API Key Terbuka!");
	assert.ok(msg.reason.includes("Line 10: GitHub Token"));
	assert.equal(msg.suggestion, "Simpan token di vault.");
});

test("resolveMessage supports external file override via {file:...}", () => {
	const tmpDir = path.join(os.tmpdir(), `omh-test-${Date.now()}`);
	mkdirSync(tmpDir, { recursive: true });
	const mdFile = path.join(tmpDir, "custom-plan.md");
	writeFileSync(mdFile, "Dilarang modifikasi {tool} saat sesi review!");

	try {
		const config = {
			messages: {
				modePlanTool: `{file:${mdFile}}`,
			},
		};
		const msg = resolveMessage(
			"modePlanTool",
			{ tool: "write", target: "index.js" },
			config,
		);
		assert.equal(msg.title, DEFAULT_MESSAGES.modePlanTool.title);
		assert.equal(msg.reason, "Dilarang modifikasi write saat sesi review!");
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("resolveMessage supports external JSON file override via {file:...}", () => {
	const tmpDir = path.join(os.tmpdir(), `omh-test-json-${Date.now()}`);
	mkdirSync(tmpDir, { recursive: true });
	const jsonFile = path.join(tmpDir, "custom-guard.json");
	writeFileSync(
		jsonFile,
		JSON.stringify({
			title: "Custom Title",
			reason: "Custom Reason for {file}",
			suggestion: "Custom Hint",
		}),
	);

	try {
		const config = {
			messages: {
				readGuardStale: `{file:${jsonFile}}`,
			},
		};
		const msg = resolveMessage("readGuardStale", { file: "test.js" }, config);
		assert.equal(msg.title, "Custom Title");
		assert.equal(msg.reason, "Custom Reason for test.js");
		assert.equal(msg.suggestion, "Custom Hint");
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("formatBlockMessage and formatWarnMessage output proper guardrail formatting", () => {
	const block = formatBlockMessage("commitGuard", {
		reason: "Need feat/fix prefix",
	});
	assert.ok(block.includes("🚫 Invalid Commit Format"));
	assert.ok(block.includes("Need feat/fix prefix"));

	const warn = formatWarnMessage("strayMarkdown", { file: "notes.md" });
	assert.ok(warn.includes("⚠️ Non-standard Markdown"));
	assert.ok(warn.includes("notes.md"));
});

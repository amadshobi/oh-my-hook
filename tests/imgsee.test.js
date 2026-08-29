/**
 * tests/imgsee.test.js — Unit & integration tests for imgsee module.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { sniffImageMime, loadImage } from "../imgsee/loader.js";
import { optimizeImage } from "../imgsee/resizer.js";
import { executeImgseeTool, createImgseeTool } from "../imgsee/tool.js";
import { imgseeModule } from "../imgsee/index.js";

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");

test("imgsee: sniffImageMime accurately detects supported image formats", () => {
	// PNG signature: 89 50 4E 47
	const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	assert.equal(sniffImageMime(pngBuf), "image/png");

	// JPEG signature: FF D8 FF
	const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
	assert.equal(sniffImageMime(jpegBuf), "image/jpeg");

	// GIF signature: 47 49 46 38
	const gifBuf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
	assert.equal(sniffImageMime(gifBuf), "image/gif");

	// WEBP signature: RIFF....WEBP
	const webpBuf = Buffer.concat([
		Buffer.from("RIFF", "ascii"),
		Buffer.from([0x00, 0x00, 0x00, 0x00]),
		Buffer.from("WEBP", "ascii"),
	]);
	assert.equal(sniffImageMime(webpBuf), "image/webp");

	// Text / Non-image:
	const txtBuf = Buffer.from("Hello world, not an image!");
	assert.equal(sniffImageMime(txtBuf), null);
});

test("imgsee: loadImage handles missing files and format sniffing correctly", async () => {
	if (!existsSync(FIXTURES_DIR)) {
		mkdirSync(FIXTURES_DIR, { recursive: true });
	}

	// 1. Missing file error
	await assert.rejects(
		async () => {
			await loadImage("non-existent-image-12345.png");
		},
		{
			message: /Image file not found/,
		},
	);

	// 2. Directory path error
	await assert.rejects(
		async () => {
			await loadImage(FIXTURES_DIR);
		},
		{
			message: /Target path is a directory/,
		},
	);

	// 3. Valid PNG fixture
	const dummyPngPath = path.join(FIXTURES_DIR, "test-dummy.png");
	const pngHeader = Buffer.from([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
	]);
	writeFileSync(dummyPngPath, pngHeader);

	try {
		const res = await loadImage(dummyPngPath);
		assert.equal(res.mime, "image/png");
		assert.equal(res.size, 10);
		assert.equal(res.resolvedPath, dummyPngPath);
	} finally {
		if (existsSync(dummyPngPath)) unlinkSync(dummyPngPath);
	}
});

test("imgsee: optimizeImage verifies buffer byte budget", () => {
	const smallBuf = Buffer.alloc(1024);
	const resSmall = optimizeImage(smallBuf, { maxBytes: 5000 });
	assert.equal(resSmall.isOversized, false);
	assert.equal(resSmall.bytes, 1024);

	const bigBuf = Buffer.alloc(10000);
	const resBig = optimizeImage(bigBuf, { maxBytes: 5000 });
	assert.equal(resBig.isOversized, true);
	assert.equal(resBig.bytes, 10000);
});

test("imgsee: tool creation and execution validation", async () => {
	const toolDef = createImgseeTool();
	assert.ok(
		toolDef.description.includes("INSPECT, DESCRIBE, AND ANALYZE IMAGES"),
	);
	assert.ok(toolDef.args.path);

	// Missing path error in execution
	const errRes = await executeImgseeTool({});
	assert.ok(errRes.output.includes("Error: `path` parameter is required"));
});

test("imgsee: module factory registers tool, command, and system prompt guidance", async () => {
	const mod = await imgseeModule(
		{ directory: process.cwd() },
		{ config: { imgsee: { enabled: true } } },
	);

	// Tool registered
	assert.ok(mod.tool?.imgsee);

	// Slash command registered in config hook
	const cfg = {};
	await mod.config(cfg);
	assert.ok(cfg.command?.imgsee);
	assert.equal(cfg.command.imgsee.template, "/imgsee $ARGUMENTS");

	// System prompt injected for main session
	const sysOutput = { system: [] };
	await mod["experimental.chat.system.transform"](
		{ sessionID: "s1", model: {} },
		sysOutput,
	);
	assert.ok(
		sysOutput.system.some((s) => s.includes("VISION & IMAGE INSPECTION RULE")),
	);
});

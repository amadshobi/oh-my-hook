import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
	queryMemoryGateway,
	analyzeTurnReview,
	distillTranscript,
} from "../memory/client.js";

function createMockGateway(handler) {
	const server = http.createServer(handler);
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const port = server.address().port;
			resolve({
				url: `http://127.0.0.1:${port}/v1/chat/completions`,
				close: () => new Promise((res) => server.close(res)),
			});
		});
	});
}

test("memory/client: queryMemoryGateway sends OpenAI-compatible payload and parses response", async () => {
	const server = await createMockGateway((req, res) => {
		let body = "";
		req.on("data", (chunk) => (body += chunk));
		req.on("end", () => {
			const parsed = JSON.parse(body);
			assert.equal(parsed.model, "test-model");
			assert.equal(parsed.messages[0].content, "Hello");

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					choices: [{ message: { content: "Gateway response text" } }],
				}),
			);
		});
	});

	try {
		const out = await queryMemoryGateway({
			messages: [{ role: "user", content: "Hello" }],
			gatewayUrl: server.url,
			model: "test-model",
			apiKey: "test-key",
		});
		assert.equal(out, "Gateway response text");
	} finally {
		await server.close();
	}
});

test("memory/client: analyzeTurnReview parses JSON operations from markdown code blocks", async () => {
	const server = await createMockGateway((req, res) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				choices: [
					{
						message: {
							content:
								"```json\n" +
								JSON.stringify({
									operations: [
										{
											action: "add",
											target: "user",
											content: "Panggil user dengan sebutan BOSS",
										},
									],
								}) +
								"\n```",
						},
					},
				],
			}),
		);
	});

	try {
		const ops = await analyzeTurnReview("User: panggil saya BOSS", {
			gatewayUrl: server.url,
			model: "test-model",
		});

		assert.equal(ops.length, 1);
		assert.equal(ops[0].action, "add");
		assert.equal(ops[0].target, "user");
		assert.equal(ops[0].content, "Panggil user dengan sebutan BOSS");
	} finally {
		await server.close();
	}
});

test("memory/client: analyzeTurnReview returns empty array on invalid JSON or no changes", async () => {
	const server = await createMockGateway((req, res) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				choices: [{ message: { content: "No new facts found." } }],
			}),
		);
	});

	try {
		const ops = await analyzeTurnReview("User: hello\nAssistant: hi", {
			gatewayUrl: server.url,
		});
		assert.deepEqual(ops, []);
	} finally {
		await server.close();
	}
});

test("memory/client: distillTranscript parses bullet points", async () => {
	const server = await createMockGateway((req, res) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				choices: [
					{
						message: {
							content:
								"- Rule 1: Zero external dependencies in core logic\n" +
								"- Rule 2: Conventional commits with trailer\n" +
								"- Rule 3: Use Bun test when present\n",
						},
					},
				],
			}),
		);
	});

	try {
		const bullets = await distillTranscript("Some session transcript", {
			gatewayUrl: server.url,
			maxBullets: 2,
		});

		assert.equal(bullets.length, 2);
		assert.equal(
			bullets[0],
			"Rule 1: Zero external dependencies in core logic",
		);
		assert.equal(bullets[1], "Rule 2: Conventional commits with trailer");
	} finally {
		await server.close();
	}
});

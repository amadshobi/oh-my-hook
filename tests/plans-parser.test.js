import test from "node:test";
import assert from "node:assert/strict";
import { parsePlanLines, formatReviewFeedback } from "../plans/parser.js";

test("parsePlanLines parses headings, lists, code, and text lines with 1-based index", () => {
	const md = `# Arsitektur Auth
Berikut langkahnya:
- [ ] 1. Setup schema
- 2. Implement JWT

\`\`\`js
const a = 1;
\`\`\`
> catatan penting`;

	const lines = parsePlanLines(md);
	assert.equal(lines.length, 9);
	assert.equal(lines[0].index, 1);
	assert.equal(lines[0].type, "heading");
	assert.equal(lines[0].raw, "# Arsitektur Auth");

	assert.equal(lines[2].type, "checkbox");
	assert.equal(lines[3].type, "bullet");
	assert.equal(lines[5].type, "code-fence");
	assert.equal(lines[6].type, "code");
	assert.equal(lines[8].type, "blockquote");
});

test("formatReviewFeedback formats approved review without comments", () => {
	const output = formatReviewFeedback({
		planName: "auth-system",
		planFile: "/tmp/auth.md",
		approved: true,
		comments: [],
	});

	assert.ok(output.includes("APPROVED"));
	assert.ok(output.includes("auth-system"));
});

test("formatReviewFeedback formats line-level comments and revisions", () => {
	const output = formatReviewFeedback({
		planName: "payment-gateway",
		planFile: "/tmp/payment.md",
		comments: [
			{
				line: 3,
				lineText: "Use MongoDB for transactions",
				comment: "Do not use MongoDB, use PostgreSQL with Prisma instead!",
			},
		],
	});

	assert.ok(output.includes("REVISION NEEDED"));
	assert.ok(output.includes("Line 3:"));
	assert.ok(output.includes("Do not use MongoDB, use PostgreSQL"));
});

/**
 * plans/parser.js — Line-level markdown parser and review feedback generator.
 *
 * Supports arbitrary markdown structures (headers, paragraphs, lists, code blocks, tables).
 */

/**
 * Parses markdown into indexed lines for navigation and contextual annotation.
 * @param {string} markdown
 * @returns {Array<{ index: number, raw: string, type: string, indent: number }>}
 */
export function parsePlanLines(markdown) {
	if (!markdown || typeof markdown !== "string") return [];
	const rawLines = markdown.split("\n");
	let inCodeBlock = false;

	return rawLines.map((line, idx) => {
		const trimmed = line.trim();
		let type = "text";

		if (trimmed.startsWith("```")) {
			inCodeBlock = !inCodeBlock;
			type = "code-fence";
		} else if (inCodeBlock) {
			type = "code";
		} else if (trimmed === "") {
			type = "blank";
		} else if (/^#{1,6}\s+/.test(trimmed)) {
			type = "heading";
		} else if (/^[-*+]\s+\[[ xX]\]\s+/.test(trimmed)) {
			type = "checkbox";
		} else if (/^[-*+]\s+/.test(trimmed)) {
			type = "bullet";
		} else if (/^\d+\.\s+/.test(trimmed)) {
			type = "numbered-list";
		} else if (trimmed.startsWith(">")) {
			type = "blockquote";
		} else if (trimmed.startsWith("|")) {
			type = "table";
		}

		const indent = line.length - line.trimStart().length;

		return {
			index: idx + 1, // 1-based index
			raw: line,
			type,
			indent,
		};
	});
}

/**
 * Formats user review decisions and line annotations into structured feedback for the agent.
 *
 * @param {object} opts
 * @param {string} opts.planName
 * @param {string} [opts.planFile]
 * @param {Array<{ line: number, lineText: string, comment: string }>} [opts.comments]
 * @param {boolean} [opts.approved]
 * @returns {string}
 */
export function formatReviewFeedback({
	planName = "Plan",
	planFile = "",
	comments = [],
	approved = true,
} = {}) {
	const activeComments = Array.isArray(comments)
		? comments.filter(
				(c) => c && typeof c.comment === "string" && c.comment.trim(),
			)
		: [];

	const parts = [];
	parts.push(`# 📋 Plan Review: \`${planName}\``);
	if (planFile) {
		parts.push(`*File*: \`${planFile}\`\n`);
	}

	if (activeComments.length === 0) {
		if (approved) {
			parts.push(
				"✅ **Status: APPROVED**\n\n" +
					"Plan approved by user. Proceed with code implementation.",
			);
		} else {
			parts.push(
				"⏸️ **Status: CANCELLED**\n\n" +
					"Plan review was cancelled. Do not modify project code.",
			);
		}
		return parts.join("\n");
	}

	// With line-level corrections
	parts.push(
		"⚠️ **Status: REVISION NEEDED**\n\n" +
			"User provided corrections on specific lines:\n",
	);

	for (const c of activeComments) {
		parts.push(
			`### 📌 Line ${c.line}:\n` +
				`> \`${c.lineText.trim() || "(blank line)"}\`\n\n` +
				`💬 **User Note**: **${c.comment.trim()}**\n`,
		);
	}

	parts.push(
		"---\n" +
			"**Directives for Agent**:\n" +
			"1. Update the plan document (`" +
			(planFile || planName) +
			"`) addressing all corrections above.\n" +
			"2. Notify user when revised plan is ready for re-review.",
	);

	return parts.join("\n");
}

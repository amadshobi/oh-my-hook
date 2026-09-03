/**
 * compress/template.js — Standard Compaction Schema for OpenCode.
 *
 * Replaces the rigid default template with Hermes-inspired 8-section handoff.
 * Engineered for zero amnesia across long multi-turn sessions:
 * - Explicit constraints & user directives
 * - Key architectural & implementation decisions
 * - Concrete blockers & unresolved bugs
 * - Exact relevant file paths & symbols
 */

export const HERMES_COMPACTION_PROMPT_PREFIX = `You are an expert context compaction specialist.
Your task is to produce a high-density, lossless technical handoff from the conversation history.
Another coding agent will receive ONLY this handoff and recent messages to continue the session.
Preserve exact code symbols, file paths, error messages, and user decisions.`;

export const HERMES_SUMMARY_TEMPLATE = `Output exactly the Markdown structure shown inside <template> and keep the section order unchanged. Do not include the <template> tags in your response.
<template>
## Goal
- [one or two concise sentences defining the core objective and what user wants to achieve]

## Constraints & Preferences
- [all user directives, workflow rules, stylistic constraints, or architectural boundaries]

## Key Decisions
- [critical technical choices, libraries selected/rejected, and the rationale behind them]

## Completed Actions
- [verified changes, tests passed, files created/deleted/edited, or confirmed facts]

## Active State
- [current task being worked on, partial edits, or active exploration focus]

## Blocked
- [failing tests, runtime errors, unresolved bugs, or blockers; otherwise "(none)"]

## Relevant Files
- [file path: concise note on its role or why it matters, or "(none)"]

## Next Steps
1. [immediate concrete next action]
2. [subsequent follow-up step if known]
</template>

Rules:
- Keep every section, even when empty (use "(none)").
- Use dense, technical bullets — avoid conversational fluff.
- Preserve exact file paths, error strings, shell commands, and IDs.
- Do not mention the compaction process itself.`;

export const HERMES_UPDATE_INSTRUCTIONS = `The <prior-summary> captures everything that happened before <conversation>. Construct a unified handoff combining both.
The <prior-summary> is discarded after this: anything not carried forward is permanently lost.

When combining:
- Carry forward active goals, user constraints, and key decisions from <prior-summary> even if not mentioned in <conversation>.
- Where <conversation> conflicts with <prior-summary>, <conversation> wins: update the state and discard stale facts.
- Move completed items to "Completed Actions".
- Update "Active State", "Blocked", and "Next Steps" to match the current turn.`;

/**
 * Build a full compaction prompt given prior summary and conversation context.
 */
export function buildHermesCompactionPrompt({ previousSummary, conversation }) {
	const parts = [
		HERMES_COMPACTION_PROMPT_PREFIX,
		"",
		`Here is the conversation so far:`,
		"",
		`<conversation>`,
		conversation || "",
		`</conversation>`,
		"",
	];

	if (previousSummary) {
		parts.push(
			`Here is the summary of the conversation before <conversation>:`,
			"",
			`<prior-summary>`,
			previousSummary,
			`</prior-summary>`,
			"",
			HERMES_UPDATE_INSTRUCTIONS,
			"",
		);
	} else {
		parts.push(
			"Create a comprehensive handoff summary from the conversation history in the <conversation> tags above.",
			"",
		);
	}

	parts.push(HERMES_SUMMARY_TEMPLATE);

	return parts.join("\n");
}

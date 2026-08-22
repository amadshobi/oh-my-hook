/**
 * plans/commands.js — parses slash command arguments for /plan, /design, /approve, /mode.
 */

/**
 * Parse arguments for `/plan` or `/design`.
 *
 * Syntax supported:
 *   1. `to-file <name> [notes...]` or `--file <name> [notes...]` -> File creation mode
 *   2. `review [name...]` -> Interactive line review mode
 *   3. `list` -> List existing plans
 *   4. `switch <name>` -> Switch active plan file
 *   5. `[topic...]` -> In-chat ephemeral planning
 *
 * @param {string} argsString
 * @param {"plan"|"design"} [kind="plan"]
 * @returns {{
 *   mode: "file"|"chat"|"review"|"list"|"switch",
 *   name?: string,
 *   topic: string,
 *   kind: "plan"|"design"
 * }}
 */
export function parsePlanningCommand(argsString = "", kind = "plan") {
	const trimmed = argsString.trim();
	if (!trimmed) {
		return { mode: "chat", topic: "", kind };
	}

	const parts = trimmed.split(/\s+/);
	const first = parts[0].toLowerCase();

	if (
		first === "to-file" ||
		first === "to_file" ||
		first === "--file" ||
		first === "-f"
	) {
		const name = parts[1] || `${kind}-${Date.now()}`;
		const topic = parts.slice(2).join(" ").trim();
		return {
			mode: "file",
			name,
			topic,
			kind,
		};
	}

	if (first === "review") {
		const name = parts[1] || "";
		return {
			mode: "review",
			name,
			topic: parts.slice(2).join(" ").trim(),
			kind,
		};
	}

	if (first === "list") {
		return {
			mode: "list",
			topic: "",
			kind,
		};
	}

	if (first === "switch") {
		const name = parts[1] || "";
		return {
			mode: "switch",
			name,
			topic: "",
			kind,
		};
	}

	return {
		mode: "chat",
		topic: trimmed,
		kind,
	};
}

/**
 * Parse arguments for `/approve` or `/exec`.
 *
 * @param {string} argsString
 * @returns {{ notes: string }}
 */
export function parseApproveCommand(argsString = "") {
	return {
		notes: argsString.trim(),
	};
}

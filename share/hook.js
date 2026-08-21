/**
 * hook.js — helpers to read tool arguments/commands from hook inputs.
 *
 * OpenCode's tool.execute.before/after gives `(input, output)`. The exact
 * shape varies by tool and version; these helpers normalize the common
 * shapes so guards don't need to repeat the dance.
 */

/** Extract the tool's argument object from a hook input/output. */
export function toolArgs(input, output) {
	if (output?.args !== undefined && output.args !== null) {
		return output.args;
	}
	return input?.toolArgs ?? input?.args ?? {};
}

/** Extract text content from chat.message hook payload (input or output). */
export function extractUserText(input, output) {
	// 1. Check output.message (UserMessage) or output.parts (Part[])
	if (Array.isArray(output?.parts)) {
		const text = output.parts
			.filter((p) => p && (p.type === "text" || typeof p.text === "string"))
			.map((p) => p.text || "")
			.join(" ")
			.trim();
		if (text) return text;
	}

	const outMsg = output?.message;
	if (typeof outMsg === "string") return outMsg.trim();
	if (typeof outMsg?.text === "string" && outMsg.text.trim())
		return outMsg.text.trim();
	if (typeof outMsg?.content === "string" && outMsg.content.trim())
		return outMsg.content.trim();
	if (Array.isArray(outMsg?.parts)) {
		const text = outMsg.parts
			.filter((p) => p && (p.type === "text" || typeof p.text === "string"))
			.map((p) => p.text || "")
			.join(" ")
			.trim();
		if (text) return text;
	}

	// 2. Check input payload fallbacks (for synthetic events / tests)
	const inMsg = input?.message;
	if (typeof inMsg === "string") return inMsg.trim();
	if (typeof inMsg?.text === "string" && inMsg.text.trim())
		return inMsg.text.trim();
	if (typeof inMsg?.content === "string" && inMsg.content.trim())
		return inMsg.content.trim();
	if (Array.isArray(inMsg?.parts)) {
		const text = inMsg.parts
			.filter((p) => p && (p.type === "text" || typeof p.text === "string"))
			.map((p) => p.text || "")
			.join(" ")
			.trim();
		if (text) return text;
	}
	if (typeof input?.userMessage === "string" && input.userMessage.trim()) {
		return input.userMessage.trim();
	}

	return "";
}

/** Extract a bash command string from args (string or {command|cmd}). */
export function bashCommand(args) {
	if (typeof args === "string") return args;
	return args?.command ?? args?.cmd ?? "";
}

/** Extract a file path string from args. */
export function filePathOf(args) {
	if (typeof args === "string") return args;
	return args?.filePath ?? args?.path ?? args?.file_path ?? "";
}

/** Extract the content a write/edit/patch tool is about to write. */
export function writeContent(args) {
	if (typeof args === "string") return args;
	if (typeof args?.content === "string") return args.content;
	if (typeof args?.contents === "string") return args.contents;
	if (typeof args?.newString === "string") return args.newString;
	if (typeof args?.new_str === "string") return args.new_str;
	if (typeof args?.newText === "string") return args.newText;
	if (typeof args?.patch === "string") return args.patch;
	if (typeof args?.diff === "string") return args.diff;
	return "";
}

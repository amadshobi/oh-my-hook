/**
 * hook.js — helpers to read tool arguments/commands from hook inputs.
 *
 * OpenCode's tool.execute.before/after gives `(input, output)`. The exact
 * shape varies by tool and version; these helpers normalize the common
 * shapes so guards don't need to repeat the dance.
 */

/** Extract the tool's argument object from a hook input. */
export function toolArgs(input) {
  return input?.toolArgs ?? input?.args ?? {};
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

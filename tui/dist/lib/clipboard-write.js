/**
 * clipboard-write.js — universal clipboard write helper.
 *
 * Writes text to the system clipboard for the quick file picker and other TUI
 * copy-to-clipboard actions. Uses OSC 52 terminal escape sequences first so
 * remote sessions (SSH, tmux, Termius) work transparently, then falls back to /
 * runs alongside native OS clipboard tools. Never throws — failures are quietly
 * ignored so a broken clipboard can never crash the TUI session.
 */
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";

/**
 * Build an OSC 52 terminal escape sequence for the given text.
 *
 * OSC 52 lets the terminal emulator write to the system clipboard, which is the
 * only clipboard channel available over SSH/tmux/Termius where local binaries
 * are unreachable. Content is base64-encoded per the protocol.
 *
 * @param {string} text Text to encode into the OSC 52 sequence.
 * @returns {string} Raw escape sequence, or "" when text is empty/invalid.
 */
export function formatOsc52(text) {
	if (typeof text !== "string" || text.length === 0) return "";
	const b64 = Buffer.from(text, "utf8").toString("base64");
	let payload = `\x1b]52;c;${b64}\x07`;
	// tmux needs the sequence wrapped in its passthrough prefix/suffix so the
	// outer (real) terminal actually receives the OSC 52 instead of tmux.
	if (process.env.TMUX) {
		payload = `\x1bPtmux;\x1b${payload}\x1b\\`;
	}
	return payload;
}

/** Probe whether a given binary exists on PATH (quick, silent check). */
function binaryAvailable(cmd) {
	try {
		const res = spawnSync("which", [cmd], { timeout: 1000 });
		return res.status === 0;
	} catch {
		return false;
	}
}

/**
 * Resolve the native clipboard tool for the current OS / display server.
 *
 * @returns {string[]|null} Binary invocation args, or null when none apply.
 */
function resolveNativeTool() {
	if (process.platform === "darwin") return ["pbcopy"];

	// Win32 and WSL both route through clip.exe (WSL is win32 in Node's view).
	if (process.platform === "win32") return ["clip.exe"];

	// Linux: choose by display server. Wayland needs wl-copy; X11 prefers xclip.
	if (process.platform === "linux") {
		if (process.env.WAYLAND_DISPLAY && binaryAvailable("wl-copy")) {
			return ["wl-copy"];
		}
		if (binaryAvailable("xclip")) return ["xclip", "-selection", "clipboard"];
		if (binaryAvailable("xsel")) return ["xsel", "--clipboard", "--input"];
	}
	return null;
}

/**
 * Write text to the system clipboard.
 *
 * Ships the text via OSC 52 to the terminal plus (when a native tool exists)
 * via the OS binary. All failures are swallowed — this is best-effort only and
 * must never throw or interrupt the prompt.
 *
 * @param {string} text Text to copy.
 * @returns {undefined}
 */
export function writeClipboard(text) {
	if (!text || typeof text !== "string") return;

	// Path A: OSC 52 — send to the terminal emulator so remote/SSH clipboards work.
	const osc = formatOsc52(text);
	if (process.stdout?.isTTY && osc) {
		try {
			process.stdout.write(osc);
		} catch {
			// Terminal closed or non-writable — fall through to native tools.
		}
	}

	// Path B: native OS tool — covers local desktop sessions that ignore OSC 52.
	const native = resolveNativeTool();
	if (native) {
		try {
			spawnSync(native[0], native.slice(1), {
				input: text,
				stdio: ["pipe", "ignore", "ignore"],
				timeout: 1000,
			});
		} catch {
			// Clipboard binary missing/failed — ignore and continue.
		}
	}
}

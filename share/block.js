/**
 * block.js — shared guardrail message builders.
 *
 * Renders block/warn/info messages per the style guide in
 * `./style-guide.md`, with an instruction block telling the LLM how to
 * surface the message in the UI.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STYLE_GUIDE_PATH = path.join(__dirname, "style-guide.md");

let cachedStyleGuide = null;
function styleGuide() {
  if (cachedStyleGuide) return cachedStyleGuide;
  try {
    cachedStyleGuide = readFileSync(STYLE_GUIDE_PATH, "utf8");
  } catch {
    cachedStyleGuide = "";
  }
  return cachedStyleGuide;
}

/**
 * Build a hard-block error message (thrown from tool.execute.before).
 */
export function blockMessage(title, reason, hint) {
  return (
    `GUARDRAIL BLOCK: ${title}\n\n` +
    `Alasan: ${reason}\n` +
    (hint ? `Saran: ${hint}\n` : "") +
    `\nINSTRUKSI TAMPILAN UNTUK LLM:\n` +
    styleGuide() +
    `\nTampilkan pesan block ini sesuai format "Block" di atas:\n` +
    `#### 🚫 ${title}\n` +
    `> *${reason}*\n` +
    `> *${hint || "Tunggu persetujuan user sebelum melanjutkan."}*`
  );
}

/**
 * Build a warn message (non-blocking) thrown to surface a warning.
 */
export function warnMessage(title, reason) {
  return (
    `GUARDRAIL WARNING: ${title}\n\n` +
    `Detail: ${reason}\n` +
    `\nINSTRUKSI TAMPILAN UNTUK LLM:\n` +
    styleGuide() +
    `\nTampilkan pesan warning ini sesuai format "Warning" di atas:\n` +
    `#### ⚠️ ${title}\n` +
    `> *${reason}*`
  );
}

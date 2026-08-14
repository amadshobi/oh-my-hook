/**
 * share/messages.js — centralized message dictionary with hybrid override support.
 *
 * Supports:
 * 1. Default built-in messages.
 * 2. Direct string override (replaces reason).
 * 3. Direct object override ({ title, reason, suggestion }).
 * 4. External file reference: "{file:./path/to/message.md}" or "{file:~/.config/...}".
 * 5. Placeholder interpolation (e.g., {file}, {command}, {detail}, {reason}).
 */
import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { blockMessage, warnMessage } from "./block.js";

export const DEFAULT_MESSAGES = {
  modePlanTool: {
    title: "Mode Plan: Aksi Diblokir",
    reason: 'Tool "{tool}" ({target}) mengubah file, tapi kamu lagi di mode plan.',
    suggestion: "Jangan edit file. Cukup analisis dan susun rencana. Tunggu user bilang 'gas' untuk eksekusi.",
  },
  modePlanBash: {
    title: "Mode Plan: Aksi Diblokir",
    reason: 'Command "{command}" mengubah state, tapi kamu lagi di mode plan.',
    suggestion: "Jalankan hanya perintah read-only (git log, ls, cat, grep) untuk investigasi.",
  },
  readGuardUnread: {
    title: "File Belum Dibaca",
    reason: 'File "{file}" belum pernah dibaca di sesi ini.',
    suggestion: "Gunakan tool read/view dulu sebelum mengubah file.",
  },
  readGuardStale: {
    title: "File Telah Berubah (Stale Write)",
    reason: 'File "{file}" berubah di disk setelah terakhir dibaca model.',
    suggestion: "Baca ulang file untuk melihat perubahan terbaru sebelum menulis.",
  },
  secretDetected: {
    title: "Secret Terdeteksi",
    reason: "Konten yang akan ditulis mengandung kredensial rahasia:\n{detail}",
    suggestion: "Jangan tulis secret ke file. Gunakan environment variable atau file .env yang di-gitignore.",
  },
  dangerousBash: {
    title: "Perintah Berbahaya",
    reason: 'Command "{command}" terlihat destruktif.',
    suggestion: "Jangan jalankan tanpa konfirmasi eksplisit dari user.",
  },
  commitGuard: {
    title: "Commit Diblokir",
    reason: "Pesan commit tidak valid:\n{reason}",
    suggestion: "Gunakan format conventional commit: type(scope): description",
  },
  devServerGuard: {
    title: "Dev Server Diblokir",
    reason: 'Command "{command}" butuh tmux/screen biar ga jadi proses orphan.',
    suggestion: "Jalankan di dalam tmux atau screen session.",
  },
  pushWarning: {
    title: "Perhatian: Git Push",
    reason: "{warning}",
    suggestion: "Pastikan branch dan remote sudah sesuai sebelum push.",
  },
  strayMarkdown: {
    title: "File Markdown di Luar Docs",
    reason: 'File "{file}" dibuat di luar direktori docs standar. Pastikan ini disengaja.',
    suggestion: "Gunakan direktori docs standar untuk dokumentasi umum.",
  },
  checklistNudge: {
    title: "Multi-Step Task Terdeteksi",
    reason: "Tugas ini butuh beberapa langkah. Buat checklist di .opencode/todos.json dulu.",
    suggestion: "Pecah task menjadi todo terstruktur.",
  },
  toolBlocked: {
    title: "Tool Diblokir",
    reason: "Tool '{tool}' diblokir oleh kebijakan guardrail (kebijakan: {policy}).",
    suggestion: "Cek konfigurasi omh.jsonc pada bagian guard.tools.",
  },
};

function resolvePath(filePath, cwd = process.cwd()) {
  if (filePath.startsWith("~")) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
}

function loadExternalFile(fileRef, cwd) {
  const match = fileRef.match(/^\{file:\s*(.+?)\s*\}$/);
  if (!match) return null;
  const rawPath = match[1];
  const fullPath = resolvePath(rawPath, cwd);
  if (!existsSync(fullPath)) return null;
  try {
    const content = readFileSync(fullPath, "utf8").trim();
    if (content.startsWith("{") && content.endsWith("}")) {
      try {
        return JSON.parse(content);
      } catch {}
    }
    return content;
  } catch {
    return null;
  }
}

export function interpolate(template, params = {}) {
  if (typeof template !== "string") return "";
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const val = params[key];
    return val !== undefined && val !== null ? String(val) : match;
  });
}

export function resolveMessage(key, params = {}, config = {}, cwd = process.cwd()) {
  const fallback = DEFAULT_MESSAGES[key] || {
    title: "Pemberitahuan",
    reason: `Pesan untuk ${key}`,
    suggestion: "Periksa kembali konfigurasi atau parameter.",
  };

  const messagesConfig = config?.messages || config;
  let override = messagesConfig?.[key];

  if (typeof override === "string" && override.startsWith("{file:")) {
    const loaded = loadExternalFile(override, cwd);
    if (loaded) override = loaded;
  }

  let resolvedTitle = fallback.title;
  let resolvedReason = fallback.reason;
  let resolvedSuggestion = fallback.suggestion;

  if (typeof override === "string") {
    resolvedReason = override;
  } else if (override && typeof override === "object") {
    if (override.title !== undefined) resolvedTitle = override.title;
    if (override.reason !== undefined) resolvedReason = override.reason;
    if (override.suggestion !== undefined) resolvedSuggestion = override.suggestion;
  }

  return {
    title: interpolate(resolvedTitle, params),
    reason: interpolate(resolvedReason, params),
    suggestion: interpolate(resolvedSuggestion, params),
  };
}

export function formatBlockMessage(key, params = {}, config = {}, cwd = process.cwd()) {
  const { title, reason, suggestion } = resolveMessage(key, params, config, cwd);
  return blockMessage(title, reason, suggestion);
}

export function formatWarnMessage(key, params = {}, config = {}, cwd = process.cwd()) {
  const { title, reason } = resolveMessage(key, params, config, cwd);
  return warnMessage(title, reason);
}

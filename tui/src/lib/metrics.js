/**
 * metrics.js — calculates active guard counts and curated memory statistics.
 */
import { loadConfig } from "../../../share/config.js";
import { readAllMemory, parseBullets } from "../../../memory/store.js";

const BOOLEAN_GUARD_FLAGS = [
  "readBeforeWrite",
  "staleWrite",
  "planMode",
  "secretScanner",
  "commitGuard",
  "devServerGuard",
  "dangerousBash",
];

/**
 * Calculate the number of active guards configured.
 *
 * @param {object} [config] Parsed oh-my-hook configuration object.
 * @returns {number} Count of active guards.
 */
export function getActiveGuardsCount(config) {
  const cfg = config || loadConfig().config;
  const guard = cfg?.guard || {};

  let count = 0;
  for (const flag of BOOLEAN_GUARD_FLAGS) {
    if (guard[flag] !== false) {
      count++;
    }
  }

  if (guard.tools && typeof guard.tools === "object") {
    count += Object.keys(guard.tools).length;
  }

  return count;
}

/**
 * Calculate the number of curated memory bullet points for a project directory.
 *
 * @param {string} [projectDirectory] Target workspace directory.
 * @returns {number} Number of curated memory notes.
 */
export function getCuratedMemoryCount(projectDirectory) {
  try {
    const raw = readAllMemory(projectDirectory);
    return parseBullets(raw).length;
  } catch {
    return 0;
  }
}

/**
 * Get comprehensive metrics for the TUI sidebar.
 *
 * @param {string} [projectDirectory] Target workspace directory.
 * @param {object} [config] Optional config override.
 * @returns {{ guardsActive: number, memoryNotes: number }}
 */
export function getMetrics(projectDirectory, config) {
  return {
    guardsActive: getActiveGuardsCount(config),
    memoryNotes: getCuratedMemoryCount(projectDirectory),
  };
}

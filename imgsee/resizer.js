/**
 * imgsee/resizer.js — Image budgeting & size checks.
 *
 * Checks image buffer against size targets.
 */
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB target

/**
 * Validates and budget-checks image payload.
 *
 * @param {Buffer} buffer
 * @param {object} [opts]
 * @param {number} [opts.maxBytes]
 * @returns {{ buffer: Buffer, isOversized: boolean, bytes: number }}
 */
export function optimizeImage(buffer, opts = {}) {
	const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
	const isOversized = buffer.length > maxBytes;

	return {
		buffer,
		isOversized,
		bytes: buffer.length,
	};
}

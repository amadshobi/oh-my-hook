/**
 * imgsee/loader.js — Image input loader & format sniffing.
 *
 * Responsibilities:
 *   - Resolves filesystem path (relative to cwd or absolute), home expansion (~), or URL
 *   - Sniffs magic bytes for supported formats (PNG, JPEG, GIF, WEBP)
 *   - Enforces 20 MiB safety cap
 *   - Returns base64 payload, MIME type, and byte size
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024; // 20 MiB

/**
 * Sniff MIME type from header magic bytes.
 *
 * @param {Buffer} buffer
 * @returns {string | null}
 */
export function sniffImageMime(buffer) {
	if (!buffer || buffer.length < 4) return null;

	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47
	) {
		return "image/png";
	}

	// JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return "image/jpeg";
	}

	// GIF: GIF87a or GIF89a
	if (
		buffer[0] === 0x47 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x38
	) {
		return "image/gif";
	}

	// WEBP: RIFF....WEBP
	if (
		buffer.length >= 12 &&
		buffer.toString("ascii", 0, 4) === "RIFF" &&
		buffer.toString("ascii", 8, 12) === "WEBP"
	) {
		return "image/webp";
	}

	return null;
}

/**
 * Resolve local image path or fetch remote image.
 *
 * @param {string} inputPath
 * @param {string} [cwd]
 * @returns {Promise<{ buffer: Buffer, mime: string, resolvedPath: string, size: number }>}
 */
export async function loadImage(inputPath, cwd = process.cwd()) {
	if (!inputPath || typeof inputPath !== "string") {
		throw new Error("Image path is required.");
	}

	const trimmed = inputPath.trim();

	// Remote URL fetch
	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		const res = await fetch(trimmed, {
			headers: { "User-Agent": "oh-my-hook/imgsee (OpenCode Agent)" },
		});
		if (!res.ok) {
			throw new Error(
				`Failed to fetch image from URL: ${trimmed} (${res.status} ${res.statusText})`,
			);
		}

		// Pre-flight content-length check to prevent loading massive remote streams into memory
		const contentLengthHeader = res.headers.get("content-length");
		if (contentLengthHeader) {
			const expectedBytes = parseInt(contentLengthHeader, 10);
			if (
				!Number.isNaN(expectedBytes) &&
				expectedBytes > MAX_IMAGE_INPUT_BYTES
			) {
				throw new Error(
					`Image from URL exceeds maximum allowed size of 20 MiB (content-length reports ${Math.round(expectedBytes / 1024 / 1024)} MiB).`,
				);
			}
		}

		const arrayBuf = await res.arrayBuffer();
		const buffer = Buffer.from(arrayBuf);
		if (buffer.length > MAX_IMAGE_INPUT_BYTES) {
			throw new Error(
				`Image from URL exceeds maximum allowed size of 20 MiB (received ${Math.round(buffer.length / 1024 / 1024)} MiB).`,
			);
		}
		const mime =
			sniffImageMime(buffer) || res.headers.get("content-type") || "image/jpeg";
		return {
			buffer,
			mime: mime.split(";")[0].trim(),
			resolvedPath: trimmed,
			size: buffer.length,
		};
	}

	// Local filesystem resolution
	let resolved = trimmed;
	if (resolved.startsWith("~/")) {
		resolved = path.join(os.homedir(), resolved.slice(2));
	} else if (!path.isAbsolute(resolved)) {
		resolved = path.resolve(cwd, resolved);
	}

	if (!existsSync(resolved)) {
		throw new Error(
			`Image file not found: "${inputPath}" (resolved: ${resolved})`,
		);
	}

	const stats = statSync(resolved);
	if (stats.isDirectory()) {
		throw new Error(
			`Target path is a directory, not an image file: "${resolved}"`,
		);
	}

	if (stats.size > MAX_IMAGE_INPUT_BYTES) {
		throw new Error(
			`Image file exceeds maximum allowed size of 20 MiB (${Math.round(stats.size / 1024 / 1024)} MiB).`,
		);
	}

	const buffer = readFileSync(resolved);
	const mime = sniffImageMime(buffer);

	if (!mime) {
		throw new Error(
			`Unsupported image format for "${inputPath}". imgsee supports PNG, JPEG, GIF, and WEBP.`,
		);
	}

	return {
		buffer,
		mime,
		resolvedPath: resolved,
		size: buffer.length,
	};
}

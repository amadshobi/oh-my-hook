/**
 * gateway/discovery.js — Local Gateway Model Discovery & Snapshot Cache
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { normalizeGatewayModels } from "./normalizer.js";

/**
 * Resolve standard cache path for gateway models snapshot.
 */
export function getSnapshotCachePath() {
	const cacheDir =
		process.env.XDG_CACHE_HOME || join(homedir(), ".cache", "opencode");
	return join(cacheDir, "gateway-models-cache.json");
}

/**
 * Fetch models from local gateway (:4010 or :4000) with fallback snapshot caching.
 */
export async function fetchGatewayModels(
	baseUrl,
	apiKey = "dummy",
	providerId = "local-gateway",
	timeoutMs = 3000,
	opts = {},
) {
	const cachePath = opts.cachePath || getSnapshotCachePath();
	const fetchFn = opts.fetch || globalThis.fetch;

	const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
	const modelsUrl = normalizedBaseUrl.endsWith("/v1")
		? `${normalizedBaseUrl}/models`
		: `${normalizedBaseUrl}/v1/models`;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetchFn(modelsUrl, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			signal: controller.signal,
		});

		if (res.ok) {
			const data = await res.json();
			const rawList = Array.isArray(data?.data) ? data.data : [];

			if (rawList.length > 0) {
				const normalized = normalizeGatewayModels(
					rawList,
					normalizedBaseUrl,
					providerId,
				);

				// Save successful snapshot cache to disk
				try {
					const dir = join(cachePath, "..");
					mkdirSync(dir, { recursive: true });
					writeFileSync(cachePath, JSON.stringify(normalized, null, 2), "utf8");
				} catch {
					// ignore cache write errors
				}

				return normalized;
			}
		}
	} catch {
		// ignore network/timeout errors and fallback to disk cache below
	} finally {
		clearTimeout(timer);
	}

	// If gateway is down / offline, fallback to snapshot cache
	if (existsSync(cachePath)) {
		try {
			const cached = JSON.parse(readFileSync(cachePath, "utf8"));
			return cached;
		} catch {
			// ignore malformed cache
		}
	}

	return {};
}

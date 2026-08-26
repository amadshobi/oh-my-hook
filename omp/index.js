/**
 * omp/index.js — Oh-My-Pi (OMP) Multi-Agent Hook & Gateway Bridge.
 *
 * Provides:
 *   - Dynamic auto-discovery of live OMP Gateway models (:4000)
 *   - Automatic bridging of custom providers declared in ~/.omp/agent/models.yml
 */
import { fetchGatewayModels, registerGatewayModels, registerModelsYaml } from "./catalog.js";

export function ompHooks(_input, opts = {}) {
	const config = opts?.config || {};
	const ompCfg = config.omp || {};

	if (ompCfg.enabled === false) {
		return {};
	}

	const gatewayUrl = ompCfg.url ?? "http://127.0.0.1:4000/v1";
	const timeoutMs = ompCfg.timeoutMs ?? 1000;
	const providerId = ompCfg.providerId ?? "omp";
	const providerName = ompCfg.providerName ?? "OMP Gateway";
	const bridgeModelsYml = ompCfg.bridgeModelsYml !== false;

	return {
		config: async (cfg) => {
			// 1. Fetch & Register live models from OMP Gateway (:4000)
			const liveModels = await fetchGatewayModels(gatewayUrl, timeoutMs);
			if (liveModels.length > 0) {
				registerGatewayModels(cfg, liveModels, {
					url: gatewayUrl,
					providerId,
					providerName,
				});
			}

			// 2. Bridge custom providers from ~/.omp/agent/models.yml if enabled
			if (bridgeModelsYml) {
				registerModelsYaml(cfg);
			}
		},
	};
}

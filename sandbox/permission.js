/**
 * sandbox/permission.js — Native OpenCode `permission.ask` hook integration.
 *
 * Automatically denies permissions that violate sandbox security rules
 * before OpenCode triggers an interactive modal prompt to the user.
 */
import { dangerousBashPatterns } from "./security.js";

export function createPermissionGuard({ config } = {}) {
	const cfg = config?.guard ?? config?.sandbox ?? config ?? {};
	const dangerousBash = cfg.dangerousBash ?? true;

	return {
		"permission.ask": async (input, output) => {
			if (!output || !input) return;

			const action = input.action || "";
			const resources = Array.isArray(input.resources) ? input.resources : [];

			// If bash action with dangerous command pattern -> auto-deny
			if (action === "bash" && dangerousBash) {
				for (const res of resources) {
					if (typeof res === "string" && dangerousBashPatterns(res)) {
						output.status = "deny";
						return;
					}
				}
			}
		},
	};
}

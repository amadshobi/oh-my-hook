/**
 * sandbox/env.js — Native OpenCode `shell.env` hook integration.
 *
 * Injects standard security and session variables into subshells spawned by OpenCode.
 */

export function createEnvInjector({ config } = {}) {
	return {
		"shell.env": async (input, output) => {
			if (!output) return;
			output.env = {
				...(output.env ?? {}),
				OMH_SANDBOX: "1",
				OMH_SESSION_ID: input?.sessionID || "global",
				NO_COLOR: "1",
			};
		},
	};
}

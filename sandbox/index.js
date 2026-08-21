/**
 * sandbox/index.js — Pre-execution security, payload validation, read-safety,
 * permission control, and subshell isolation.
 */
import { mergeHooks } from "../share/merge.js";
import { securityHooks } from "./security.js";
import { createReadGuard } from "./read-guard.js";
import { createPermissionGuard } from "./permission.js";
import { createEnvInjector } from "./env.js";

export function createSandbox({ client, directory, config, messages } = {}) {
	const readGuard = createReadGuard({ directory, config, messages });
	const permissionGuard = createPermissionGuard({ config });
	const envInjector = createEnvInjector({ config });

	return {
		...readGuard,
		...permissionGuard,
		...envInjector,
		init: async () => {
			const sec = await securityHooks({ client }, { config, messages });
			return mergeHooks(readGuard, permissionGuard, envInjector, sec);
		},
	};
}

export async function sandboxHooks({ client, directory }, opts = {}) {
	const config = opts?.config ?? {};
	const messages = opts?.messages ?? opts?.config?.messages ?? {};

	const sec = await securityHooks({ client }, { config, messages });
	const readGuard = createReadGuard({ directory, config, messages });
	const permissionGuard = createPermissionGuard({ config });
	const envInjector = createEnvInjector({ config });

	return mergeHooks(sec, readGuard, permissionGuard, envInjector);
}

export { securityHooks } from "./security.js";
export { createReadGuard, refreshReads } from "./read-guard.js";
export { createPermissionGuard } from "./permission.js";
export { createEnvInjector } from "./env.js";

/**
 * context/index.js — Deprecation shim. Re-exports compressModule from compress/index.js.
 */
import { compressModule } from "../compress/index.js";

export async function contextModule(input, opts = {}) {
	return compressModule(input, opts);
}

export { compressModule };
export default contextModule;

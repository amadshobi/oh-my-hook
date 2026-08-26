/**
 * prompts/index.js — Dynamic system prompt router module for oh-my-hook.
 *
 * Hooks into experimental.chat.system.transform to dynamically route and apply
 * custom provider prompts from ~/.opencode/assets/provider/ based on model IDs.
 * Custom agent personas are never overwritten unless overridePersona is set.
 */
import {
	resolvePresetPath,
	loadPromptContent,
	replaceSystemPrompt,
	hasCustomPersona,
} from "./router.js";

export async function promptHooks(_input, opts = {}) {
	const cfg = opts?.config ?? {};
	const enabled = cfg.enabled ?? true;
	const overridePersona = cfg.overridePersona ?? false;

	return {
		"experimental.chat.system.transform": async (input, output) => {
			if (!enabled) return;
			if (!input?.model) return;

			output.system = output.system || [];

			// A user-authored agent persona outranks any model preset; only the
			// generic built-in base prompts are safe to swap out.
			if (!overridePersona && hasCustomPersona(output.system)) return;

			const targetPath = resolvePresetPath(input.model, cfg);
			if (!targetPath) return;

			const promptText = loadPromptContent(targetPath);
			if (!promptText) return;

			replaceSystemPrompt(output.system, promptText);
		},
	};
}

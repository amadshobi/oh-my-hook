/**
 * prompts/index.js — Dynamic system prompt router module for oh-my-hook.
 *
 * Hooks into experimental.chat.system.transform to dynamically route and apply
 * custom provider prompts from ~/.opencode/assets/provider/ based on model IDs.
 */
import {
	resolvePresetPath,
	loadPromptContent,
	replaceSystemPrompt,
} from "./router.js";

export async function promptHooks(_input, opts = {}) {
	const cfg = opts?.config ?? {};
	const enabled = cfg.enabled ?? true;

	return {
		"experimental.chat.system.transform": async (input, output) => {
			if (!enabled) return;
			if (!input?.model) return;

			const targetPath = resolvePresetPath(input.model, cfg);
			if (!targetPath) return;

			const promptText = loadPromptContent(targetPath);
			if (!promptText) return;

			output.system = output.system || [];
			replaceSystemPrompt(output.system, promptText);
		},
	};
}

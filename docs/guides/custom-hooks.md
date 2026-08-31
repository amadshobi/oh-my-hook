# Authoring Custom Zero-Dependency Hooks

This guide explains how to build, test, and register custom guardrails and 0-token slash commands using `oh-my-hook` architecture standards.

---

## 🏗️ Anatomy of a Custom Hook Module

Custom modules export an asynchronous factory function returning an OpenCode hooks object.

```javascript
// custom-guard/index.js
import { toolArgs, filePathOf } from "../share/hook.js";
import { formatBlockMessage } from "../share/messages.js";

export async function customGuardHooks(input, { config }) {
  const enabled = config?.customGuard?.enabled ?? true;
  if (!enabled) return {};

  return {
    "tool.execute.before": async (toolInput, toolOutput) => {
      const tool = toolInput?.tool;
      const args = toolArgs(toolInput, toolOutput);

      if (tool === "write" || tool === "edit") {
        const filePath = filePathOf(args);
        if (filePath && filePath.endsWith(".env.production")) {
          throw new Error(
            formatBlockMessage("toolBlocked", {
              tool,
              policy: "Production .env files cannot be modified by AI agents.",
            })
          );
        }
      }
    },
  };
}
```

---

## ⚡ Writing 0-Token Slash Commands

To create an interactive slash command that executes deterministically without sending queries to the LLM:

1. **Register in `config`**: Add command metadata to `cfg.command[name]`.
2. **Intercept in `command.execute.before`**: Execute local logic, inject output using `client.session.prompt` with `{ noReply: true }`, and throw `createHandledError()`.

```javascript
import { createHandledError } from "../share/handled.js";

export async function customCommandHooks({ client }) {
  return {
    config: async (cfg) => {
      cfg.command = cfg.command || {};
      cfg.command["mycmd"] = {
        template: "/mycmd $ARGUMENTS",
        description: "Executes custom local utility without LLM tokens.",
      };
    },
    "command.execute.before": async (input) => {
      if (input.command !== "mycmd") return;

      const outputText = "✨ Executed local command successfully!";

      // Inject clean text into chat transcript
      await client.session.prompt({
        path: { id: input.sessionID },
        body: {
          noReply: true,
          parts: [{ type: "text", text: outputText, ignored: true }],
        },
      });

      // Stop prompt pipeline from invoking the model
      throw createHandledError();
    },
  };
}
```

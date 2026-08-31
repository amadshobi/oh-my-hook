# Dynamic System Prompt Router

The `prompts/` module intercepts `experimental.chat.system.transform` to route specialized system prompts based on model family and provider, preventing tool hallucinations when using non-tier-1 models via local gateways.

---

## 🧭 The Model Routing Problem

When developers use multi-provider gateways (like Oh-My-Pi / OMP) to proxy models like Minimax, DeepSeek, or Qwen, OpenCode defaults to a generic fallback prompt (`PROMPT_DEFAULT`), often resulting in markdown formatting errors and tool call failures.

---

## 📐 Resolution Hierarchy

`prompts/router.js` resolves appropriate prompt directives in the following order:

```
1. User Explicit Routes:
   omh.jsonc -> prompts.routes["kilo/tencent/hy3:free"] -> "hy3.md"
   ▲
   │
2. User Custom Files:
   ~/.config/opencode/prompts/<model-id>.md
   ~/.config/opencode/prompts/<family-name>.md (e.g. deepseek.md, minimax.md)
   ▲
   │
3. User Custom Default:
   ~/.config/opencode/prompts/default.md
   ▲
   │
4. Built-in Provider Assets:
   ~/.opencode/assets/provider/<family>.md
```

---

## 🔒 Session Metadata Preservation

System prompt replacement is strictly atomic: it replaces the base prompt while preserving 100% of runtime metadata (<env>, current working directory, project `AGENTS.md`, MCP tool manifests, and curated memory notes).

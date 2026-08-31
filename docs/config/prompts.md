# Prompts Configuration

Configuration options for model family routing and custom system prompt overrides.

---

## ⚙️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "prompts": {
    "enabled": true,

    // Directory for user custom prompt markdown files
    "customDirectory": "~/.config/opencode/prompts",

    // Fallback directory containing provider prompt assets
    "directory": "~/.opencode/assets/provider",

    // Explicit route mappings (model pattern -> prompt filename)
    "routes": {
      // "kilo/tencent/hy3:free": "hy3.md",
      // "ollama-cloud/*": "minimax.md"
    },

    // When true, replaces custom agent personas with provider base prompts
    "overridePersona": false
  }
}
```

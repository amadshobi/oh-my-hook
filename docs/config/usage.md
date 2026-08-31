# Usage Configuration

Configuration options for deterministic quota monitoring and session token metrics.

---

## ⚙️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "usage": {
    "enabled": true,

    // Token tree options
    "tokens": {
      // Show subagent breakdown in sidebar and /usage tokens
      "showSubagents": true,

      // Default subagent tree nodes to collapsed state for clean display
      "subagentsCollapsed": true
    },

    // Multi-provider cloud quota options
    "quota": {
      "ollama": {
        // Map key prefixes to custom account display names
        "accounts": {
          // "ollama_key_prefix": "Team Account"
        }
      }
    }
  }
}
```

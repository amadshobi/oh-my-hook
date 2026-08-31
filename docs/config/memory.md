# Memory Configuration

Configuration options for the Markdown-backed curated memory engine and AI distillation worker.

---

## ⚙️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "memory": {
    // Enable or disable the memory engine
    "enabled": true,

    // AI adapter harness for /memory capture ("commandcode" | "opencode" | "omp")
    "captureAdapter": "commandcode",

    // Model configurations per capture adapter
    "captureModels": {
      "commandcode": "", // Blank uses Command Code default model
      "opencode": "omp/hy3:free",
      "omp": "gemini-3.6-flash"
    },

    // Maximum memory bullets displayed in summaries
    "maxBullets": 10,

    // When false, keeps subagent contexts clean by injecting memory only to the main agent
    "injectToSubagents": false,

    // Automatically trigger AI distillation when sessions enter idle
    "captureAuto": false
  }
}
```

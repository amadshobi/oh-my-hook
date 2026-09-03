# Memory Configuration

Configuration options for the Hermes-style multi-target curated memory engine and background self-improvement reviewer.

---

## ⚙️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "memory": {
    // Enable or disable the memory engine
    "enabled": true,

    // OpenAI-compatible gateway endpoint (OMP :4000, Local Gateway :4010, Ollama :11434, etc.)
    "baseURL": "http://127.0.0.1:4000/v1",

    // Model used for distillation and background self-improvement reviews
    "model": "google-antigravity/gemini-2.5-flash",

    // API key for gateway authorization (default: dummy or reads OMP_API_KEY / OPENAI_API_KEY)
    "apiKey": "dummy",

    // Maximum memory bullets stored per distillation run
    "maxBullets": 10,

    // When false, keeps subagent contexts clean by injecting memory only to the main agent
    "injectToSubagents": false,

    // Bounded character limits per target (Hermes style)
    "budgets": {
      "user": 1500,     // ~/.config/opencode/memory/USER.md
      "global": 2500,   // ~/.config/opencode/memory/MEMORY.md
      "project": 3500   // projects/<slug>/MEMORY.md
    },

    // Hermes-style background self-improvement review loop
    "review": {
      "enabled": true,
      "idleDelayMs": 3000 // Background review triggers 3s after turn finishes
    }
  }
}
```

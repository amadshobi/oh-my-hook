# Memory Distillation & Background Review

The `/memory capture` workflow and background review loop distill valuable architectural lessons, edge cases, and user preferences from chat turns into concise Markdown memory stores across `user`, `global`, and `project` targets.

---

## Direct OpenAI-Compatible Gateway Architecture

Memory reflection operates out-of-band using a high-performance native `fetch()` HTTP client connecting directly to any OpenAI-compatible gateway (e.g. Oh-My-Pi `:4000`, Local Gateway `:4010`, Ollama `:11434`, or remote endpoints):

| Feature | Execution Trigger | Engine | Action |
| :--- | :--- | :--- | :--- |
| **Hermes Background Review** | Automatic (post-turn idle) | Gateway `fetch()` | Analyzes turn excerpt, returns `{ operations: [...] }`, updates `USER.md` / `MEMORY.md`. |
| **Manual Capture** | Slash command `/memory capture` | Gateway `fetch()` | Distills complete session transcript into 3-5 bullet points. |

---

## Zero Ephemeral Footprint

To prevent database clutter and session pollution:
- Queries are executed directly against the local HTTP gateway loopback without spawning OS child processes.
- No dummy session records are created in OpenCode's SQLite database.
- Results undergo local secret-scanning and character budget validation before being written to disk.

---

## ⚙️ Configuration in `omh.jsonc`

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "memory": {
    "enabled": true,
    "baseURL": "http://127.0.0.1:4000/v1",
    "model": "google-antigravity/gemini-2.5-flash",
    "apiKey": "dummy",
    "maxBullets": 10,
    "injectToSubagents": false,
    "budgets": {
      "user": 1500,
      "global": 2500,
      "project": 3500
    },
    "review": {
      "enabled": true,
      "idleDelayMs": 3000
    }
  }
}
```

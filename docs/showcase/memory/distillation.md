# Ephemeral AI Memory Distillation

The `/memory capture` workflow distills valuable architectural lessons, edge cases, and user preferences from messy chat transcripts into concise Markdown memory bullets.

---

## ⚡ Pluggable AI Adapters

Memory distillation operates out-of-band using pluggable AI harness adapters located in `memory/ai/`:

| Adapter ID | Runner Binary | Isolation Flags | Use Case |
| :--- | :--- | :--- | :--- |
| `commandcode` *(default)* | `cmd -p` | `--no-session` | Zero-session overhead with fast local models. |
| `opencode` | `opencode run` | Ephemeral session delete | Uses native OpenCode CLI runtime. |
| `omp` | `omp -p` | `--no-session` | Delegates to Oh-My-Pi multi-model daemon. |

---

## 🔒 Zero Ephemeral Footprint

To prevent database clutter and session pollution:
- `cmd` and `omp` are invoked with `--no-session`.
- `opencode run` creates a temporary session ID and deletes it immediately after distillation completes via `opencode session delete <id>`.

---

## ⚙️ Configuration in `omh.jsonc`

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "memory": {
    "enabled": true,
    "captureAdapter": "commandcode", // "commandcode" | "opencode" | "omp"
    "captureModels": {
      "commandcode": "", // blank uses Command Code default model
      "opencode": "omp/hy3:free",
      "omp": "gemini-3.6-flash"
    },
    "maxBullets": 10,
    "injectToSubagents": false,
    "captureAuto": false // set true to auto-distill when session goes idle
  }
}
```

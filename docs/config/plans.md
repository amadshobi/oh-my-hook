# Plans Configuration

Configuration options for the dual-mode planning suite and auto-versioning.

---

## ️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
 "plans": {
 // Enable or disable the entire planning module
 "enabled": true,

 // When true, freezes project file modifications during Plan Mode
 "planMode": true,

 // Auto-detect explicit plan/execute intent from user text.
 // When false, mode switching is 100% slash-command driven
 // (/plan, /design, /approve) — no chat scanning at all.
 "autoDetectIntent": true,

 // Storage directory for durable markdown plans and designs
 "directory": "~/.opencode/plans",

 // Maximum number of versioned backups to retain per plan
 "versionLimit": 20
 }
}
```

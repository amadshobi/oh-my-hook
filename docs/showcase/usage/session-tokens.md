# Session & Subagent Token Tree

The session token tracker queries `~/.local/share/opencode/opencode.db` to render a complete relational breakdown of token consumption across the main agent and all spawned subagents.

---

## ️ TUI Sidebar Accordion Tree

Rendered in the OpenCode TUI sidebar panel (`sidebar_content`):

```text
▼ TOKENS BREAKDOWN (Active Session)
 ▼ Main Agent (google-antigravity / gemini-3.7-flash)
 ├─ In : 1.99M
 ├─ Out : 70.32k (Reasoning: 13.58k)
 ├─ Cache R: 22.05M ( 91.7% hit)
 └─ Cost : $0.00
 
 ▼ Subagents (1 active)
 ▼ @explore (opencode-zen / muse-spark-1.2)
 ├─ In : 32.62k
 ├─ Out : 3.08k
 ├─ Cache R: 69.42k
 └─ Cost : $0.00

 ▼ Last Turn Breakdown (Expanded)
 ├─ In: 4.2k | Out: 620 | Cache: 98.1%
 └─ Duration: 1.8s | Cost: $0.0001
```

---

## ️ Display Configuration

```jsonc
// ~/.config/opencode/omh.jsonc
{
 "usage": {
 "tokens": {
 "showSubagents": true,
 "subagentsCollapsed": true // default collapsed for compact mobile view
 }
 }
}
```

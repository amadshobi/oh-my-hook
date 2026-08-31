# Live Quota & Token Monitor

The `usage/` module delivers deterministic, multi-provider cloud quota tracking and local session token analytics with **zero LLM token consumption**.

---

## Module Overview

- [**Multi-Provider Cloud Quota**](./cloud-quota.md): Out-of-band monitoring of Google Antigravity, Ollama Cloud (multi-key aggregation), and OpenRouter balances via read-only SQLite queries to `~/.omp/agent/agent.db`.
- [**Session & Subagent Token Tree**](./session-tokens.md): Real-time token hierarchy in the TUI sidebar widget querying `~/.local/share/opencode/opencode.db`.

---

## Slash Command Reference

```text
/usage → All provider quotas + session summary
/usage quota → All provider quotas (alias)
/usage agy → Google Antigravity quotas only
/usage ollama → Ollama Cloud allowances only
/usage openrouter → OpenRouter credit balance only
/usage tokens → Session & subagent token tree breakdown
/usage help → Command reference guide
```

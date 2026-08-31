# Multi-Provider Cloud Quota

The `/usage quota` command fetches real-time account balances and rate limits across active providers without requiring manual API token configuration.

---

## Zero-Config Credentials via `agent.db`

`usage/quota/store.js` queries `~/.omp/agent/agent.db` (read-only SQLite) using native `bun:sqlite` or `node:sqlite`:

1. **Google Antigravity**: Fetches 5-hour rolling limits and weekly allowance percentage via Cloud Code Assist endpoints.
2. **Ollama Cloud**: Parallel multi-key fetching; aggregates total requests and calculates `max(usage)` across active keys.
3. **OpenRouter**: Queries live dollar credit balance, key allowances, and daily spending.

---

## Terminal Transcript Output

```text
MULTI-PROVIDER LIVE QUOTA & USAGE

Google Antigravity (dev@domain.com)
 • Weekly Limit : [████████████████████░░░░] 84.2% (Resets in 2d 4h)
 • 5-Hour Limit : [████████████████████████] 100.0% (Fresh)

Ollama Cloud (Multi-key Aggregate: 3 keys)
 • Weekly Usage : [░░░░░░░░░░░░░░░░░░░░░░░░] 1.2% (14 requests)

OpenRouter ($ Balance & Spending)
 • Balance Remaining : $18.45 / $25.00
 • Usage Today : $0.12
────────────────────────────────────────────────────────
Data fetched deterministically via agent.db (0 token LLM cost)
```

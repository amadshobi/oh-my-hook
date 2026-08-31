# Dynamic In-Memory Pruning

During prolonged coding sessions, verbose build logs (`npm test`, `cargo build`, `git log`) rapidly consume context window budgets. Dynamic Pruning collapses these outputs before payloads reach upstream providers.

---

## ⚡ Non-Destructive In-Memory Transformation

Pruning hooks into `experimental.chat.messages.transform`:

1. **Zero Database Drift**: Modifications occur exclusively in memory per inference turn. The persistent SQLite transcript in `opencode.db` remains 100% intact, preserving undo/redo and audit capabilities.
2. **Deterministic Output Markers**: Bulky logs are collapsed into clean markers:
   ```text
   ── OMH-PRUNE ── 14,280 chars collapsed ──
   ```

---

## 🛡️ Protected Windows & Signals

To prevent loss of critical debugging context:

1. **Recent Turns Window**: The last `recentTurns` (default: 2) conversation turns are 100% immune from pruning.
2. **Protected Tools**: Read-oriented and state-tracking tools (`read`, `write`, `edit`, `patch`, `grep`, `glob`, `todowrite`) are never pruned.
3. **Failure Signal Armor**: Historical logs containing error indicators (`FAILED`, `panic:`, `Traceback`, `npm ERR!`, `exit status 1`) are never pruned, ensuring the agent retains root-cause diagnostics.

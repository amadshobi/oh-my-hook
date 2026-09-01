# Dynamic In-Memory Pruning

During prolonged coding sessions, verbose outputs (`npm test`, `git commit`, `curl`, `gh`, `node`) rapidly consume context window budgets. Dynamic Pruning collapses these outputs before payloads reach upstream providers.

---

## Non-Destructive In-Memory Transformation

Pruning hooks into `experimental.chat.messages.transform`:

1. **Zero Database Drift**: Modifications occur exclusively in memory per inference turn. The persistent SQLite transcript in `opencode.db` remains 100% intact, preserving undo/redo and audit capabilities.
2. **Generic Size-Based Collapse**: ANY eligible tool output (default: `bash`) above `minOutputChars` (default 2000) is collapsed — no command whitelist required:
 ```text
 ── OMH-PRUNE ── 14,280 chars collapsed ──
 ```
3. **Selective Command Protection** (`commandPatterns`):
 - `neverPrune`: `git diff`, `cat config` → always kept fully intact.
 - `alwaysPrune`: `npm install`, `git commit` → force-collapsed even below threshold.
4. **Important Line Preservation**: Error/pass/summary lines from the middle are kept in an `── IMPORTANT ──` block:
 ```text
 ── IMPORTANT ──
 All 42 tests passed
 4 files changed, 120 insertions
 commit 1a2b3c4d fixed auth
 ── END IMPORTANT ──
 ```

---

## Protected Windows & Signals

To prevent loss of critical debugging context:

1. **Recent Turns Window**: The last `recentTurns` (default: 2) conversation turns are 100% immune from pruning.
2. **Protected Tools**: Read-oriented and state-tracking tools (`read`, `write`, `edit`, `patch`, `grep`, `glob`, `todowrite`) are never pruned.
3. **Failure Signal Armor**: Historical logs containing error indicators (`FAILED`, `panic:`, `Traceback`, `npm ERR!`, `exit status 1`) are never pruned, ensuring the agent retains root-cause diagnostics.

---

## Live TUI Toast Notification

When pruning fires, the TUI shows a toast (`pruned <target>: ~X tok`) via a file-watch bridge between server-side stats and the TUI plugin, with a configurable anti-spam cooldown (`compress.pruning.toast.cooldownMs`, default 30s).

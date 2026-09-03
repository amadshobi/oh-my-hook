# Context Compression Suite

The `compress/` suite optimizes LLM context utilization, pruning historical log dumps and executing auto-compaction without database corruption.

---

## ️ Suite Overview

- [**Dynamic In-Memory Pruning**](./dynamic-pruning.md): Collapses historical terminal outputs in-memory (`experimental.chat.messages.transform`) while protecting failure stack traces and recent turns.
- [**Milestone Compaction & Snapshots**](./milestones.md): Triggers automatic background compaction upon detecting `git push` milestones when the agent transitions to idle.

---

## Slash Commands

| Command | Action |
| :--- | :--- |
| `/compress` | Triggers immediate context compaction for the current session. |
| `/compress stats` | Displays token savings, total pruned characters, and active milestone metrics. |
| `/compress help` | Lists compression subcommands and options. |

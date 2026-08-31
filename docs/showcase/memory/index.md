# Curated Memory Engine

The `memory/` engine provides a lightweight, human-readable, Markdown-backed persistence model inspired by Hermes memory architecture, eliminating JSONL bloat and context drift.

---

## 🧠 Memory Architecture Overview

```
~/.config/opencode/memory/
├── MEMORY.md                          # Global cross-project memory (auto-selected in ~)
└── projects/
    └── <project-slug>/
        └── MEMORY.md                  # Project-specific curated rules (auto-selected in workspace)
```

---

## 🔍 Memory Engine Sub-Components

- [**Native Agent Tool (`memory`)**](./agent-tool.md): Exposes 4 atomic operations (`add`, `replace`, `remove`, `list`) with built-in credential leak protection and substring matching.
- [**Ephemeral AI Distillation (`/capture`)**](./distillation.md): Background worker distilling session lessons using pluggable AI adapters (`commandcode`, `opencode`, `omp`).
- [**Native TUI Modal Inspector**](./tui-inspector.md): Keyboard-driven memory manager using OpenCode's native `DialogSelect` and `DialogPrompt`.

---

## ⚡ Key Highlights

1. **100% Pure Markdown**: Stored as standard Markdown bullet lists (`- Note`). You can inspect, modify, or version control them with standard text tools.
2. **Subagent Context Isolation**: Memory is injected **only** into the primary agent's system prompt. Subagents receive clean, isolated contexts without memory contamination.
3. **Lossless Compaction**: When OpenCode compacts context, memory is automatically re-injected into the fresh summary.

---

## ⌨️ Slash Commands

| Command | Action |
| :--- | :--- |
| `/memory` | Display all active memory notes in chat. |
| `/memory global` | Display global cross-project memory. |
| `/memory project` | Display project-scoped memory. |
| `/memory add <note>` | Append note to project memory (`--global` for global). |
| `/memory replace A -> B` | Replace memory note matching text `A` with `B`. |
| `/memory remove <text>` | Delete memory note matching `text`. |
| `/memory capture` | Run ephemeral AI distillation on the active session. |

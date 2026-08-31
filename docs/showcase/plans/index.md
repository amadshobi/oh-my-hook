# Dual-Mode Planning Suite

The `plans/` suite provides an intentional boundary between brainstorming architecture and executing code modifications, preventing agent runaway during exploratory tasks.

---

## ️ Planning Suite Overview

```
 ┌───────────────────────────┐
 │ User Planning Command │
 └─────────────┬─────────────┘
 │
 ┌──────────────────────────┴──────────────────────────┐
 ▼ ▼
 [/plan [topic]] [/plan to-file <name>]
 (Ephemeral In-Chat) (Durable RFC File)
 │ │
 • Locks file mutations • Locks file mutations
 • Zero disk footprint • Targets ~/.opencode/plans/<name>.md
 • Injects plan.md prompt • Auto-archives versioned backups
 │ │
 └──────────────────────────┬──────────────────────────┘
 │
 ▼
 [ Plan Mode]
 │
 ┌────────────────────┴────────────────────┐
 ▼ ▼
 [/plan review [name]] [/approve]
 (Interactive Line Modal) (Execution Transition)
 │ │
 • Keyboard navigation • Unlocks file mutations
 • Line-level feedback • Injects approve.md
 • Approve with Ctrl+A • Begins implementation
```

---

## Planning Sub-Components

- [**Plan Mode & Whitelist Barrier**](./plan-mode.md): Mutation freeze rules and whitelisting mechanics for `~/.opencode/plans/`.
- [**Interactive Line-by-Line Review**](./interactive-review.md): Terminal-native review modal (`/plan review`) with keyboard shortcuts for disputing or annotating lines.
- [**Prompt Templates & Macro Precedence**](./templates.md): 3-level prompt override hierarchy (Project > Global > Built-in) and dynamic template interpolation.

---

## Slash Command Summary

| Command | Mode | Behavior |
| :--- | :--- | :--- |
| `/plan [topic]` | In-Chat (Ephemeral) | Freezes codebase edits and starts brainstorming directly in chat. |
| `/plan to-file <name>` | File-Based (Durable) | Generates `~/.opencode/plans/<name>.md` with auto-versioning in `plans/versions/`. |
| `/plan review [name]` | Interactive TUI Modal | Opens terminal review dialog to annotate or dispute lines. |
| `/plan list` | Listing | Lists all stored plan and design documents. |
| `/plan switch <name>` | Context Switch | Switches active plan context to another existing plan file. |
| `/design [topic]` | In-Chat (UI/UX) | Loads dedicated UI/UX design prompt (`design.md`). |
| `/design to-file <name>` | File-Based (UI/UX) | Generates component specs in `~/.opencode/plans/designs/<name>.md`. |
| `/approve` *(alias: `/exec`)* | Execution Transition | Unlocks codebase mutations and transitions agent to implementation mode. |
| `/mode` | Status Check | Shows current session mode and active plan file reference. |

# Interactive Terminal Plan Review

The Interactive Plan Reviewer provides a keyboard-driven modal inside the OpenCode TUI, allowing developers to review, annotate, dispute, or approve proposed architectural plans line-by-line before any code is written.

---

## 🖥️ Review Modal Interface

Triggered via `/plan review [name]` or automatically after generating a durable RFC file:

```text
┌─────────────────────────────────────────────────────────────┐
│ 🗺️ Plan Review: user-authentication-v2.md                  │
├─────────────────────────────────────────────────────────────┤
│ 1: # Architecture Plan: Multi-Factor Authentication        │
│ 2:                                                          │
│ 3: ## 1. Token Storage Strategy                             │
│ 4: - Store session tokens in local SQLite database          │
│ 5: - Encrypt tokens using AES-256-GCM before write          │
│ 6:                                                          │
│ 7: ## 2. Verification Endpoints                             │
│ 8: - POST /auth/verify-totp                                 │
├─────────────────────────────────────────────────────────────┤
│ [↓/↑/j/k] Navigate  [Enter] Annotate Line  [Ctrl+A] Approve │
└─────────────────────────────────────────────────────────────┘
```

---

## ⌨️ Keyboard Shortcuts & Controls

| Keybinding | Action | Description |
| :--- | :--- | :--- |
| `↓` / `j` / `PageDown` | Navigate Down | Move selection cursor down through the plan lines. |
| `↑` / `k` / `PageUp` | Navigate Up | Move selection cursor up through the plan lines. |
| `Enter` | Annotate Line | Opens a native text prompt to attach a specific comment or dispute to the selected line. |
| `Ctrl+A` | Quick Approve | Instantly marks the plan as approved and transitions the session into execution mode (`/approve`). |
| `Esc` | Close / Dismiss | Exits review modal without approving. |

---

## ⚡ Feedback Injection

When lines are annotated during review, feedback is structured into a clean Markdown block and injected directly into the session transcript. The agent refines the proposal based on your exact line references before building.

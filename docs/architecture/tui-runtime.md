# TUI Runtime & Reactive State Engine

`oh-my-hook` delivers real-time visual feedback in the OpenCode TUI through native SolidJS components using `@opentui/solid`.

---

## 🖥️ TUI Architecture Overview

The TUI frontend module (`tui/src/index.tsx`) is compiled to `tui/dist/tui.js` and loaded directly by the OpenCode terminal runtime. It interacts with the core engine without background server processes or heavy IPC polling.

```text
                                                            Context
                                                            191,368 tokens (48% used)

                                                            ▼ Quota
                                                            [OpenRouter] 22% used

                                                       ┌──► ▼ oh-my-hook               ● PLAN
                                                       │    • Mode  : plan (read-only)
                                                       │    • Shields: 7 active
                                                       │    • Memory: 3 notes
                                                       │
                                                            ▼ MCP
                                                            • github Connected
 ▣  Assistant · Gemini 3.7 Flash · 9.3s
┃
┃
┃
┃  Assistant · Gemini 3.7 Flash gateway               PLAN (feature-auth)  /~   ◄── [PROMPT BADGE]
╹▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
```

---

## 🎛️ Integrated UI Surfaces

### 1. `session_prompt_right` (Live Mode Badge)
- **Role**: Displays a dynamic status indicator directly on the right side of the prompt input bar.
- **Behavior**:
  - When the active session is in **Plan Mode**, renders the highlighted `PLAN` badge alongside the active plan name if set (e.g. `PLAN (feature-auth)`).
  - When the session transitions to **Execute Mode** via `/approve` or `/exec`, the badge disappears automatically to keep the input bar clean and distraction-free.

### 2. `sidebar_content` (Collapsible Metrics Widget & Tokens Tree)
- **Role**: Renders an interactive, collapsible sidebar panel with reactive status badges (`● PLAN` / `● EXEC` / `● ACTIVE`).
- **Data Displayed**:
  - **Mode**: Active session mode status (`plan (read-only)` or `execute`).
  - **Shields**: Number of currently active runtime guardrails.
  - **Memory**: Count of stored curated memory bullets across global and project scopes.
  - **Pruned**: Total count and token savings from in-memory context pruning.
  - **Tokens Tree**: Live hierarchical token consumption breakdown for the primary session, last turn delta, and all active subagents.

---

## ⚡ Zero-IPC State Watcher

To ensure zero CPU overhead and instant UI reactivity, state synchronization relies on a lightweight file watcher:

1. **State Persistence**: When a session mode changes (e.g. via `/plan` or `/approve`), state is written to `~/.local/share/opencode/oh-my-hook-mode.json`.
2. **Debounced FS Watcher**: The TUI module listens to directory changes using a debounced (50ms) file watcher (`tui/src/lib/mode-watch.js`).
3. **SolidJS Reactive Signals**: State changes update SolidJS signals immediately, triggering targeted DOM/terminal reconciliations without redrawing the entire screen.

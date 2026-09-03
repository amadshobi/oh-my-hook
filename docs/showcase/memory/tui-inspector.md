# Native TUI Memory Inspector

`oh-my-hook` includes an interactive memory inspector modal rendered directly in the OpenCode TUI using native `DialogSelect` and `DialogPrompt` components.

---

## ️ Modal Interface

Triggered via keymap or interactive commands:

```text
┌─────────────────────────────────────────────────────────────┐
│ Curated Memory Inspector │
├─────────────────────────────────────────────────────────────┤
│ [Project] Always use bun test for unit test pipelines │
│ [Project] Run biome check --apply before git commits │
│ [Global] Preferred user nickname: BOSS │
│ [Global] Never generate emojis in code or commit messages │
├─────────────────────────────────────────────────────────────┤
│ [Enter] Edit [Ctrl+A] Add [Ctrl+D] Delete [↓/↑] Navigate │
└─────────────────────────────────────────────────────────────┘
```

---

## ⌨️ Modal Keybindings

| Keybinding | Action | Description |
| :--- | :--- | :--- |
| `↓` / `↑` / `j` / `k` | Navigate & Search | Browse memory bullets or type to live fuzzy search. |
| `Enter` | Edit Memory | Opens pre-filled `DialogPrompt` to modify selected memory. |
| `Ctrl+A` | Add Memory | Opens prompt to create a new curated note. |
| `Ctrl+D` (2x) | Delete Memory | Highlights entry in red; press a second time to confirm deletion. |
| `Esc` | Close | Closes inspector without changes. |

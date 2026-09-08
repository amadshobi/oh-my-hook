# Quick File Picker (Ctrl+O & /file)

The oh-my-hook quick file picker is a zero-token TUI shortcut that lists every
discoverable file in your workspace, fuzzy-searches it, and inserts the chosen
relative path directly into the active prompt textarea — without ever sending a message to the model.

---

## Triggering

| Method | Action |
| --- | --- |
| Slash Command | Type `/file` in the prompt input to trigger autocomplete and launch |
| Keyboard | Press `Ctrl+O` anywhere in the OpenCode TUI |
| Command Palette | Search for **File Picker** (`oh-my-hook.picker.file`) |

Disable it entirely by setting `"picker": { "enabled": false }` in `omh.jsonc`.

## Zero-Token File Referencing

Typing or dragging paths into the model wastes context and invites typos. The
picker instead copies a clean workspace-relative path:

```text
┌─ File Picker ────────────────────────────────────────────┐
│ search: tui/src/                                         │
│                                                          │
│  tui/src/index.tsx                    [tui/src]          │
│  tui/src/lib/clipboard-write.js       [tui/src/lib]      │
│  tui/src/lib/file-discovery.js        [tui/src/lib]      │
│  tui/src/lib/metrics.js               [tui/src/lib]      │
│                                                          │
│  copy  enter                              184 files       │
└──────────────────────────────────────────────────────────┘
```

- **Fuzzy search** is instant, powered by the native OpenCode `DialogSelect`.
- **Folder categories** group files by their containing directory for quick
  scanning (`root` for top-level files).
- Files come from `git ls-files` (git workspaces) or a BFS walk (plain
  folders), cached for 30 seconds.

## OSC 52 Terminal Copy

On select the picker writes the path to the clipboard through the **OSC 52
terminal escape sequence**. Because the sequence is processed by the terminal
emulator rather than a local helper binary, it works anywhere your terminal
works:

- **Remote SSH sessions** — the path is copied on your local machine.
- **tmux** — the payload is wrapped in the tmux passthrough prefix.
- **Mobile / Termius / web terminals** — no local binaries required.

When a native tool is also reachable (local desktop sessions), oh-my-hook
writes through it in parallel for reliability: `wl-copy` (Wayland), `xclip` /
`xsel` (X11), `pbcopy` (macOS), `clip.exe` (Windows / WSL).

```text
src/index.ts  ──►  \x1b]52;c;<base64>\x07  ──►  terminal clipboard
                   └──── OSC 52 (SSH/tmux/mobile)
               ──►  wl-copy / xclip / pbcopy / clip.exe
                    └──── native fallback (local desktop)
```

## Anti-Collision Compliance

The picker is registered as a **pure TUI keymap command** with the explicit
`namespace: "palette"` and **no `slashName`**. This complies with the
oh-my-hook autocomplete anti-collision rule: because the command is not part of
the server command catalog (`cfg.command`), it never duplicates slash menu
entries, and the OpenCode TUI autocomplete stays free of double-listed items.

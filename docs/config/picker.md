# Picker Configuration

Configuration options for the quick file path picker modal in the OpenCode TUI.

---

## Overview

The file picker is triggered via `Ctrl+O`, slash command `/file`, or Command Palette
that lists all discoverable files in the current workspace. Selecting a file inserts
its relative path directly into the prompt textarea and copies to clipboard without
consuming any model tokens.

## Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "picker": {
    "enabled": true
  }
}
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `picker.enabled` | `boolean` | `true` | Enable or disable the quick file path picker modal (`Ctrl+O` / `/file`). Set to `false` to remove the command, slash handler, and key binding entirely. |

## Behavior Notes

- File discovery runs through `git ls-files` when the workspace is a git
  repository, falling back to a bounded BFS directory walk otherwise. Results
  are cached for 30 seconds (`CACHE_TTL_MS`).
- Only tracked and untracked files are listed; `.gitignore`d and
  dependency/build directories (`node_modules`, `dist`, `.next`, ...) never
  appear.
- The copied path is workspace-relative and uses POSIX separators (`/`),
  making it safe to paste into tool invocations, prompts, and shell commands.

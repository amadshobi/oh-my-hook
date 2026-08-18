# AGENTS.md — oh-my-hook

OpenCode plugin suite (Command Code-style agent loop). All code lives in
`~/projects/oh-my-hook/`. This file guides agents working
on this codebase.

## Overview

The plugin assembles multiple hook modules into ONE hooks object via
`index.js`, alongside an OpenCode TUI surface module in `tui/`:

- `guard/` — hard enforcement (mode, security, read-guard, tool-policy). Throws to block.
- `plans/` — dual-mode planning suite (`/plan`, `/design`, `/approve`, `/exec`, `/mode`), auto-versioning in `plans/versions/`, 3-level prompt templates.
- `context/` — session context & compaction snapshot.
- `reminder/` — soft nudges (verify loop, checklist).
- `memory/` — curated memory: auto-loads into system prompt (main agent only) + compaction; `/remember`, `/memory`, `/capture` slash commands; pluggable AI adapters in `memory/ai/` for capture.
- `tui/` — OpenCode TUI frontend module (`session_prompt_right` live plan badge & `sidebar_content` collapsible widget).

## Config

oh-my-hook config lives in `~/.config/opencode/omh.jsonc` (not in
opencode.jsonc). `share/config.js` loads it with multifile support
(`.jsonc`/`.json`/`.yaml`/`.yml`), layered over `DEFAULTS` via
`mergeConfig`. All module factories accept `{ config }` and respect flags.

- When adding a configurable flag: add it to `DEFAULTS` in
  `share/config.js`, pass `config.<section>` into the factory, and read it
  with a `?? default` fallback.
- Never hardcode a toggle in module logic — route it through config.
- TUI surface is enabled by registering the package in both `~/.config/opencode/opencode.jsonc` and `~/.config/opencode/tui.jsonc`.

## Architecture rules

- **One package, dual surfaces.** Root `package.json` declares `"oc-plugin": ["server", "tui"]` with `"exports"` pointing `.` and `./server` to `index.js` and `./tui` to `tui/dist/tui.js`.
- **`share/` is the only shared dependency layer.** Cross-module helpers go
  here: `path.js`, `notify.js`, `block.js`, `messages.js`, `state.js` (ledger + mode state),
  `agent.js`, `merge.js`, `hook.js`. Always use `createNotifier` from `share/notify.js`.
- **`mergeHooks` composes hook objects** — function values chain (all run),
  object values merge by key. Use it in every `index.js`.
- **Hard blocks throw; soft nudges warn.** Guard violations `throw new
Error(blockMessage(...))` so the model sees a clear reason. Reminders use
  `warnMessage(...)` and never hard-block.
- **State persists via `share/state.js`** — read-ledger,
  mode-state, and active plan files live in `~/.config/opencode/` or `~/.opencode/plans/`. Always restore/cleanup
  state in test `finally` blocks.
- **Plan Mode Whitelist** — while mode plan is active, writes/edits targeting `~/.opencode/plans/` or the designated active plan file are allowed; project code mutations remain strictly blocked.
- **Never use `require` in ESM modules** — use `import { existsSync } from
"node:fs"`.
- **Memory is curated only** — never auto-log conversation. Fill it via
  `/remember` or `/capture` (AI distill). Memory injects into the main
  agent's system prompt; subagents get none automatically.
- **Slash commands register via the `config` hook** (`cfg.command[name] =
{ template, description }`) and are handled in `command.execute.before`
  — the opencode-quota pattern. Keep template/description short.
- **Memory capture AI is pluggable** — adapters live in `memory/ai/`,
  exporting `{ id, isAvailable(), run(prompt, opts) }`. The default is
  `commandcode` (`cmd -p`). Don't hardcode a binary in capture logic.
- **Capture calls must be ephemeral** — `cmd`/`omp` get `--no-session`;
  `opencode run` auto-deletes its session. Never leave capture sessions
  in logs/db.

## File conventions

- Plain ESM JavaScript (`"type": "module"`), `node:fs` / `node:path` /
  `node:child_process` built-ins only for the core runtime.
- One exported factory per module returning a hooks object (or a merge of
  them via `index.js`).
- Hook input shapes are normalized via `share/hook.js`:
  `toolArgs(input)`, `bashCommand(args)`, `filePathOf(args)`.
- Block/warn messages follow `share/style-guide.md` — build them with
  `formatBlockMessage()` / `formatWarnMessage()` in `share/messages.js`.
- When committing, follow Conventional Commits and append the appropriate co-author trailer:
  - In OpenCode: `git commit -m "type(scope): description" -m "Co-authored-by: OpenCode <noreply@opencode.ai>"`
  - In Command Code: `git commit -m "type(scope): description" -m "Co-authored-by: Command Code <noreply@commandcode.ai>"`

## Testing

```bash
npm test          # unit tests (node --test tests/*.test.js)
npm run test:e2e  # E2E hook pipelines (stale-write, tool-policy, mode, security, plans)
npm run test:all  # both
```

- E2E auto-deletes its session via `opencode session delete <id>` — never
  leave test sessions behind.
- Hook E2E tests are deterministic and run without external LLM providers.

### Manual / Headless E2E Verification Workflow

Untuk menguji perilaku hook / memory generation secara live di terminal (tanpa TUI):

```bash
# 1. Test Project-Scoped Memory
mkdir -p /tmp/test-my-project
opencode run --dir /tmp/test-my-project "/remember Di repo ini wajib gunakan bun untuk testing"
# Verifikasi hasil: cat ~/.config/opencode/memory/projects/tmp/test-my-project/MEMORY.md

# 2. Test Global-Scoped Memory (dari Home ~)
opencode run --dir ~ "/remember Panggil user dengan sebutan BOSS"
# Verifikasi hasil: cat ~/.config/opencode/memory/MEMORY.md

# 3. Cleanup test project setelah selesai
rm -rf /tmp/test-my-project ~/.config/opencode/memory/projects/tmp/test-my-project
```

_Catatan: Pengujian antarmuka TUI (popup modal, esc key handler, sidebar widget) dilakukan secara manual dan langsung oleh user di TUI interactive session._

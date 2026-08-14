# AGENTS.md — oh-my-hook

OpenCode plugin suite (Command Code-style agent loop). All code lives in
`~/projects/oh-my-hook/`. This file guides agents working
on this codebase.

## Overview

The plugin assembles multiple hook modules into ONE hooks object via
`index.js`. Each module owns a domain:

- `guard/` — hard enforcement (mode, security, read-guard). Throws to block.
- `context/` — session context & compaction snapshot.
- `reminder/` — soft nudges (verify loop, checklist).
- `memory/` — curated memory: auto-loads into system prompt (main agent
  only) + compaction; `/remember`, `/memory`, `/capture` slash commands;
  pluggable AI adapters in `memory/ai/` for capture.

## Config

oh-my-hook config lives in `~/.config/opencode/omh.jsonc` (not in
opencode.jsonc). `share/config.js` loads it with multifile support
(`.jsonc`/`.json`/`.yaml`/`.yml`), layered over `DEFAULTS` via
`mergeConfig`. All module factories accept `{ config }` and respect flags.

- When adding a configurable flag: add it to `DEFAULTS` in
  `share/config.js`, pass `config.<section>` into the factory, and read it
  with a `?? default` fallback.
- Never hardcode a toggle in module logic — route it through config.

## Architecture rules

- **One entry, one config entry.** `index.js` is the ONLY file registered in
  `opencode.jsonc` (`"oh-my-hook"` or `"./path/to/oh-my-hook/index.js"`). It composes modules.
- **`share/` is the only shared dependency layer.** Cross-module helpers go
  here: `notify.js`, `block.js`, `messages.js`, `state.js` (ledger + mode state),
  `agent.js`, `merge.js`, `hook.js`. Always use `createNotifier` from `share/notify.js`.
- **`mergeHooks` composes hook objects** — function values chain (all run),
  object values merge by key. Use it in every `index.js`.
- **Hard blocks throw; soft nudges warn.** Guard violations `throw new
Error(blockMessage(...))` so the model sees a clear reason. Reminders use
  `warnMessage(...)` and never hard-block.
- **State persists via `share/state.js`** — read-ledger &
  mode-state files live in `~/.config/opencode/`. Always restore/cleanup
  state in test `finally` blocks.
- **Never use `require` in ESM modules** — use `import { existsSync } from
"node:fs"`. (Historical bug: a `require()` inside try/catch silently
  disabled the guard under plain Node.)
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
- **`/capture` sources context from the real session** — it exports the
  OpenCode session (`opencode export <id>`), extracts the transcript, and
  hands it to the capture AI for distill. Auto-capture on `session.idle`
  is opt-in via `memory.captureAuto`.

## File conventions

- Plain ESM JavaScript (`"type": "module"`), `node:fs` / `node:path` /
  `node:child_process` built-ins only.
- One exported factory per module returning a hooks object (or a merge of
  them via `index.js`).
- Hook input shapes are normalized via `share/hook.js`:
  `toolArgs(input)`, `bashCommand(args)`, `filePathOf(args)`.
- Block/warn messages follow `share/style-guide.md` — build them with
  `formatBlockMessage()` / `formatWarnMessage()` in `share/messages.js`.
- When committing, follow Conventional Commits and append the appropriate co-author trailer:
  - In OpenCode: `git commit -m "type(scope): description" -m "Co-authored-by: OpenCode <noreply@opencode.ai>"`
  - In Command Code: `git commit -m "type(scope): description" -m "Co-authored-by: Command Code <noreply@commandcode.ai>"`

## Adding a new guardrail / hook

1. Create the file in the right module (e.g. `guard/policy.js`).
2. Export a factory `export const policyHooks = async (input) => ({...})`.
3. Wire into that module's `index.js` with `mergeHooks`.
4. Add a unit test in `tests/` (node:test) — or an E2E in `tests/e2e/`
   for behavior that needs a real OpenCode run.
5. Run `npm run test:all`.

## Testing

```bash
npm test          # unit tests (node --test tests/*.test.js)
npm run test:e2e  # E2E: read-guard (real headless opencode) + stale-write
npm run test:all  # both
```

- E2E default model: `omp/hy3:free`. Override: `node tests/e2e/read-guard.e2e.js "<model>"`.
- E2E auto-deletes its session via `opencode session delete <id>` — never
  leave test sessions behind.
- E2E costs ~0 (free model) but takes ~30s per run — don't loop it in CI
  without a provider.

## Gotchas

- `tool.execute.before` receives `(input, output)`; tool args may be under
  `input.args`, `input.toolArgs`, or the string form — always normalize
  through `share/hook.js`.
- The read-ledger is partitioned per-session (`ledger[sessionID]`). Tests must save & restore
  the original ledger entries in `finally`.
- `createReadGuard({ directory })` enforces only files INSIDE the workspace
  root — out-of-workspace files are intentionally skipped.
- Auto-fix tools (eslint --fix, prettier) mutate files outside the model's
  write path — `reminder/verify.js` calls `refreshReads()` so read-guard
  doesn't treat them as stale afterward.
- `context/context.js` has 4 intentionally-unused declarations left from
  half-finished features: `COMPACTION_LOG`, `NOTIFICATION_LOG`,
  `appendFileSync`, `readdirSync`. Do NOT delete them without first
  deciding whether to wire them up (compaction audit trail, notification
  log, learnings aggregation) — they are documented intent, not junk.

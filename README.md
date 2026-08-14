# oh-my-hook

Command Code-style workflow plugins for **OpenCode**. Brings the "terarah, gak asal-asalan" agent loop into OpenCode: mode enforcement, read-before-write, security guardrails, session context, and verification reminders.

## Install

The plugin can be installed as a package or loaded from local directory in `opencode.jsonc`:

```jsonc
{
  "plugin": ["@slkiser/opencode-quota@latest", "oh-my-hook"],
}
```

Or for local development:

```jsonc
{
  "plugin": [
    "@slkiser/opencode-quota@latest",
    "./projects/oh-my-hook/index.js",
  ],
}
```

Restart OpenCode after adding it. To verify it loaded:

```bash
opencode run --print-logs --log-level DEBUG "reply OK" 2>&1 | grep -i "oh.my.hook"
```

## Config

oh-my-hook reads its own config from `~/.config/opencode/omh.jsonc` — **not**
from `opencode.jsonc`, so plugin settings never clutter the main config.
Multifile: rename the extension to `.json`, `.yaml`, or `.yml` — whichever
you prefer; first existing wins (`.jsonc` > `.json` > `.yaml` > `.yml`).
If the file is missing, all features use defaults (enabled).

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "memory": {
    "enabled": true,
    "captureAdapter": "commandcode",
    "captureModels": {
      "commandcode": "",
      "opencode": "omp/hy3:free",
      "omp": "gemini-3.6-flash",
    },
    "maxBullets": 10,
    "injectToSubagents": false,
    "captureAuto": false,
  },
  "guard": {
    "readBeforeWrite": true,
    "staleWrite": true,
    "planMode": true,
    "secretScanner": true,
    "commitGuard": true,
    "devServerGuard": true,
    "dangerousBash": true,
  },
  "context": {
    "compactionSnapshot": true,
    "promptCheck": true,
    "compactThreshold": 50,
  },
  "reminder": { "verify": true, "checklist": true },
  "messages": {
    "dangerousBash": "Perintah '{command}' dilarang demi keamanan!",
    "modePlanTool": "{file:~/.config/opencode/prompts/plan-blocked.md}",
  },
}
```

See the installed `~/.config/opencode/omh.jsonc` for a commented template.

## Structure

```
oh-my-hook/
├── index.js                 # single entry — assembles all hooks into one object
├── package.json             # npm test / test:e2e / test:all
├── share/                   # reusable helpers & state
│   ├── notify.js            # createNotifier structured logger
│   ├── block.js             # blockMessage / warnMessage (+ style guide)
│   ├── messages.js          # hybrid message dictionary, interpolation & {file:...} loader
│   ├── state.js             # per-session read-ledger, mode-state, json helpers
│   ├── agent.js             # agent & subagent role helpers
│   ├── merge.js             # combine multiple hooks objects into one
│   ├── hook.js              # extract toolArgs / command / filePath from hook input
│   └── style-guide.md       # guardrail message format (🚫 block / ⚠️ warn / 💡 info)
├── guard/                   # 🔒 hard enforcement (blocks)
│   ├── mode.js              # plan/execute mode enforcement
│   ├── security.js          # secret scanner, commit guard, dev server, push
│   ├── read-guard.js        # read-before-write + stale-write (per-session)
│   └── index.js
├── context/                 # 🧠 session context
│   ├── context.js           # session tracking, compaction snapshot, prompt check
│   ├── agent-context.js     # agent-specific context boundaries
│   └── index.js
├── reminder/                # 🔔 soft nudges
│   ├── verify.js            # typecheck/lint/auto-fix/test/bundle after edit
│   ├── checklist.js         # multi-step task → checklist nudge
│   └── index.js
├── memory/                  # 🧠 curated memory (auto-load per session + compaction)
│   ├── store.js             # read/write MEMORY.md (global + per-project)
│   ├── index.js             # inject hooks + /remember /memory /capture commands
│   └── ai/                  # pluggable AI adapters for /capture
│       ├── commandcode.js   # default — calls `cmd -p` (Command Code headless)
│       ├── opencode.js      # calls `opencode run` (auto-deletes session)
│       └── omp.js           # calls `omp` agent CLI
└── tests/
    ├── merge.test.js        # unit tests for merge-hooks
    ├── state.test.js        # unit tests for ledger/stale detection
    └── e2e/
        ├── read-guard.e2e.js       # E2E against real headless OpenCode
        └── stale-write.hook.e2e.js # deterministic hook-pipeline test
```

## Features

### 🔒 Guard — hard blocks (throw from `tool.execute.before`)

| Feature               | What it does                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan/execute mode** | Detects intent from prompts (`plan`, `mikir` → plan; `gas`, `bikin` → execute). In plan mode, all mutating tools & mutating bash are blocked. State persists per-session. |
| **Read-before-write** | Blocks `write`/`edit`/`patch` on existing files that were never read this session. Forces the READ → UNDERSTAND → CHANGE → CHECK loop.                                    |
| **Stale-write**       | Blocks writes when the on-disk file changed after the model read it (mtime/size mismatch). Prevents lost updates from concurrent edits.                                   |
| **Secret scanner**    | Blocks write/edit containing API keys, tokens, private keys, DB URLs, JWTs.                                                                                               |
| **Commit guard**      | Blocks `git commit` with non-conventional-commit messages.                                                                                                                |
| **Dangerous bash**    | Blocks `rm -rf /`, fork bombs, `dd` to disk, `curl                                                                                                                        | sh`, etc. |
| **Dev server guard**  | Blocks dev server commands outside tmux/screen (prevents orphan processes).                                                                                               |

### 🧠 Context — session awareness

- **Compaction snapshot** — injects git status + pending todos + reminders into the compaction prompt so the model doesn't lose context after compact.
- **Session tracking** — records package manager, edit counts, per-day learning log.
- **Prompt check** — warns on vague / too-short prompts.

### 🔔 Reminder — soft nudges (warn, not block)

- **Verify loop** — after each edit: typecheck (ts/tsx), lint + auto-fix, run related tests, check bundle size. Results land in tool output metadata.
- **Checklist** — detects multi-step prompts and reminds the model to break them into a checklist (`.opencode/todos.json`).

### 🧠 Memory — curated, auto-load

Memory is **curated only** — never auto-logged from conversation. It auto-loads into the main agent's system prompt on every turn and into the compaction context. **Subagents do NOT get memory automatically** (keeps their context focused); to pass memory to a subagent, include it in the task prompt.

| Command                | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `/remember <note>`     | Append a memory entry (project by default; `--global` for global)     |
| `/memory`              | Show current global + project memory                                  |
| `/capture [sessionID]` | Distill the last OpenCode session (or a given one) into memory via AI |

**Storage:**

```
~/.config/opencode/memory/MEMORY.md                  # global
~/.config/opencode/memory/projects/<path>/MEMORY.md  # per-project
```

Format: markdown, one `- ` bullet per topic (easy to hand-edit).

**Capture AI is pluggable** (`memory/ai/`): `commandcode.js` calls
`cmd -p --no-session` (Command Code headless, ephemeral — nothing saved).
`opencode.js` calls `opencode run` (auto-deletes its session). `omp.js`
calls `omp -p --no-session --mode json` (Pi agent). All capture calls run
with `--no-session` so they never pollute session logs. Add more adapters
in `memory/ai/index.js`.

## State files

| File                                                  | Purpose                                |
| ----------------------------------------------------- | -------------------------------------- |
| `~/.config/opencode/oh-my-hook-read-ledger.json`      | Read-before-write / stale-write ledger |
| `~/.config/opencode/oh-my-hook-mode.json`             | Plan/execute mode per session          |
| `~/.opencode/session-context.json`                    | Session tracking (shared with context) |
| `~/.config/opencode/memory/MEMORY.md`                 | Global curated memory                  |
| `~/.config/opencode/memory/projects/<path>/MEMORY.md` | Per-project curated memory             |

## Adding a new guardrail

1. Create a file in the matching module, e.g. `guard/my-rule.js`.
2. Export a hook object (`tool.execute.before` / `tool.execute.after` / `event`).
3. Wire it in the module's `index.js` via `mergeHooks`.
4. Add a test in `tests/`.

## Tests

```bash
npm test          # unit tests (merge, state)
npm run test:e2e  # E2E: read-guard (real OpenCode) + stale-write (hook pipeline)
npm run test:all  # both
```

E2E notes:

- Uses the model `omp/hy3:free` by default (override with `node tests/e2e/read-guard.e2e.js "<model>"`).
- Runs headless `opencode run --format json`, asserts the guard behavior, then **auto-deletes the session** (`opencode session delete <id>`) — OpenCode has no `--no-session` flag.
- Requires an authenticated provider configured in OpenCode.

## Not part of oh-my-hook

- `plugins/pixtuoid.ts` — generated by pixtuoid daemon, do not touch.
- `plugins/sounds/` — separate concern.

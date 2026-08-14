<div align="center">

# 🪝 oh-my-hook

**Production-grade guardrails, execution discipline, and curated memory for OpenCode agents.**

[![CI](https://github.com/amadshobi/oh-my-hook/actions/workflows/ci.yml/badge.svg)](https://github.com/amadshobi/oh-my-hook/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg?style=flat-square)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/ecosystem-opencode-purple.svg?style=flat-square)](https://opencode.ai)

_Stop AI agents from hallucinating file writes, leaking credentials, executing destructive bash, or losing memory after context compaction._

---

[Key Pillars](#-key-pillars) •
[Why oh-my-hook?](#-why-oh-my-hook) •
[Architecture](#-architecture-flow) •
[Installation](#-installation) •
[Configuration](#-configuration-omhjsonc) •
[Guardrail Suite](#-guardrail-suite) •
[Curated Memory](#-curated-memory-engine) •
[Development & Tests](#-testing--development)

</div>

---

## ⚡ Key Pillars

- 🔒 **Hard Enforcement (`tool.execute.before`)**: Strict pre-execution gates that reject destructive bash commands, unread file overrides, stale concurrent mutations, and credential leaks.
- 🛡️ **Plan vs. Execute State Machine**: Deterministic prompt intent classifier (`plan`/`mikir` vs `gas`/`bikin`) that locks down mutating tools during architecture and design phases.
- 🧠 **Curated Distilled Memory (`/capture`)**: Zero-noise memory engine. Only loads curated bullets into the primary agent, keeping subagent contexts clean and compaction snapshots lossless.
- 🔔 **Autonomous Verification Loop**: Runs typechecking, linter auto-fixes, and tests immediately after edits while automatically refreshing ledger state.
- 🪶 **Zero Dependencies**: 100% pure Node.js ESM built-ins (`node:fs`, `node:path`, `node:child_process`). Lightweight, instant startup, zero supply-chain risk.

---

## 🥊 Why oh-my-hook?

| Risk / Scenario                | Raw OpenCode Agent                                               | With `oh-my-hook` 🪝                                                          |
| :----------------------------- | :--------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| **Overwriting Unread Files**   | Model guesses structure and rewrites entire files blindly.       | **🚫 Blocked**: `readBeforeWrite` forces `read` before `edit`/`write`.        |
| **Concurrent File Mutation**   | Overwrites changes made by user or external scripts.             | **🚫 Blocked**: `staleWrite` checks `mtime` & byte size before mutation.      |
| **Accidental Secret Leaks**    | API keys, JWTs, and AWS tokens written to public code.           | **🚫 Blocked**: `secretScanner` scans payloads with regex AST patterns.       |
| **Plan Phase Runaway**         | Agent starts editing codebase while asked to brainstorm.         | **🚫 Blocked**: `planMode` disables mutating tools until explicit trigger.    |
| **Destructive Terminal Ops**   | Commands like `rm -rf /`, `curl \| sh`, or detached dev servers. | **🚫 Blocked**: `dangerousBash` & `devServerGuard` stop dangerous ops.        |
| **Context Loss on Compaction** | Agent forgets git state, active tasks, and project rules.        | **💡 Injected**: `compactionSnapshot` injects git state + todos into summary. |
| **Session Memory Drift**       | Auto-memory logs conversational spam and hallucinates.           | **🧠 Curated**: Markdown storage + AI session distillation via `/capture`.    |

---

## 📐 Architecture Flow

```
                     ┌────────────────────────────────────────────────────────┐
                     │                   User Prompt / Event                  │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
                                     [Intent State Analyzer]
                                  (Sets Session Mode: Plan/Exec)
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
            [system.transform]          [tool.execute.before]         [command.execute]
                    │                            │                            │
         • Inject Curated Memory         • Read-Before-Write Guard       • /remember
         • Session Compaction Snapshot   • Stale-Write Checker           • /memory
         • Agent Boundary Isolation      • Secret AST Scanner            • /capture (AI Distill)
                                         • Dangerous Bash Barrier
                                         • Commit Message Guard
                                                 │
                                           [Tool Runs]
                                                 │
                                        [tool.execute.after]
                                                 │
                                         • Typecheck (TS/TSX)
                                         • Lint & Auto-fixer
                                         • Ledger State Sync
```

---

## 📦 Installation

Add `oh-my-hook` to your OpenCode configuration in `~/.config/opencode/opencode.jsonc`:

### Production (Package)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["oh-my-hook"],
}
```

### Local Development / Monorepo

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/absolute/path/to/oh-my-hook/index.js"],
}
```

Verify the plugin loads properly:

```bash
opencode run --print-logs --log-level DEBUG "reply OK" 2>&1 | grep -i "oh.my.hook"
```

---

## ⚙️ Configuration (`omh.jsonc`)

`oh-my-hook` keeps your main `opencode.jsonc` uncluttered by maintaining its configuration in a dedicated file: `~/.config/opencode/omh.jsonc`.

Supports multiple formats with automatic priority resolution:
`omh.jsonc` > `omh.json` > `omh.yaml` > `omh.yml`

```jsonc
{
  // 🧠 Curated Memory & Session Distillation
  "memory": {
    "enabled": true,
    "captureAdapter": "commandcode", // "commandcode" | "opencode" | "omp"
    "captureModels": {
      "commandcode": "",
      "opencode": "omp/hy3:free",
      "omp": "gemini-3.6-flash",
    },
    "maxBullets": 10,
    "injectToSubagents": false, // Keep subagents isolated & lightweight
    "captureAuto": false, // Auto-distill on session idle
  },

  // 🔒 Hard Blocking Guardrails
  "guard": {
    "readBeforeWrite": true, // Enforce READ -> UNDERSTAND -> EDIT loop
    "staleWrite": true, // Prevent race conditions on changed files
    "planMode": true, // Freeze file mutation during planning phase
    "secretScanner": true, // Block hardcoded API keys, JWTs, private keys
    "commitGuard": true, // Enforce Conventional Commits format
    "devServerGuard": true, // Prevent orphan background servers outside tmux
    "dangerousBash": true, // Block rm -rf, fork bombs, disk overwrites
  },

  // 🧠 Context & Compaction Engine
  "context": {
    "compactionSnapshot": true, // Inject git diff & pending todos into compaction
    "promptCheck": true, // Warn on ambiguous / single-word prompts
    "compactThreshold": 50,
  },

  // 🔔 Post-Execution Verification
  "reminder": {
    "verify": true, // Run auto-typecheck & linter after edits
    "checklist": true, // Nudge agents to split complex steps into todos
  },

  // 💬 Dynamic Custom Block & Warning Messages
  "messages": {
    "dangerousBash": "Perintah '{command}' dilarang demi keamanan sistem!",
    "modePlanTool": "{file:~/.config/opencode/prompts/plan-blocked.md}",
  },
}
```

---

## 🔒 Guardrail Suite

### 1. Read-Before-Write & Stale-Write Protection

Forces the agent to read and understand the file in the current session before applying any modifications. If another process or developer modifies the file on disk after the agent read it, the write is immediately rejected.

```
#### 🚫 GUARDRAIL BLOCK: Read-Before-Write
> *File 'src/auth/token.js' belum pernah dibaca dalam session ini.*
> *Gunakan tool read/grep terlebih dahulu sebelum memodifikasi file.*
```

### 2. Plan vs. Execute State Machine

Detects intent keywords in prompts:

- **Plan Mode Trigger**: `plan`, `mikir`, `analisa`, `review`, `arsitektur`
- **Execute Mode Trigger**: `gas`, `gasken`, `bikin`, `execute`, `implement`

In Plan Mode, all file writes, edits, and mutating bash commands (`touch`, `mkdir`, `rm`, `sed`, `git`) are strictly blocked.

### 3. Secret Scanner

Scans tool input arguments (`write`, `edit`, `patch`) against production regex signatures for:

- GitHub Personal Access Tokens (`ghp_`, `gho_`, `github_pat_`)
- OpenAI / Anthropic / Google AI API keys
- AWS Access Key IDs & Secret Access Keys
- RSA / OpenSSH Private Keys
- Database Connection Strings (`postgres://`, `mongodb+srv://`)
- JSON Web Tokens (JWT)

---

## 🧠 Curated Memory Engine

Unlike naive memory plugins that dump raw conversation transcripts into memory files, `oh-my-hook` uses **Curated Distillation**:

```
~/.config/opencode/memory/
├── MEMORY.md                          # Global cross-project memory
└── projects/
    └── <project-slug>/
        └── MEMORY.md                  # Project-specific curated rules
```

### Interactive Slash Commands:

- `/remember <note>`: Append a curated bullet to current project memory (pass `--global` for global scope).
- `/memory`: Inspect current active global + project memory bullets.
- `/capture [sessionID]`: Run an ephemeral headless AI distillation worker to summarize lessons learned from the session into actionable bullet points.

### Pluggable AI Adapters (`memory/ai/`):

- `commandcode` (_Default_): Calls headless `cmd -p --no-session` (zero disk trace).
- `opencode`: Invokes headless `opencode run` and automatically purges the session ID.
- `omp`: Executes `omp -p --no-session --mode json`.

---

## 🧪 Testing & Development

`oh-my-hook` includes an extensive test suite comprising unit tests and full headless E2E verification pipelines.

```bash
# Run unit tests (Node.js test runner)
npm test

# Run End-to-End headless OpenCode guardrail tests
npm run test:e2e

# Run all test suites
npm run test:all
```

### Continuous Integration

Automated testing via GitHub Actions verifies matrix builds across:

- **Node.js 18.x**
- **Node.js 20.x**
- **Node.js 22.x**

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!

1. Check existing issues or open a new one to discuss changes.
2. Ensure all tests pass (`npm test`).
3. Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`).
4. See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built with precision for the OpenCode Agent Ecosystem.</sub>
</div>

<div align="center">

# 🪝 oh-my-hook

**Production-grade guardrails, execution discipline, curated memory, and native TUI widgets for OpenCode agents.**

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
[TUI Experience](#-openCode-tui-experience) •
[Planning Suite](#-dual-mode-planning-suite) •
[Installation](#-installation) •
[Configuration](#-configuration-omhjsonc) •
[Guardrail Suite](#-guardrail-suite) •
[Curated Memory](#-curated-memory-engine) •
[Testing](#-testing--development)

</div>

---

## ⚡ Key Pillars

- 🔒 **Sandbox Enforcement (`sandbox/`)**: Strict pre-execution gates that reject destructive bash commands, unread file overrides, stale concurrent mutations, and credential leaks. Native `permission.ask` and `shell.env` integration.
- 🗺️ **Dual-Mode Planning Suite (`plans/`)**: In-chat brainstorming or durable RFC file creation (`~/.opencode/plans/`) with auto-versioning, plan mode write boundaries, and 3-level prompt templates.
- 🖥️ **Native TUI Integration**: Real-time `🔒 [plan mode]` prompt badges and collapsible sidebar metrics rendered natively in OpenCode TUI via `@opentui/solid`.
- 🧠 **Curated Distilled Memory (`/capture`)**: Zero-noise memory engine. Only loads curated bullets into the primary agent, keeping subagent contexts clean and compaction snapshots lossless.
- 🔔 **Autonomous Verification Loop**: Runs typechecking, linter auto-fixes, and tests immediately after edits while automatically refreshing ledger state.
- 🪶 **Zero Dependencies Core**: 100% pure Node.js ESM built-ins (`node:fs`, `node:path`, `node:child_process`). Lightweight, instant startup, zero supply-chain risk.

---

## 🥊 Why oh-my-hook?

| Risk / Scenario                | Raw OpenCode Agent                                               | With `oh-my-hook` 🪝                                                          |
| :----------------------------- | :--------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| **Overwriting Unread Files**   | Model guesses structure and rewrites entire files blindly.       | **🚫 Blocked**: `readBeforeWrite` forces `read` before `edit`/`write`.        |
| **Concurrent File Mutation**   | Overwrites changes made by user or external scripts.             | **🚫 Blocked**: `staleWrite` checks `mtime` & byte size before mutation.      |
| **Accidental Secret Leaks**    | API keys, JWTs, and AWS tokens written to public code.           | **🚫 Blocked**: `secretScanner` scans payloads with regex AST patterns.       |
| **Plan Phase Runaway**         | Agent starts editing codebase while asked to brainstorm.         | **🚫 Blocked**: `planMode` disables mutating tools until `/approve`.          |
| **Destructive Terminal Ops**   | Commands like `rm -rf /`, `curl \| sh`, or detached dev servers. | **🚫 Blocked**: `dangerousBash` & `devServerGuard` stop dangerous ops.        |
| **Context Loss on Compaction** | Agent forgets git state, active tasks, and project rules.        | **💡 Injected**: `compactionSnapshot` injects git state + todos into summary. |
| **Session Memory Drift**       | Auto-memory logs conversational spam and hallucinates.           | **🧠 Curated**: Markdown storage + AI session distillation via `/capture`.    |

---

## 📐 Architecture Flow

```
                     ┌────────────────────────────────────────────────────────┐
                     │                   User Prompt / Slash Command          │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
                                     [Intent & Command Router]
                                (/plan, /design, /approve, /mode)
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
            [system.transform]          [tool.execute.before]         [OpenCode TUI]
                    │                            │                            │
         • Inject Curated Memory         • Read-Before-Write Guard       • [plan mode] Prompt Badge
         • Session Compaction Snapshot   • Stale-Write Checker           • ▼ oh-my-hook Sidebar Widget
         • Agent Boundary Isolation      • Secret AST Scanner            • Reactive State Watcher
                                         • Plans Whitelist Gate
                                         • Dangerous Bash Barrier
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

## 🖥️ OpenCode TUI Experience

`oh-my-hook` integrates directly into the OpenCode TUI surface using `@opentui/solid`:

```text
                                                            Context
                                                            191,368 tokens (48% used)

                                                            ▼ Quota
                                                            [OpenRouter] 22% used

                                                       ┌──► ▼ oh-my-hook (COLLAPSIBLE SIDEBAR)
                                                       │    • Mode  : 🔒 Plan (Read-Only)
                                                       │    • Guards: 7 Active
                                                       │    • Memory: 3 Notes
                                                       │
                                                            ▼ MCP
                                                            • github Connected
 ▣  Assistant · Gemini 3.7 Flash · 9.3s
┃
┃
┃
┃  Assistant · Gemini 3.7 Flash omp gateway   🔒 [plan mode]   /~   ◄── [PROMPT BADGE]
╹▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
```

1. **`session_prompt_right` Slot**: Renders a dynamic warning badge `🔒 [plan mode]` when the active session is in plan mode. Hides automatically during execute mode to keep your input bar clean.
2. **`sidebar_content` Slot**: A compact collapsible widget showing active mode, active guardrails count, and curated memory notes.
3. **Resilient Reactive Watcher**: Debounced (50ms) directory watcher tracks session state without IPC or polling overhead.

---

## 🗺️ Dual-Mode Planning Suite

Seamlessly switch between quick conversational brainstorming and durable RFC file generation:

| Command                            | Mode                     | Behavior                                                                                                                                                  |
| :--------------------------------- | :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/plan [topic]`**                | **In-Chat (Ephemeral)**  | Locks file mutations, loads `plan.md`, and brainstorms directly in the chat transcript with zero disk footprint.                                          |
| **`/plan to-file <name> [notes]`** | **File-Based (Durable)** | Targets `~/.opencode/plans/<name>.md`. Auto-archives previous drafts to `plans/versions/<name>-v<N>.md` and whitelists **only** the plan file for writes. |
| **`/design [topic]`**              | **In-Chat (UI/UX)**      | Dedicated UI/UX design workflow loaded from `design.md`.                                                                                                  |
| **`/design to-file <name>`**       | **File-Based (UI/UX)**   | Generates structured UI/UX component specs in `~/.opencode/plans/designs/<name>.md`.                                                                      |
| **`/approve`** _(alias: `/exec`)_  | **Execution Transition** | Injects `approve.md` with active plan file reference, unlocks all project mutations, and readies the agent to build.                                      |
| **`/mode`**                        | **Status Check**         | Inspect active mode and active plan file in the current session.                                                                                          |

### 3-Level Prompt Template Precedence

Prompt templates support custom overrides and dynamic macros (`{plan_file}`, `{plan_name}`, `{topic}`, `{session_id}`, `{target_dir}`):

1. **Project-level**: `<workspace>/.opencode/prompts/<cmd>.md`
2. **Global-level**: `~/.config/opencode/prompts/<cmd>.md`
3. **Built-in default**: `plans/prompts/<cmd>.md`

---

## 📦 Installation

Add `oh-my-hook` to your OpenCode configuration files:

### 1. Server Hooks (`~/.config/opencode/opencode.jsonc`)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-hook", // or "/path/to/oh-my-hook" for local development
  ],
}
```

### 2. TUI Surface (`~/.config/opencode/tui.jsonc`)

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    "oh-my-hook", // or "/path/to/oh-my-hook" for local development
  ],
}
```

---

## ⚙️ Configuration (`omh.jsonc`)

Dedicated configuration file located at `~/.config/opencode/omh.jsonc`:

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

  // 🔒 Sandbox Pre-Execution Safety & Integrity
  "sandbox": {
    "readBeforeWrite": true, // Enforce READ -> UNDERSTAND -> EDIT loop
    "staleWrite": true, // Prevent race conditions on changed files
    "secretScanner": true, // Block hardcoded API keys, JWTs, private keys
    "commitGuard": true, // Enforce Conventional Commits format
    "devServerGuard": true, // Prevent orphan background servers outside tmux
    "dangerousBash": true, // Block rm -rf, fork bombs, disk overwrites
  },

  // 🗺️ Plans & Archiving Configuration
  "plans": {
    "enabled": true,
    "planMode": true, // Freeze file mutation during planning phase
    "directory": "~/.opencode/plans",
    "versionLimit": 20,
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
}
```

---

## 🔒 Sandbox Suite

### 1. Read-Before-Write & Stale-Write Protection

Forces the agent to read and understand the file in the current session before applying any modifications. If another process modifies the file on disk after the agent read it, the write is immediately rejected. Auto-syncs read ledger on successful self-mutations to prevent self-stale lockouts.

```
#### 🚫 GUARDRAIL BLOCK: Read-Before-Write
> *File 'src/auth/token.js' belum pernah dibaca dalam session ini.*
> *Gunakan tool read/grep terlebih dahulu sebelum memodifikasi file.*
```

### 2. Plan Mode Whitelist Gate

When Plan Mode is active, all mutating tools (`edit`, `write`, `delete`, mutating `bash`) are blocked, **except** for files targeting `~/.opencode/plans/`.

```
GUARDRAIL BLOCK: Plan Mode

Alasan: On plan mode, don't write or edit files without a specific trigger.
Saran: Use '/approve' or wait for explicit trigger before modifying code.
```

### 3. Secret Scanner

Scans tool input arguments (`write`, `edit`, `patch`) against production regex signatures for:

- GitHub Personal Access Tokens (`ghp_`, `gho_`, `github_pat_`)
- OpenAI / Anthropic / Google AI API keys
- AWS Access Key IDs, Session STS Keys & Secret Access Keys
- RSA / OpenSSH / PKCS#8 Private Keys (`-----BEGIN PRIVATE KEY-----`)
- Database Connection Strings (`postgres://`, `postgresql://`, `mongodb+srv://`)
- JSON Web Tokens (JWT)

### 4. Native OpenCode Integration (`permission.ask` & `shell.env`)

- **`permission.ask`**: Automatically intercepts and denies risky actions at the core permission gate before annoying modal popups appear.
- **`shell.env`**: Propagates `OMH_SANDBOX=1`, `OMH_SESSION_ID`, and `NO_COLOR=1` into all subshells.

---

## 🧠 Curated Memory & Self-Learning Engine

`oh-my-hook` features a **hybrid continuous learning memory engine** (Reflexio-style architecture) that prevents prompt token bloat while automatically learning user preferences and project SOPs:

```
~/.config/opencode/memory/
├── MEMORY.md                          # Global cross-project memory (auto-selected when running in ~)
└── projects/
    └── <project-slug>/
        └── MEMORY.md                  # Project-specific curated rules (auto-selected in workspace)
```

### Key Highlights:
- **Zero Token Bloat (BM25 Matcher)**: Uses pure JS Okapi BM25 scoring (`memory/matcher.js`) to inject only relevant rules matching the current prompt turn into `experimental.chat.system.transform`.
- **Heuristic Auto-Learning**: Detects user corrections and prohibitions in real-time, queuing them for background AI distillation.
- **Self-Healing & Dedup**: Automatically merges similar rules and supersedes contradictory rules using Jaccard similarity.
- **🖥️ Native TUI Modal Inspector**: Trigger `/memory` to view an interactive popup modal with tab filtering (`[Semua]`, `[Preferences]`, `[Project Skills]`) without polluting chat transcripts.

### Interactive Slash Commands:

- `/remember <note>`: Append a curated bullet to current project/global memory.
- `/memory`: Open native TUI popup dialog to browse active memory rules.
- `/memory-forget <id>`: Retract an obsolete rule by ID.
- `/memory-scan`: Immediately drain and process background distillation queue jobs.
- `/capture [sessionID]`: Run an ephemeral headless AI distillation worker to summarize session lessons.

---

## 🧪 Testing & Development

`oh-my-hook` includes **84 unit tests** and deterministic E2E hook pipeline test suites.

```bash
# Run unit tests
npm test

# Run modular E2E hook pipelines
npm run test:e2e:hooks

# Run headless model E2E test (real OpenCode runner)
npm run test:e2e:read-guard

# Run all test suites
npm run test:all
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built with precision for the OpenCode Agent Ecosystem.</sub>
</div>

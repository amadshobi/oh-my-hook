# Introduction & Philosophy

Autonomous coding agents are powerful, but unbounded agent loops introduce severe risks: hallucinated file rewrites, credential leaks, destructive terminal commands, context runaway, and memory drift.

**oh-my-hook** transforms raw OpenCode agents into disciplined, deterministic, and security-hardened software engineers.

---

## 💥 The Problem: Anatomy of Agent Failures

When coding models operate without runtime supervision, several failure modes emerge:

1. **Unread Overwriting (Hallucinated Structure)**: Models guess file layouts or import trees and blindly execute `write` or `edit`, wiping out existing methods and uncommitted work.
2. **Concurrent Mutation & Stale Edits**: An agent attempts to apply changes based on obsolete assumptions while external processes, linters, or human developers edit files on disk.
3. **Plan Phase Runaway**: When assigned exploratory or brainstorming tasks, agents impulsively begin modifying production source files across multiple directories.
4. **Accidental Credential Leaks**: Model outputs inadvertently generate hardcoded API tokens, private keys, database connection strings, or JWTs directly into git repositories.
5. **Destructive Terminal Operations**: Agents execute dangerous commands like `rm -rf /`, force pushes to `main`, or orphan foreground dev servers that lock up background sessions.
6. **Context Bloat & Token Waste**: Thousands of lines of historical build logs, test dumps, and command outputs saturate context windows, increasing inference costs and degrading reasoning quality.
7. **Compaction Amnesia**: When context windows compact, agents lose track of active todos, git branch milestones, and crucial architectural preferences.

---

## 🏛️ Core Engineering Pillars

`oh-my-hook` addresses these failure modes through six non-negotiable architectural pillars:

### 1. Read Before You Touch (Execution Discipline)
The model is strictly prohibited from mutating any file it has not read in the active session. If an edit is attempted on an unread or stale file, `oh-my-hook` immediately aborts the tool call with an actionable suggestion.

### 2. Zero-Dependency Purity
The server runtime is built exclusively with native Node.js ESM built-ins (`node:fs`, `node:path`, `node:child_process`, `node:crypto`). There are no external npm dependencies in the core hooks engine—ensuring instantaneous startup, zero supply-chain vulnerabilities, and maximum runtime predictability.

### 3. Deterministic 0-Token Slash Commands
Slash commands such as `/plan`, `/usage`, `/compress`, and `/memory` operate completely out-of-band. They execute local system logic, output cleanly into the session transcript, and terminate prompt dispatch using the `handled()` error barrier, consuming **zero LLM tokens**.

### 4. Curated Markdown Memory (Hermes-Style)
Rejecting unstructured chat logging, `oh-my-hook` employs clean, human-editable Markdown files (`MEMORY.md`). Memory notes are explicitly curated by the user or distilled via dedicated background workers (`/capture`), keeping primary agent prompts dense and noise-free.

### 5. Multi-Provider Observability
Provides out-of-band monitoring of multi-provider quota allowances (Google Antigravity, Ollama Cloud, OpenRouter) and live session token consumption without polluting the active LLM context.

### 6. Reactive TUI Surface
Deep integration with OpenCode TUI via `@opentui/solid` renders live status badges (e.g. `PLAN` prompt badge, `● ACTIVE` / `● PLAN` / `● EXEC` sidebar badges) and collapsible tree widgets with zero IPC overhead and sub-50ms reactivity.

---

## 🥊 Before vs. After Matrix

| Scenario | Standard OpenCode Agent | With `oh-my-hook` 🪝 |
| :--- | :--- | :--- |
| **Overwriting Unread Files** | Guesses structure and overwrites blindly. | **Blocked**: Requires `read`/`grep` prior to `edit`/`write`. |
| **Stale Disk Mutation** | Overwrites changes made by human or external tools. | **Blocked**: Verifies `mtime` and byte size against session ledger. |
| **Secret Leaks** | Emits API keys, JWTs, and private keys into code. | **Blocked**: High-entropy regex AST scanning stops write before disk commit. |
| **Brainstorming / Planning** | Modifies codebase during research phase. | **Blocked**: Plan mode mutation lock restricts writes to `~/.opencode/plans/`. |
| **Destructive Terminal Ops** | Runs `rm -rf /`, `curl \| sh`, or detached servers. | **Blocked**: Pre-execution regex barriers intercept hazardous commands. |
| **Context Bloat** | Historical test and build logs consume thousands of tokens. | **Optimized**: Dynamic in-memory pruner collapses bulky tool logs. |
| **Compaction Recovery** | Forgets git state, uncommitted changes, and active tasks. | **Preserved**: Compaction snapshot injects branch state and curated memory. |

---

## 💻 System Requirements

- **Runtime**: Node.js $\ge$ 18.0.0 (ESM native) or Bun $\ge$ 1.0
- **Platform**: Linux, macOS, WSL2
- **Host Application**: OpenCode (`opencode` $\ge$ 0.1.0)

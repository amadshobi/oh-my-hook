# Hook Lifecycle & System Architecture

This document details the internal lifecycle flows, runtime hook events, and execution boundaries of **oh-my-hook**.

---

## End-to-End Macro Flow

```
 ┌────────────────────────────────────────────────────────┐
 │ User Prompt / Slash Command │
 └───────────────────────────┬────────────────────────────┘
 │
 [Intent & Command Router]
 (/plan, /approve, /memory, /usage, ...)
 │
 ┌────────────────────────────┼────────────────────────────┐
 │ │ │
 [system.transform] [tool.execute.before] [OpenCode TUI]
 │ │ │
 • Dynamic System Prompt • Read-Before-Write Guard • Mode Badge (PLAN/EXEC)
 • Curated Memory Injection • Stale-Write Checker • Collapsible Sidebar Widget
 • Compaction Snapshot State • Secret AST Scanner • Reactive State Watcher
 • Agent Boundary Isolation • Plan Mode Whitelist Gate
 • Dangerous Bash Barrier
 │
 [Tool Runs]
 │
 [tool.execute.after]
 │
 • Read Ledger State Sync
 • Verification Loop Check
```

---

## OpenCode Lifecycle Hook Reference

`oh-my-hook` hooks directly into the OpenCode plugin architecture. Below is a reference of each lifecycle event intercepted by the engine.

### 1. `config`
- **When It Runs**: During plugin initialization and session configuration resolution.
- **Role**: Registers slash commands and injects dynamic configuration presets.
- **Participating Modules**:
 - `plans/commands.js`: Registers `/plan`, `/design`, `/approve`, `/exec`, `/mode`.
 - `memory/index.js`: Registers `/memory`, `/remember`.
 - `compress/commands.js`: Registers `/compress`.
 - `usage/index.js`: Registers `/usage`.
 - `imgsee/index.js`: Registers `/imgsee`.

### 2. `experimental.chat.system.transform`
- **When It Runs**: On every chat turn before the system prompt is transmitted to the upstream LLM.
- **Role**: Dynamically transforms the system prompt without altering conversation history.
- **Participating Modules**:
 - `prompts/router.js`: Swaps generic fallback prompts with model-family specific instructions (Minimax, DeepSeek, Qwen) for local gateway endpoints, while preserving runtime `<env>` and working directory metadata.
 - `memory/index.js`: Reads and injects merged Markdown memory (`MEMORY.md`) into the primary agent's system prompt (isolated from subagents).
 - `imgsee/index.js`: Injects system directives for multimodal visual diagnostics.

### 3. `experimental.chat.messages.transform`
- **When It Runs**: Prior to sending message histories to the inference provider.
- **Role**: Modifies the in-memory array of messages to reduce context footprint.
- **Participating Modules**:
 - `compress/pruner.js`: Dynamically collapses large historical tool outputs (`npm test`, `git log`, `go build`) outside the protected recent turn window while strictly preserving failure stack traces (`panic:`, `FAILED`, `npm ERR!`).

### 4. `tool.execute.before`
- **When It Runs**: Immediately prior to the execution of any agent tool call (`write`, `edit`, `bash`, etc.).
- **Role**: Validates safety invariants and aborts execution if a rule is violated.
- **Participating Modules**:
 - `sandbox/read-guard.js`: Enforces that target files have been read in the current session and are not stale on disk.
 - `sandbox/security.js`: Scans tool arguments for credentials (API keys, JWTs, AWS tokens) and dangerous bash patterns (`rm -rf /`, force push to main).
 - `plans/index.js`: Restricts file modifications when Plan Mode is active, allowing writes only to `~/.opencode/plans/`.

### 5. `tool.execute.after`
- **When It Runs**: Immediately following the successful execution of any tool.
- **Role**: Synchronizes internal state and executes automated checks.
- **Participating Modules**:
 - `sandbox/read-guard.js`: Refreshes the session read ledger with updated `mtime` and file size to prevent self-mutation lockouts.
 - `reminder/verify.js`: Evaluates whether linter or syntax verification should run.

### 6. `command.execute.before` (0-Token Transcript Pattern)
- **When It Runs**: When a registered slash command is invoked by the user.
- **Role**: Executes local deterministic logic and returns output directly to the transcript without invoking the LLM.
- **Pattern**:
 1. Executes local tasks (reading files, querying SQLite databases, formatting output).
 2. Calls `client.session.prompt` with `{ noReply: true, parts: [{ ignored: true, text }] }`.
 3. Throws `createHandledError()` to stop LLM prompt dispatch immediately.

### 7. `permission.ask` & `shell.env`
- **`permission.ask`**: Intercepts permission authorization checks, auto-rejecting destructive actions before UI dialogs appear.
- **`shell.env`**: Injects environment variables (`OMH_SANDBOX=1`, `OMH_SESSION_ID`, `NO_COLOR=1`) into subshells spawned by the `bash` tool.

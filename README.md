<div align="center">

# 🪝 oh-my-hook

**Production-grade guardrails, execution discipline, curated memory, and native TUI widgets for OpenCode agents.**

<br />

<a href="https://github.com/amadshobi/oh-my-hook/actions/workflows/ci.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/amadshobi/oh-my-hook/ci.yml?branch=main&style=for-the-badge&logo=github&label=CI&color=10B981&labelColor=1F2937&logoColor=white" alt="CI Status" />
</a>
<img src="https://img.shields.io/badge/Node-%E2%89%A5%2018.0.0-22C55E?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=1F2937" alt="Node Version" />
<img src="https://img.shields.io/badge/Dependencies-Zero-3B82F6?style=for-the-badge&logo=buffer&logoColor=white&labelColor=1F2937" alt="Zero Dependencies" />
<img src="https://img.shields.io/badge/License-MIT-00E5FF?style=for-the-badge&logo=open-source-initiative&logoColor=black&labelColor=1F2937" alt="License MIT" />
<img src="https://img.shields.io/badge/Ecosystem-OpenCode-A855F7?style=for-the-badge&logo=target&logoColor=white&labelColor=1F2937" alt="OpenCode Plugin" />

<br /><br />

_Stop AI agents from hallucinating file writes, leaking credentials, executing destructive bash, or losing memory after context compaction._

---

[📚 Documentation Portal](docs/index.md) •
[⚡ Key Pillars](#-key-pillars) •
[🥊 Why oh-my-hook?](#-why-oh-my-hook) •
[📐 Architecture Flow](#-architecture-flow) •
[🖥️ TUI Experience](#-opencode-tui-experience) •
[🗺️ Planning Suite](#-dual-mode-planning-suite) •
[👁️ Multimodal Vision](#-multimodal-vision-engine-imgsee) •
[📦 Installation](#-installation) •
[⚙️ Configuration](#-configuration-omhjsonc) •
[🔒 Guardrail Suite](#-guardrail-suite) •
[🧠 Curated Memory](#-curated-memory-engine) •
[🧪 Testing](#-testing--development)

</div>

---

## 📚 Complete Documentation Suite

Comprehensive architectural deep dives, developer manuals, and per-module configuration references are available in the **[`docs/`](docs/index.md)** directory:

- [**Introduction & Philosophy**](docs/intro.md) — The problem space of AI agents, core engineering pillars, and before/after comparisons.
- [**System Architecture & Internals**](docs/architecture/index.md) — Hook lifecycle flow, [Boundary Contracts](docs/architecture/boundary-contract.md), and [TUI Reactive Runtime](docs/architecture/tui-runtime.md).
- [**Showcase & Products**](docs/showcase/sandbox/index.md):
  - 🛡️ **[Sandbox Safety Suite](docs/showcase/sandbox/index.md)** — [Read/Stale Guard](docs/showcase/sandbox/read-stale-guard.md), [Secret Scanner](docs/showcase/sandbox/secret-scanner.md), [Dangerous Bash Guard](docs/showcase/sandbox/dangerous-bash.md), [Commit Guard](docs/showcase/sandbox/commit-guard.md).
  - 🗺️ **[Planning Suite](docs/showcase/plans/index.md)** — [Plan Mode Barrier](docs/showcase/plans/plan-mode.md), [Interactive Plan Reviewer](docs/showcase/plans/interactive-review.md), [Prompt Templates](docs/showcase/plans/templates.md).
  - 🧠 **[Curated Memory](docs/showcase/memory/index.md)** — [Agent Tool](docs/showcase/memory/agent-tool.md), [AI Distillation](docs/showcase/memory/distillation.md), [TUI Inspector](docs/showcase/memory/tui-inspector.md).
  - 🗜️ **[Context Compression](docs/showcase/compress/index.md)** — [Dynamic Pruning](docs/showcase/compress/dynamic-pruning.md), [Milestones Compaction](docs/showcase/compress/milestones.md).
  - 📊 **[Live Quota & Tokens](docs/showcase/usage/index.md)** — [Cloud Quota Tracker](docs/showcase/usage/cloud-quota.md), [Session Token Tree](docs/showcase/usage/session-tokens.md).
  - 👁️ **[Multimodal Vision](docs/showcase/imgsee/index.md)** — Out-of-band image analysis & OCR.
  - 🧭 **[System Prompt Router](docs/showcase/prompts/index.md)** — Dynamic model family prompt routing.
  - 🔌 **[Gateway Bridge](docs/showcase/gateway/index.md)** — Local daemon integration & Antigravity CCA armor.
- ⚙️ [**Configuration Reference**](docs/config/overview.md) — Multi-file precedence and per-module settings ([Sandbox](docs/config/sandbox.md), [Plans](docs/config/plans.md), [Memory](docs/config/memory.md), [Compress](docs/config/compress.md), [Usage](docs/config/usage.md), [Imgsee](docs/config/imgsee.md), [Prompts](docs/config/prompts.md), [Gateway](docs/config/gateway.md)).
- 🛠️ [**Developer Guides**](docs/guides/custom-hooks.md) — [Authoring Custom Hooks](docs/guides/custom-hooks.md) and [Headless Testing](docs/guides/headless-testing.md).
- 🚨 [**Troubleshooting & Runbook**](docs/troubleshooting.md) — Common error messages, resolution workflows, and state ledger reset procedures.

---

## ⚡ Key Pillars

- 🛡️ **Sandbox Enforcement (`sandbox/`)**: Strict pre-execution gates that reject destructive bash commands, unread file overrides, stale concurrent mutations, and credential leaks. Native `permission.ask` and `shell.env` integration.
- 🗺️ **Dual-Mode Planning Suite (`plans/`)**: In-chat brainstorming or durable RFC file creation (`~/.opencode/plans/`) with auto-versioning, plan mode write boundaries, 3-level prompt templates, and explicit intent detection (no conversational false-positive mode locking).
- 👁️ **Multimodal Vision Engine (`imgsee/`)**: Native visual inspection tool delegating one-shot image analysis (OCR, UI layout, diagrams, and debugging) to local vision gateways (`:4010` / `:4000`) without context poisoning or session errors.
- 🖥️ **Native TUI Integration**: Real-time ` [plan mode]` prompt badges and collapsible sidebar metrics rendered natively in OpenCode TUI via `@opentui/solid`.
- 🧠 **Curated Distilled Memory (`/capture`)**: Zero-noise memory engine. Only loads curated bullets into the primary agent, keeping subagent contexts clean and compaction snapshots lossless.
- 🔁 **Autonomous Verification Loop**: Runs typechecking, linter auto-fixes, and tests immediately after edits while automatically refreshing ledger state.
- 📦 **Zero Dependencies Core**: 100% pure Node.js ESM built-ins (`node:fs`, `node:path`, `node:child_process`). Lightweight, instant startup, zero supply-chain risk.
- 📊 **Live Quota & Token Monitor (`usage/`)**: Deterministic `/usage` slash command (0-token LLM) showing multi-provider quota — Google Antigravity, Ollama Cloud (multi-key aggregate), OpenRouter balance — straight from `agent.db`, plus session/subagent token breakdown from `opencode.db`.

---

## 🥊 Why oh-my-hook?

| Risk / Scenario | Raw OpenCode Agent | With `oh-my-hook` |
| :----------------------------- | :--------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| **Overwriting Unread Files** | Model guesses structure and rewrites entire files blindly. | 🛡️ **Blocked**: `readBeforeWrite` forces `read` before `edit`/`write`. |
| **Concurrent File Mutation** | Overwrites changes made by user or external scripts. | 🛡️ **Blocked**: `staleWrite` checks `mtime` & byte size before mutation. |
| **Accidental Secret Leaks** | API keys, JWTs, and AWS tokens written to public code. | 🛡️ **Blocked**: `secretScanner` scans payloads with regex AST patterns. |
| **Plan Phase Runaway** | Agent starts editing codebase while asked to brainstorm. | 🛡️ **Blocked**: `planMode` disables mutating tools until `/approve`. |
| **Destructive Terminal Ops** | Commands like `rm -rf /`, `curl \| sh`, or detached dev servers. | 🛡️ **Blocked**: `dangerousBash` & `devServerGuard` stop dangerous ops. |
| **Context Loss on Compaction** | Agent forgets git state, active tasks, and project rules. | 🗜️ **Injected**: `compactionSnapshot` injects git state + todos into summary. |
| **Session Memory Drift** | Auto-memory logs conversational spam and hallucinates. | 🧠 **Curated**: Markdown storage + AI session distillation via `/capture`. |

---

## 📐 Architecture Flow

```
 ┌────────────────────────────────────────────────────────┐
 │ User Prompt / Slash Command │
 └───────────────────────────┬────────────────────────────┘
 │
 [Intent & Command Router]
 (/plan, /design, /approve, /mode)
 │
 ┌────────────────────────────┼────────────────────────────┐
 │ │ │
 [system.transform] [tool.execute.before] [OpenCode TUI]
 │ │ │
 • Inject Curated Memory • Read-Before-Write Guard • [plan mode] Prompt Badge
 • Session Compaction Snapshot • Stale-Write Checker • ▼ oh-my-hook Sidebar Widget
 • Agent Boundary Isolation • Secret AST Scanner • Reactive State Watcher
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

 ┌──► ▼ oh-my-hook ● PLAN
 │ • Mode : plan (read-only)
 │ • Shields: 7 active
 │ • Memory: 3 notes
 │
 ▼ MCP
 • github Connected
 ▣ Assistant · Gemini 3.7 Flash · 9.3s
┃
┃
┃
┃ Assistant · Gemini 3.7 Flash gateway PLAN (feature-auth) /~ ◄── [PROMPT BADGE]
╹▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
```

1. **`session_prompt_right` Slot**: Renders a dynamic warning badge `PLAN` (alongside plan name) when the active session is in plan mode. Hides automatically during execute mode to keep your input bar clean.
2. **`sidebar_content` Slot**: A compact collapsible widget showing active mode status (`● ACTIVE` / `● PLAN` / `● EXEC`), active shields count, and curated memory notes.
3. **Resilient Reactive Watcher**: Debounced (50ms) directory watcher tracks session state without IPC or polling overhead.

---

## 🗺️ Dual-Mode Planning Suite

Seamlessly switch between quick conversational brainstorming, durable RFC file generation, and interactive terminal review:

| Command | Mode | Behavior |
| :--------------------------------- | :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/plan [topic]`** | **In-Chat (Ephemeral)** | Locks file mutations, loads `plan.md`, and brainstorms directly in the chat transcript with zero disk footprint. |
| **`/plan to-file <name> [notes]`** | **File-Based (Durable)** | Targets `~/.opencode/plans/<name>.md`. Auto-archives previous drafts to `plans/versions/<name>-v<N>.md` and whitelists **only** the plan file for writes. |
| **`/plan review [name]`** | **Interactive TUI Modal** | Opens the terminal-native line-by-line review modal to dispute or annotate specific lines with keyboard shortcuts. |
| **`/plan list`** | **Listing** | Lists all stored plan and design documents in `~/.opencode/plans/`. |
| **`/plan switch <name>`** | **Context Switch** | Switches active roadmap context to another existing plan file. |
| **`/design [topic]`** | **In-Chat (UI/UX)** | Dedicated UI/UX design workflow loaded from `design.md`. |
| **`/design to-file <name>`** | **File-Based (UI/UX)** | Generates structured UI/UX component specs in `~/.opencode/plans/designs/<name>.md`. |
| **`/approve`** _(alias: `/exec`)_ | **Execution Transition** | Injects `approve.md` with active plan file reference, unlocks all project mutations, and readies the agent to build. |
| **`/mode`** | **Status Check** | Inspect active mode and active plan file in the current session. |

### ‍️ Goblin Plan Protocol & Interactive Review

- **Autonomous Agent Gate**: When assigned a complex, multi-file task (≥3 files), the agent prompts for user permission (`[Yes, blin] | [Nope, proceed directly!]`) before entering Plan Mode.
- **Explicit Intent Detection**: Plan Mode activates only via explicit triggers — slash commands (`/plan`, `/design`, `/mode plan`) or unambiguous verbal instructions (`enter plan mode`, `masuk mode plan`, `switch to plan mode`). Conversational phrases like "bahas dulu" or "mikir dulu" no longer accidentally lock the session. Disable text detection entirely with `plans.autoDetectIntent: false` for 100% slash-command-driven switching.
- **Line-Level Reviewer**: Keyboard-navigable (`[↓]/[↑]`, `[Enter]` to correct, `[Ctrl+A]` to approve) modal directly in the OpenCode TUI interface.

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
 // Curated Memory & Session Distillation
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

 // Sandbox Pre-Execution Safety & Integrity
 "sandbox": {
 "readBeforeWrite": true, // Enforce READ -> UNDERSTAND -> EDIT loop
 "staleWrite": true, // Prevent race conditions on changed files
 "secretScanner": true, // Block hardcoded API keys, JWTs, private keys
 "commitGuard": true, // Enforce Conventional Commits format
 "devServerGuard": true, // Prevent orphan background servers outside tmux
 "dangerousBash": true, // Block rm -rf, fork bombs, disk overwrites
 },

 // ️ Plans & Archiving Configuration
 "plans": {
 "enabled": true,
 "planMode": true, // Freeze file mutation during planning phase
 "autoDetectIntent": true, // Auto-detect explicit plan/execute intent from text; false = slash commands only
 "directory": "~/.opencode/plans",
 "versionLimit": 20,
 },

 // ️ Context Compression & Dynamic Pruning Engine
 "compress": {
 "enabled": true,
 "pruning": {
 "enabled": true,
 "recentTurns": 2, // Keep last 2 conversational turns 100% intact
 "minOutputChars": 2000, // Threshold before ANY eligible tool output is pruned
 "keepImportantLines": true, // Preserve error/pass/summary lines from the middle
 "toast": {
 "enabled": true, // Live TUI toast on pruning events
 "cooldownMs": 30000 // Anti-spam cooldown
 },
 "commandPatterns": {
 "alwaysPrune": ["npm install", "git commit"], // Force-prune noisy commands
 "neverPrune": ["git diff", "cat .*"] // Protect critical outputs
 }
 },
 "milestones": {
 "pushAutoCompress": true, // Auto-compact & snapshot when git push finishes and agent goes idle
 },
 },

 // Post-Execution Verification
 "reminder": {
 "verify": true, // Run auto-typecheck & linter after edits
 "checklist": true, // Nudge agents to split complex steps into todos
 },

 // Dynamic System Prompt Router
 "prompts": {
 "enabled": true,
 "customDirectory": "~/.config/opencode/prompts", // User custom prompt overrides (exact, family, or default.md)
 "directory": "~/.opencode/assets/provider", // Fallback provider prompt asset catalog
 "routes": {
 // "kilo/tencent/hy3:free": "hy3.md",
 // "ollama-cloud/*": "minimax.md"
 },
 },

 // ️ Multimodal Vision Engine
 "imgsee": {
 "enabled": true,
 "gatewayUrl": "http://127.0.0.1:4010/v1/chat/completions",
 "model": "google-antigravity/gemini-2.5-flash",
 "timeoutMs": 60000,
 "maxBytes": 5242880, // 5 MiB
 },
}
```

---

## 🔒 Sandbox Suite

### 1. Read-Before-Write & Stale-Write Protection

Forces the agent to read and understand the file in the current session before applying any modifications. If another process modifies the file on disk after the agent read it, the write is immediately rejected. Auto-syncs read ledger on successful self-mutations to prevent self-stale lockouts.

```
#### GUARDRAIL BLOCK: Read-Before-Write
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

## 🧠 Curated Memory & Agent Tool

`oh-my-hook` features a **pure Markdown-backed, self-curating memory engine** (Hermes-style architecture) with zero JSONL bloat and direct file storage:

```
~/.config/opencode/memory/
├── MEMORY.md # Global cross-project memory (auto-selected in ~)
└── projects/
 └── <project-slug>/
 └── MEMORY.md # Project-specific curated rules (auto-selected in workspace)
```

### Key Highlights:

- **100% Pure Markdown**: Human-readable, zero-overhead storage. Directly editable via any text editor without worrying about JSONL drift.
- **Autonomous Agent Tool (`memory`)**: Exposes a native OpenCode tool with 4 actions:
 - `add`: Saves a new memory bullet (guarded against credential leaks).
 - `replace`: Updates existing memory via **substring matching** (`old_text`).
 - `remove`: Deletes memory via substring matching.
 - `list`: Inspects active memory bullets.
- **Direct System Prompt Injection**: Automatically injects combined Global + Project Markdown directly into `experimental.chat.system.transform` and compaction context without loss.
- **️ Native TUI Modal Inspector**: Full keyboard-driven inspector using OpenCode's native `api.ui.DialogSelect` & `api.ui.DialogPrompt`:
 - `Enter` $\rightarrow$ Edit / Replace text
 - `Ctrl+A` $\rightarrow$ Add new memory
 - `Ctrl+D` (2x) $\rightarrow$ Delete memory with red row confirmation
 - `↓/↑ / j/k` $\rightarrow$ Scroll & fuzzy search

### Interactive Slash Commands:

- `/memory`: Display all active memory bullets in terminal.
- `/memory global`: View global memory.
- `/memory project`: View current project memory.
- `/memory add <note>`: Append a note to project memory (`--global` for global).
- `/memory replace A -> B`: Replace note matching `A` with `B`.
- `/memory remove <text>`: Remove note matching `text`.
- `/memory capture`: Run ephemeral AI distillation worker to summarize session lessons.

---

## 🧭 Dynamic System Prompt Router

When using multi-provider models or local gateway proxies (like **Oh-My-Pi / OMP**), models outside OpenCode's hardcoded tier-1 list fall back to `PROMPT_DEFAULT`, leading to tool chatter and formatting mismatches.

`prompts/` hooks into `experimental.chat.system.transform` to dynamically resolve and inject appropriate system prompts:

- **Resolution Hierarchy**:
 1. Explicit user routes in `omh.jsonc` (`prompts.routes`).
 2. User custom files in `~/.config/opencode/prompts/` by **Exact Model ID** (`deepseek-v3.md`), **Family Name** (`deepseek.md`, `minimax.md`, `qwen.md`, `kimi.md`, `mistral.md`, `glm.md`), or **Provider Name** (`omp.md`).
 3. User custom fallback: `default.md` / `default.txt` in `~/.config/opencode/prompts/`.
 4. Built-in provider asset catalog fallback (`~/.opencode/assets/provider/`).
- **Atomic System Transformation**: Replaces the generic base prompt with tailored guidelines while preserving 100% of session metadata (`<env>`, working directory, project `AGENTS.md`, MCP tools, and memory context).

---

## 🗜️ Context Compression & Dynamic Pruning Suite

Long coding sessions inevitably fill the LLM context window with bloated historical logs (`npm test`, `git commit`, `curl`, `gh`, `node`). `compress/` intelligently optimizes context usage:

- **Generic Size-Based Dynamic Pruning (`experimental.chat.messages.transform`)**:
 - Automatically collapses **ANY eligible tool output** above `minOutputChars` (default 2000) into clean, deterministic markers (`── OMH-PRUNE ── X chars collapsed ──`) — no command whitelist needed.
 - **Selective Command Protection**: `commandPatterns.neverPrune` keeps critical outputs (`git diff`, `cat config`) fully intact; `commandPatterns.alwaysPrune` force-prunes noisy commands (`npm install`, `git commit`).
 - **Important Line Preservation**: Error/pass/summary lines from the middle of output are kept (`── IMPORTANT ──` block), so context survives collapse.
 - **Zero Database Modification**: Pruning operates in-memory per request turn, preserving full transcript integrity for OpenCode's undo/revert functionality.
 - **Failure Signal Protection**: Test failures and stack traces (`FAILED`, `panic:`, `Traceback`, `npm ERR!`) are **never pruned** so debugging context is never lost.
 - **Protected Window & Tools**: Last 2 conversational turns and critical tools (`read`, `write`, `edit`, `todowrite`, `grep`, `glob`) are strictly protected.
 - **Live TUI Toast**: When pruning fires, a toast notification appears in the TUI (`pruned <target>: ~X tok`) — anti-spam cooldown included.
- **Post-Push Idle Auto-Compaction**:
 - Automatically captures git diffs and branch milestones when a successful `git push` is detected and triggers background compaction when the agent enters an idle state.
- **Interactive Slash Commands**:
 - `/compress`: Trigger immediate session compaction with zero token overhead.
 - `/compress stats`: View live token savings, tool breakdown, and pruning metrics.

---

## 🔌 Local Gateway Bridge (`gateway/`)

`gateway/` acts as the native OpenCode bridge to your local AI daemon (`gn gw` on `:4010` or `:4000`), eliminating manual JSON configuration and protecting against Google CCA schema rejections.

### Key Capabilities:

- **Zero-Config Interactive Auth**: Connects seamlessly with `opencode auth -p local-gateway` (or TUI login).
- **Dynamic Model Auto-Discovery**: Fetches all available upstream models from `:4010/v1/models` at runtime with offline snapshot caching.
- **OMP Catalog Metadata Enrichment**: Enriches models with exact token pricing (`cost`), context window limits, and thinking tiers (`variants`) directly from Oh-My-Pi catalog (`models.json`).
- **Antigravity CCA Armor**: Intercepts and normalizes tool definitions in-flight, stripping OpenAPI keywords (`$schema`, `title`, `additionalProperties`) to prevent HTTP 400 Malformed Argument errors from Google Cloud Code Assist.

```jsonc
// omh.jsonc
"gateway": {
 "enabled": true
}
```

---

## 👁️ Multimodal Vision Engine (`imgsee/`)

When coding agents need to inspect UI layouts, error screenshots, diagrams, or web pages, `imgsee/` provides out-of-band visual inspection by delegating directly to a vision-capable model (like `gemini-2.5-flash` or `gemini-3.7-flash` via local OMP gateway on `:4010` / `:4000`).

### Key Capabilities:

- **Zero Context-Poisoning**: Keeps primary text-only LLMs stable by executing one-shot vision analysis and returning clean, structured Markdown back to the session.
- **Magic Bytes Sniffing**: Header sniffing support for PNG, JPEG, GIF, and WEBP with a 20 MiB safety cap.
- **Diagnostic System Directives**: Evidence-first analysis, verbatim OCR extraction, spatial UI coordinates, and actionable root cause debugging.
- **Dual Invocation**:
 - **Autonomous Tool (`imgsee`)**: Agents invoke `imgsee(path, question, mode)` when examining screenshots or visual artifacts.
 - **Deterministic Slash Command (`/imgsee`)**: Users can trigger `/imgsee <path> [question]` directly in chat with zero LLM overhead.

---

## 📊 Live Quota & Token Monitor (`usage/`)

Deterministic `/usage` slash command (0-token LLM — output is `ignored` transcript, never read by the model):

```text
/usage → all providers
/usage quota → all providers (alias)
/usage ollama → Ollama Cloud only
/usage agy → Google Antigravity only
/usage openrouter → OpenRouter only
/usage tokens → session token breakdown
/usage help → list subcommands
```

- **Cloud Quota**: reads credentials read-only from `~/.omp/agent/agent.db` and fetches live limits (Antigravity weekly/5-hour, Ollama Cloud weekly with multi-key aggregation, OpenRouter balance).
- **Ollama multi-key**: all keys fetched in parallel; weekly = `max(usage)`, requests summed. Labels from config `usage.quota.ollama.accounts` (key-prefix → name), fallback `key#<id>`.
- **Session Tokens**: main + subagent token consumption from `~/.local/share/opencode/opencode.db` (input/output/reasoning/cache/cost).
- **Zero-dependency**: dual-runtime SQLite adapter (`bun:sqlite` on Bun, `node:sqlite` on Node) — read-only, never touches live data.

### TUI Sidebar Surfaces

- **`Tokens` tree** (`sidebar_content`): collapsible accordion showing main agent + subagent token usage (input/output/reasoning/cache/cost), refreshed per session.
- **`Last Turn` node** (inside `Tokens` tree): last completed assistant turn breakdown (input, cache, output, reasoning, duration, cost) — expanded by default for quick glance.

---

## 🧪 Testing & Development

`oh-my-hook` includes **142 unit tests** and **5 deterministic E2E hook pipeline test suites**.

```bash
# Run unit tests
npm test

# Run modular E2E hook pipelines
npm run test:e2e:hooks

# Run all test suites
npm run test:all
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
 <sub>Built with precision for the OpenCode Agent Ecosystem.</sub>
</div>

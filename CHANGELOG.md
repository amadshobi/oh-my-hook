# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **🛡️ Prompt Router No Longer Overwrites Custom Agent Personas (#12)**:
  - `prompts/` router previously replaced the base prompt segment unconditionally, destroying user-authored agent personas defined in OpenCode config (`agent.<name>.prompt`).
  - Added built-in base prompt fingerprint detection (`hasCustomPersona`) — the router now only swaps OpenCode's generic provider prompts (`default`, `anthropic`, `beast`, `gpt`, `gemini`, `kimi`, `meta`) and leaves custom personas untouched.
  - New opt-in flag `prompts.overridePersona` in `omh.jsonc` restores the old overwrite-everything behavior when explicitly desired.

## [0.4.3] - 2026-08-23

### Added

- **🗜️ Context Compression & Dynamic Pruning Suite (`compress/`)**:
  - Re-architected `context/` into a dedicated `compress/` suite with backward-compatible deprecation shims.
  - **Dynamic Tool Output Pruning (`experimental.chat.messages.transform`)**: Intelligently collapses bulky historical test/build/git outputs into clean, deterministic markers while preserving recent 2-turn window and failure outputs (`FAILED`, `panic:`, `Traceback`, `npm ERR!`).
  - **Milestone & Post-Push Idle Auto-Compaction (`automation.js`)**: Automatically detects successful `git push` executions in bash, takes branch/diff snapshots, and triggers background compaction when the agent enters an idle state with strict safety gates (min 30 messages, 2-turn delay, 10-minute cooldown, max 2 auto-compactions per session).
  - **Deterministic Slash Commands (`commands.js`)**: Added `/compress` (immediate compaction) and `/compress stats` (metrics inspection) delivered to session transcripts with 0 LLM token cost.
  - **Persistent Stats Ledger (`stats.js`)**: Tracks pruned outputs, bytes saved, and estimated token savings per session and global aggregates bounded to 50 sessions.
  - **TUI Observability Integration (`tui/`)**: Added live pruning and token savings counters to OpenCode TUI sidebar widget and metrics helpers.
  - **E2E Hook Pipeline Expansion**: Added deterministic `compress.hook.e2e.js` test pipeline (**112 passing unit tests** and **5 E2E pipelines**).

- **🔌 OMP Gateway Bridge (`omp/`)**:
  - **Dynamic Auto-Discovery**: Fetches live models from local OMP Gateway (`:4000`) and registers them into OpenCode's `config.provider` at startup — zero hardcoding.
  - **`models.yml` Aggregator**: Parses `~/.omp/agent/models.yml` and bridges custom providers (Kilo, OpenCode Zen, OpenRouter, Charm Hyper) with automatic API key resolution from env vars.
  - **Model Intelligence**: Built-in classification for reasoning models (`deepseek-v4`, `o3`, `gpt-5`, `claude-sonnet-4`, etc.) and non-chat models (embedding, TTS, image-gen) with context window estimation.
  - **OMP Extension (`extension.ts`)**: Generic TypeScript loader for OMP runtime — any provider added to `models.yml` becomes instantly available via `pi.registerProvider()`.
  - **Unified Gateway Proxy (`gateway-proxy.ts`)**: Standalone Bun proxy on `:4000` that aggregates `models.yml` curated providers + internal OMP Auth-Gateway (`:4002`) into a single OpenAI-compatible endpoint.

## [0.4.2] - 2026-08-23

### Added

- **🧭 Dynamic System Prompt Router (`prompts/`)**:
  - Implemented `experimental.chat.system.transform` hook to dynamically route custom and gateway models (such as Oh-My-Pi / OMP proxies) to appropriate system prompt templates instead of falling back to generic `PROMPT_DEFAULT`.
  - **Cascading Resolution Engine**:
    1. Explicit custom routes defined in `omh.jsonc` (`prompts.routes`).
    2. Exact Model ID match (`~/.config/opencode/prompts/<model-id>.md` or `.txt`).
    3. Model Family keyword match (`deepseek.md`, `minimax.md`, `qwen.md`, `kimi.md`, `mistral.md`, `glm.md`, `gemini.md`, `claude.md`, `gpt.md`, `grok.md`, `hy3.md`).
    4. Provider Name match (`omp.md`, `kilo.md`, `ollama-cloud.md`).
    5. User Custom Default fallback: `default.md` / `default.txt` in `~/.config/opencode/prompts/`.
    6. Built-in provider asset catalog fallback (`~/.opencode/assets/provider/`).
  - **Atomic System Transformation**: Replaces the generic base prompt with tailored guidelines while preserving 100% of session metadata (`<env>`, working directory, project `AGENTS.md`, MCP tools, and memory context).
  - In-memory template caching for zero I/O latency on subsequent conversational turns.
- **🧪 Test Suite Expansion**:
  - Added unit test suite covering resolution hierarchy, wildcard routes, family keywords, and custom default fallbacks (**96 passing unit tests**).

## [0.4.1] - 2026-08-22

### Added

- **🧠 Pure Markdown Memory Engine & Native Agent Tool (`memory/`)**:
  - Re-architected memory storage to 100% human-readable Markdown stores (`~/.config/opencode/memory/MEMORY.md` for Global and `projects/<slug>/MEMORY.md` for Project rules).
  - Pushed over 1,000 lines of complex boilerplates (JSONL schemas, BM25 indexing, queue workers) out of the critical path.
  - **Native OpenCode Agent Tool (`memory`)**: Exposes an autonomous 4-action tool (`add`, `replace`, `remove`, `list`) with Hermes-style substring matching (`old_text`) and secret scanner protection.
  - **Unified `/memory` Slash Command**: Single deterministic command entrypoint with `noReply: true` + `createHandledError()` output delivery (0 token LLM).
- **🖥️ Native OpenCode TUI Dialog Integration (`tui/`)**:
  - Replaced custom scrollboxes with native OpenCode `api.ui.DialogSelect` and `api.ui.DialogPrompt` components for instant keyboard navigation (`↓/↑`, `j/k`, `Enter`, `Esc`, `PageUp/Down`) and live fuzzy search (`fuzzysort`).
  - **3 Dedicated Scoped Modals**:
    - `Memory: All` (Read & Replace/Edit on `Enter`).
    - `Memory: Global` (Add via `Ctrl+A`, Delete via `Ctrl+D` 2x, Edit on `Enter`).
    - `Memory: Project` (Add via `Ctrl+A`, Delete via `Ctrl+D` 2x, Edit on `Enter`).
  - **Double-Trigger Delete Confirmation**: 1st press of `Ctrl+D` highlights row with red warning background (`theme.error`); 2nd press executes deletion. Moving cursor resets confirmation.
  - **Native Clean Footer**: Typography-driven action bar (`edit enter   new ctrl+a   delete ctrl+d`) matching `/session` and `/models` styling without bracket clutter.
  - **Streamlined Sidebar**: Focused 3-item monitor (`Mode`, `Shields`, `Memory`) with red color coding for disabled states.
- **📚 Architectural Standard in `AGENTS.md`**:
  - Added dedicated `## TUI & Slash Command Architecture` documenting dual execution models (Visual Modal vs Deterministic Transcript) and the autocomplete anti-collision rule.

## [0.4.0] - 2026-08-22

### Added

- **📐 Terminal-Native Interactive Plan Line Reviewer (`plans/parser.js` & `tui/src/index.tsx`)**:
  - Line-level markdown parser supporting arbitrary document structures (headings, checklists, codeblocks, tables, blockquotes).
  - Contextual annotation modal in OpenCode TUI (`/plan review` / `oh-my-hook.plan.review`):
    - `[↓]/[↑]` arrow navigation across document lines (unfocused by default).
    - `[Enter]` opens inline correction box to dispute or rectify specific lines.
    - `[Ctrl+A]` submits line-level feedback and auto-approves.
    - Dynamic navigation hint footer adapting to current view state.
- **🧙‍♂️ Goblin Plan Protocol (Anti-OVT Agent Gate)**:
  - System prompt guidance enforcing that the agent MUST ask user confirmation via the `question` tool before entering Plan Mode on complex/multi-file tasks (`[Yes, blin] | [Nope, proceed directly!]`).
- **New Planning Subcommands**:
  - `/plan list`: Browse all stored plan and design documents in `~/.opencode/plans/`.
  - `/plan switch <name>`: Switch active plan context.
  - `/plan review [name]`: Open interactive review preview or modal.
- **Dynamic Active Plan System Transform**:
  - Automatically injects approved roadmap content into `experimental.chat.system.transform` during Execute Mode.
- **Config & Slash Command Auto-Unregister**:
  - Dynamically skips registering slash commands in `cfg.command` and TUI palette layers when `"memory": { "enabled": false }` or `"plans": { "enabled": false }`.
  - Deep-propagated configuration from root `loadConfig()` down to all hook factories.

### Changed

- **Standardized Concise English Messages**:
  - Re-architected `share/block.js` and `share/messages.js` into clean, concise English blockquotes (`#### 🚫 Title\n> *Reason*\n> *Hint*`).
  - Updated template prompts (`plan.md`, `design.md`, `approve.md`) into structured RFC templates.
- **Strict Regex Intent Detection**:
  - Replaced naive substring matching with explicit regex phrase matchers (`PLAN_INTENT_PATTERNS` & `EXECUTE_INTENT_PATTERNS`) to eliminate false-positive plan mode triggers.
- Increased test suite to **93 passing unit tests** and deterministic E2E verification.

## [0.3.0] - 2026-08-21

### Added

- **🔒 Dedicated Sandbox Module (`sandbox/`)**:
  - Re-architected pre-execution security and runtime gate into a cohesive `sandbox/` module.
  - **Native OpenCode Hook Integration**:
    - `"permission.ask"`: Auto-denies risky operations at the core permission gate before annoying modal popups appear.
    - `"shell.env"`: Injects runtime isolation environment variables (`OMH_SANDBOX=1`, `OMH_SESSION_ID`, `NO_COLOR=1`) into all subshells.
  - **Advanced Secret AST Scanner**: Extended coverage to PKCS#8 private keys (`-----BEGIN PRIVATE KEY-----`), AWS STS Session Keys (`ASIA...`), and modern DB URI schemes (`postgresql://`).
  - **Dangerous Bash Hardening**: Added patterns for `rm -fr /*`, `wget ... | bash`, and block storage rewrites (`/dev/nvme*`, `/dev/vd*`).
  - **Chained Git Push Protection**: Detects and blocks force-pushing to main/master even in chained commands (`git add . && git push origin main --force`).
  - **Anti Self-Stale Lockout**: Auto-refreshes session read ledger immediately upon successful `write`/`edit`/`patch` tool execution and post-edit linter autofixes.
- **📁 XDG Base Directory Specification Separation**:
  - Relocated runtime state and read ledgers (`oh-my-hook-read-ledger.json` & `oh-my-hook-mode.json`) to `~/.local/share/opencode/` (`XDG_DATA_HOME`), keeping `~/.config/opencode/` clean for configuration only.

### Changed

- **Planning Lifecycle Consolidation (`plans/`)**:
  - Moved mode barrier enforcement and plan file whitelisting entirely into `plans/index.js`.
- **Runtime Spec Alignment**:
  - Normalized `toolArgs(input, output)` to prioritize OpenCode's `output.args` over `input.args`.
  - Added robust `extractUserText(input, output)` helper for cross-version prompt turn extraction.
- **Configuration**:
  - Updated `omh.jsonc` schema and `share/config.js` to structure settings under `"sandbox"` and `"plans"`.
- Removed legacy and redundant `guard/` module.

## [0.2.1] - 2026-08-18

### Added

- **🧠 Self-Learning & Dynamic Relevance Memory Upgrade (Reflexio Architecture)**:
  - **Auto-Detection & Distill**: Heuristic regex classifier (`memory/detect.js`) for user corrections and prohibitions with async throttled queue (`queue.jsonl`).
  - **Dynamic BM25 Relevance Matcher**: Pure JS Okapi BM25 token scoring engine (`memory/matcher.js`) with zero external dependencies and bilingual stopwords (ID/EN) for prompt token safety.
  - **Categorized Structured Store**: Automatic storage in `~/.config/opencode/memory/rules/` for preferences, project skills (SOPs), and shared skills.
  - **Smart Session Injection**: Dynamic context injection (`memory/inject.js`) into `experimental.chat.system.transform` matching only relevant rules per prompt turn.
  - **Jaccard Dedup & Contradiction Superseding**: Background distiller (`memory/distill.js`) merges similar rules and retires obsolete contradicted rules.
- **🖥️ Native TUI Memory Inspector Modal (`tui/`)**:
  - Direct `/memory` slash command dialog popup via `api.keymap.registerLayer` and `api.ui.dialog.replace`.
  - Tabbed interactive browser (`[Semua]`, `[Preferences]`, `[Project Skills]`) with native scrollbox and `Esc` close handler.
  - Live structured memory counters in the collapsible sidebar widget.
- **New Memory Slash Commands**:
  - `/memory-forget <id>`: Soft-delete / retract obsolete memory rules.
  - `/memory-scan`: Force process pending background distill queue jobs.

### Changed

- Updated storage architecture to clean Markdown-centric layout in `~/.config/opencode/memory/` with automatic CWD detection (Home `~` ➔ Global `MEMORY.md`, Project ➔ `projects/<slug>/MEMORY.md`).
- Increased test coverage to **89 passing unit tests** and full E2E hook pipeline verification.

## [0.2.0] - 2026-08-16

### Added

- **OpenCode TUI Frontend Module (`tui/`)**:
  - `session_prompt_right` slot: Dynamic reactive badge `🔒 [plan mode]` rendered in warning orange when the active session is in plan mode. Automatically hides during execute mode.
  - `sidebar_content` slot: Compact, collapsible `▼ oh-my-hook` widget displaying active session mode, active guardrails count, and curated memory notes count.
  - Reactive state synchronization using debounced (50ms) directory-level `fs.watch` resilient against Linux atomic write/rename operations.
  - Precompiled universal SolidJS bundle (`tui/dist/tui.js`) using `@opentui/solid` canvas primitives.
- **Dual-Mode Planning & Slash Command Suite (`plans/`)**:
  - `/plan [topic]`: Ephemeral in-chat architecture and planning mode.
  - `/plan to-file <feature-name> [notes]`: Durable file-based planning targeting `~/.opencode/plans/<feature-name>.md`.
  - `/design [topic]` & `/design to-file <name>`: Dedicated UI/UX design workflow targeting `~/.opencode/plans/designs/<name>.md`.
  - `/approve` (alias: `/exec`): Unblocks all project mutations and smoothly transitions session back to execute mode.
  - `/mode`: Inspect current session mode and active plan document reference.
  - **Auto-Versioning & Archiving**: Existing plan files are automatically backed up to `plans/versions/<name>-v<N>.md` upon new plan creation.
  - **Plan Whitelist Guardrail**: Whitelists writes and edits targeting `plans/` while strictly locking all other project codebase files.
  - **3-Level Template Resolution**: Loads prompt templates with precedence: Project (`.opencode/prompts/`) ➔ Global (`~/.config/opencode/prompts/`) ➔ Built-in fallback (`plans/prompts/`).
  - Dynamic template macros: `{plan_file}`, `{plan_name}`, `{topic}`, `{session_id}`, `{target_dir}`.
- **Granular Per-Tool Policy Guardrails (`guard/tool-policy.js`)**:
  - Direct string policies: `"allow"`, `"deny"`, and `"readonly"` (blocks mutating tools like `write`/`edit`/`delete`).
  - Specificity-sorted wildcard pattern matching (e.g. `mcp:slack:read_*` beats general `mcp:slack:*` regardless of key order in JSON).
  - Object rules with `denyPatterns` regex matching for bash commands.
- **Modularized E2E Test Suite (`tests/e2e/`)**:
  - Isolated test runners: `tool-policy.hook.e2e.js`, `mode-intent.hook.e2e.js`, `security.hook.e2e.js`, `stale-write.hook.e2e.js`, `plans-commands.hook.e2e.js`.
  - Increased unit test coverage to 74 passing tests.

### Changed

- Simplified plan mode guardrail block message to concise, direct warning:
  `GUARDRAIL BLOCK: Plan Mode - On plan mode, don't write or edit files without a specific trigger.`
- Config manifest updated with `"oc-plugin": ["server", "tui"]` and exports for `./server` and `./tui`.

## [0.1.0] - 2026-08-14

### Added

- Core plugin composition engine (`index.js`, `share/merge.js`).
- Guard module (`guard/`):
  - Plan vs Execute mode intent enforcement (`mode.js`).
  - Read-before-write and stale-write ledger detection (`read-guard.js`).
  - Secret scanner for sensitive tokens, private keys, and DB URIs (`security.js`).
  - Conventional commit validator and destructive command blocking (`security.js`).
- Context module (`context/`):
  - Session lifecycle tracking and snapshot injection for compaction (`context.js`).
  - Agent and subagent context boundaries (`agent-context.js`).
- Reminder module (`reminder/`):
  - Post-edit typecheck, linting with auto-fix, and test runner (`verify.js`).
  - Multi-step task checklist guidance (`checklist.js`).
- Curated Memory module (`memory/`):
  - Global & per-project markdown storage (`store.js`).
  - Pluggable AI distillation adapters: `commandcode`, `opencode`, `omp` (`ai/`).
  - Slash commands: `/remember`, `/memory`, and `/capture` (`index.js`).
- Zero-dependency architecture with fast unit and deterministic E2E test suites.

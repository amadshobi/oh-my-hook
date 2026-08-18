# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

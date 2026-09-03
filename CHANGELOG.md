# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-09-03

### Added

- **Hermes-Style Multi-Target Memory & Direct Gateway Engine (Issue #16)**:
  - **3-Target Architecture**: Segregated storage into `USER.md` (user persona, communication habits, developer identity), `MEMORY.md` (global technical notes, CLI quirks, cross-repo tools), and `projects/<slug>/MEMORY.md` (repository architecture rules, test commands).
  - **Hermes Atomic Batch Operations (`operations: [...]`)**: Native `memory` tool now supports atomic batch updates across all 3 targets with pre-validation rollback (zero dirty writes on validation failure).
  - **Tool Definition Schema Override**: Implemented `tool.definition` hook to enforce clean JSON Schema (`required: []`), eliminating parameter enforcement bugs in OpenCode's legacy schema generator and enabling seamless tool invocation across strict models (Gemini, DeepSeek, Qwen, Llama).
  - **Bounded Character Limits & Visual Headers**: Hermes-style visual header rendering with usage percentage and character count indicators (`[23% — 340/1,500 chars]`) in `experimental.chat.system.transform`. Actionable rejection when target capacity is exceeded.
  - **Direct OpenAI-Compatible Gateway Client (`memory/client.js`)**: Replaced fragmented CLI capture adapters (`memory/ai/`) with a high-performance native `fetch()` client connecting directly to local gateways (OMP `:4000`, Local Gateway `:4010`) or remote OpenAI-compatible endpoints.
  - **Hermes Background Self-Improvement Review**: Post-turn silent reflection loop evaluating recent conversations in the background and surfacing `💾 Self-improvement review: Memory updated`.
  - **Unified Slash Commands**: Expanded `/memory` to support `/memory user`, `/memory global`, `/memory project`, `/memory add [target] <note>`, `/memory replace`, `/memory remove`, and `/memory capture` with zero-token transcript delivery.
  - **Deterministic E2E Test Pipeline**: Added `tests/e2e/memory.hook.e2e.js` covering the full memory lifecycle.

### Fixed

- **Plan Mode Assistant Self-Trigger Loop**: Filtered assistant message parts from `message.part.updated` event listener in `plans/index.js` to prevent the agent from triggering mode changes from its own generated tokens.

## [0.6.0] - 2026-09-01

### Added

- **Generic Size-Based Pruning & Live TUI Toast (Issue #26)**:
  - **Generic Pruning**: Any eligible tool output (`bash`, etc.) above `minOutputChars` (default lowered 8000 → 2000) is now collapsed — the rigid command whitelist (`npm test`/`go build`/`git log`) is gone. Outputs from `curl`, `gh`, `node`, `python`, and mid-size diffs are now pruned too.
  - **Selective Command Protection (`commandPatterns`)**: Dual-mode `alwaysPrune` (force-collapse noisy commands like `npm install`, `git commit`) and `neverPrune` (protect critical outputs like `git diff`, `cat config`) — `neverPrune` wins over size threshold.
  - **Important Line Preservation**: Error/pass/summary lines from the middle of output survive collapse in an `── IMPORTANT ──` block (`keepImportantLines`, default true).
  - **Live TUI Toast**: Pruning events now surface as toast notifications in OpenCode TUI (`pruned <target>: ~X tok`) via a new `tui/src/lib/compress-watch.js` file-watch bridge, with anti-spam cooldown (`compress.pruning.toast.cooldownMs`, default 30s).
  - **Enhanced Telemetry**: `/compress stats` now includes tool breakdown (`bash: 12 · gh: 3`), last prune event detail, and average tokens saved per prune.
  - **Per-Session Debug Snapshot**: New `compress/debug.js` lazily writes a markdown audit trail per session (`~/.local/share/opencode/compress/<session-id>/snapshot.md`) — only when compress activity (prune/skip/compact) occurs, so idle sessions cost zero I/O. Records what was pruned/skipped and why (neverPrune, failureSignal, belowThreshold, ...). Bounded to `compress.debug.maxSessions` (default 20) with oldest-first cleanup. Access via `/compress debug`. Configurable via `compress.debug.enabled`.
  - **State Relocation**: `session-context.json` and `learnings/` moved from `~/.opencode/` to the XDG data dir (`~/.local/share/opencode/`) so `~/.opencode` stays clean and consistent with other oh-my-hook state files.
  - **DCP-Style Persistent Context Management**: Adopted architecture from `opencode-dynamic-context-pruning` (balanced, not over-aggressive):
    - **Persistent Prune State**: pruning/compression results now persist per session (`~/.local/share/opencode/compress-state/<session>.json`) and re-apply on every transform — context cache actually shrinks across turns (was in-memory only).
    - **Auto Range Compression**: deterministic compression of old message spans into technical summaries, stopping at `targetSaveRatio` (default 0.5 = 50% saved, NOT DCP's ~15% — LLM keeps context).
    - **Model-Driven Compress Tool** (`compress` tool in hybrid mode): the model can trigger compression of old messages; auto still kicks in at the hard threshold.
    - **Automatic Strategies**: deduplication (repeated tool calls keep latest output only) + purgeErrors (errored tool inputs pruned after N turns, errors preserved).
    - **Context Limit From Model**: `experimental.chat.system.transform` now caches the real model context limit (replaces heuristics).
    - **TUI Compress Panel**: `/compress panel` + palette command opens a modal with a `█░` context usage bar, pruning stats, and tool breakdown.
    - **Manual `/compress` Now Actually Compresses**: `/compress` (no args) now runs the oh-my-hook pipeline first (fetch messages → prune tool outputs → auto range compress to ~50% → persist), then triggers OpenCode's native compaction. Previously it only called `client.session.compact()` which often did nothing.

### Fixed

- **CI Runner Failure & Babel Path Hardcoding (Issue #28)**:
  - Dynamically resolve Babel compiler and presets across standard module imports and global locations, with graceful fallback to pre-built `tui/dist/tui.js` when compiler dependencies are absent in CI runners.
- **Stale Pruning Toast Spamming & Active Turn Handling (Issue #29)**:
  - Added part ID deduplication in `compress/stats.js` and `compress/pruner.js` so historical tool outputs re-transformed across conversation steps never re-trigger notifications.
  - Added event ID caching in `tui/src/lib/compress-watch.js`.
  - Tuned `recentTurns: 1` default and added `massiveOutputChars: 10000` to fold huge logs immediately in active turns while protecting standard outputs.

## [0.5.1] - 2026-09-01

### Fixed

- **Plan Mode False-Positive Activation (Issue #25)**:
  - **Pruned Conversational Intent Regex**: Removed overly aggressive conversational patterns (`mikir dulu`, `bahas dulu`, `jangan edit`, `cuma mau bahas`, `analisis dulu`, `rancang dulu`) that accidentally locked sessions into Plan Mode mid-chat — e.g. "coba kita bahas dulu arsitekturnya" no longer triggers Plan Mode.
  - **Explicit Trigger Contract**: Plan Mode now activates only via explicit slash commands (`/plan`, `/design`, `/mode plan`) or unambiguous verbal instructions (`enter plan mode`, `masuk mode plan`, `switch to plan mode`, `pindah ke plan mode`).
  - **Tightened Execute Detection**: `approved`/`approve` now only match as part of command phrases (`plan approved`, `approve plan`, `sudah approve`), and `gass+` no longer matches conversational questions like "gimana kalau gass?".
  - **User Opt-in Toggle**: New `plans.autoDetectIntent` config flag (default `true`, backward compatible) — set to `false` in `omh.jsonc` for 100% slash-command-driven mode switching with no chat scanning at all.
  - **Test Coverage**: Added `tests/plans-intent.test.js` (6 unit tests) covering explicit triggers, conversational false positives, and invalid input handling. Updated `tests/e2e/mode-intent.hook.e2e.js` to use the explicit trigger phrase `masuk mode plan` instead of the removed conversational pattern.

## [0.5.0] - 2026-08-31

### Added

- **Documentation Suite (`docs/` — Issue #1)**:
 - **Modular Architecture**: Re-structured documentation portal with dedicated directories for `architecture/`, `config/`, `showcase/`, and `guides/` ready for static site generators (VitePress/Starlight).
 - **Architecture Deep Dives (`docs/architecture/`)**: Macro hook lifecycle flow, adapter boundary contracts (`tests/boundary.test.js` enforcement), and reactive TUI runtime engine documentation.
 - **Per-Module Showcases (`docs/showcase/`)**: Feature deep dives and terminal ASCII mockups across `sandbox/` (Read-Guard, Stale-Write, Secrets, Bash Guard), `plans/` (Plan Mode, Archiving, Interactive Review), `memory/` (Markdown Store, Agent Tool, Distillation, TUI Modal), `compress/` (Dynamic Pruning, Milestones), `usage/` (Cloud Quota, SQLite, Token Tree), `gateway/`, `imgsee/`, and `prompts/`.
 - **Configuration Reference (`docs/config/`)**: Multi-file resolution hierarchy (`.jsonc`/`.json`/`.yaml`/`.yml`), custom messages, and per-module schema options.
 - **Developer Guides & Troubleshooting (`docs/guides/`, `docs/troubleshooting.md`)**: Tutorial for authoring zero-dependency hooks and operational troubleshooting runbooks.

- **Open Source Community & CI Standards**:
 - **GitHub Issue & PR Forms (`.github/`)**: Added structured YAML issue forms for `bug_report.yml` and `feature_request.yml`, `config.yml` resource routing, and `.github/PULL_REQUEST_TEMPLATE.md` checklist.
 - **Community Guidelines**: Added Contributor Covenant v2.1 in `CODE_OF_CONDUCT.md` and modernized `CONTRIBUTING.md` and `AGENTS.md`.
 - **Repository Tooling (`.editorconfig`, `scripts/verify-all.sh`)**: Standardized indentation and line endings; added `npm run verify` for full-repository secret scanning, JS syntax validation, TUI sync verification, and comprehensive test runner.
 - **CI/CD Automation (`.github/workflows/`)**: Upgraded `ci.yml` with multi-OS matrix (Ubuntu/macOS) across Node.js 18/20/22 with full repo verification; added automated release workflow `release.yml` for GitHub Releases and NPM publishing on git tags.

- **Live Quota & Token Monitor (`usage/` — Issue #20, Phase 1+2)**:
 - **`/usage` slash command (0-token LLM)**: deterministic `command.execute.before` handler delivering `ignored` transcript output (`noReply: true`) so the model never reads it.
 - **Subcommands**: `/usage` (all), `/usage ollama`, `/usage agy` (+aliases `antigravity`/`google`), `/usage openrouter` (+`or`/`router`), `/usage tokens`, `/usage help`.
 - **Multi-provider quota fetchers**: Google Antigravity (weekly/5-hour buckets via `retrieveUserQuotaSummary`), Ollama Cloud (multi-key parallel fetch, `max(weekly)` + summed requests, labels from `usage.quota.ollama.accounts` config with `key#<id>` fallback), OpenRouter (balance + key limits).
 - **Dual-runtime SQLite adapter** (`usage/store-db.js`): auto-detects `bun:sqlite` (Bun) vs `node:sqlite` (Node) — zero external dependencies, read-only access to `agent.db` / `opencode.db`.
 - **Token tracking** (`usage/tokens/`): main + subagent token breakdown (input/output/reasoning/cache/cost) from `opencode.db`, per-turn delta for future toast surface.
 - **Renderer** (`usage/format.js`): transcript-safe plain bars (no ANSI), compact relative time, group-aware AGY buckets, token/USD formatters.
 - **11 unit tests** (`tests/usage.test.js`) with in-memory fixtures mirroring both DB schemas.
 - **TUI Sidebar Surfaces (Phase 3-4)**:
 - **`Tokens` accordion tree** (`sidebar_content`): collapsible main + subagent token breakdown (input/output/reasoning/cache/cost), auto-refreshes per session.
 - **`Last Turn` node**: last completed assistant turn (input, cache, output, reasoning, duration, cost) inside the Tokens tree — expanded by default for quick glance.
 - **Graceful no-credentials handling**: clear actionable message ("No provider credentials found in agent.db. Login to a provider first...") instead of misleading `0.0%` bars; per-provider "No credentials" when filtered; missing-DB guard (`existsSync`) with friendly error.
 - **Cleanup**: removed dead TUI entry (`tui/src/index.js`, `tui/src/components/`) superseded by `index.tsx`; `tui/package.json` now points to `dist/tui.js`; removed unused `usage/tokens/pricing.js` re-export.

### Fixed

- **Transcript-safe quota output**: `/usage` no longer emits ANSI escape codes — TUI transcript was mangling them (eating `[`, `]`, `)` after color sequences). Bars are now plain `[██████] 84.2%`.
- **`node:sqlite` read-only option**: `readOnly: true` → `readonly: true` (lowercase) — `DatabaseSync` rejects camelCase with "Misspelled option".
- **TUI `TextNodeRenderable` crash**: nested `<text>` inside `<text>` in the tokens sidebar tree crashed OpenTUI (`TextNodeRenderable only accepts strings`). Replaced with `<span style>` (supported `StyledText`).
- **TUI plugin stale cache**: file-path plugin specs in `tui.jsonc` / `opencode.jsonc` never refreshed because `fileTarget()` returned `undefined` for non-`file://` specs (fingerprint frozen). Switched to `file:///` specs.

## [0.4.8] - 2026-08-28

### Fixed

- ** Solid High-Contrast Plan Badge & Accurate TUI Health Status (Fixes #17)**:
 - **Solid Highlight Prompt Tag (`session_prompt_right`)**: Added high-contrast yellow solid badge (`PLAN` with active plan name) in input prompt bar with `wrapMode="none"` and `flexShrink={0}` to prevent line breaking.
 - **Accurate Sidebar Health Status**: Fixed misleading red `OFF` badge when `plans.enabled: false` by dynamically reflecting overall active guards (`● ACTIVE` / `● PLAN` / `● EXEC`).
 - **Initial State Synchronous Loading**: Initialized reactive signals with synchronous `loadModeState()` on tick 0, preventing race conditions.
- **️ Gateway & Vision Engine Hardening**:
 - **Timer Leak Prevention (`gateway/discovery.js`)**: Wrapped `AbortController` timer cleanup in `try...finally` to ensure immediate cancellation on all HTTP response paths.
 - **Deep CCA Schema Sanitization (`gateway/antigravity.js`)**: Extended recursive keyword stripping across `$defs`, `definitions`, `if`, `then`, `else`, and `not`.
 - **Universal Safe Thinking Fallback (`gateway/variants.js`)**: Replaced version string heuristics with canonical baseline tiers (`["low", "medium", "high"]`) for zero-day models, adding `resetOmpCatalog()` cache invalidation.
 - **Ecosystem Port & Security Alignment**: Standardized `imgsee` default endpoint to `:4010` (`gn gw`), added pre-flight `Content-Length` stream limits (20 MiB) in `imgsee/loader.js`, and sanitized upstream vision error logs.
- ** Broadened Package Metadata**:
 - Updated package description to a high-level suite overview and broadened ecosystem keywords.

## [0.4.7] - 2026-08-28

### Added

- ** Local Gateway Bridge (`gateway/`)**:
 - **Single Plugin Consolidation**: Consolidated `opencode-local-gateway` capabilities directly into `oh-my-hook` with zero external dependencies.
 - **Dynamic Model Auto-Discovery (`discovery.js`)**: Real-time discovery from `:4010` with resilient offline disk caching in `~/.cache/opencode/gateway-models-cache.json`.
 - **OMP Catalog Metadata Enrichment (`normalizer.js`, `variants.js`)**: Direct extraction of exact token pricing (`cost`), context window limits, and thinking effort tiers from Oh-My-Pi catalog (`models.json`).
 - **Antigravity CCA Schema Armor (`antigravity.js`)**: Strips forbidden OpenAPI keywords (`$schema`, `title`, `additionalProperties`) in `tool.definition` to protect against Google Antigravity HTTP 400 errors.
 - **Security & Loopback Protection**: URL normalization with strict loopback validation guards.

## [0.4.6] - 2026-08-28

### Removed

- **Amputated `omp/` Module**:
 - Removed obsolete `omp/` directory (`catalog.js`, `gateway-proxy.ts`, `extension.ts`, `index.js`) and deprecated `models.yml` parser.
 - Relocated CommandCode discovery logic to dedicated OMP runtime extension in `~/.omp/agent/extensions/commandcode-loader.ts`.
 - Cleaned up `ompHooks` and `omp` configuration schema from `share/config.js` and `index.js`.

## [0.4.5] - 2026-08-28

### Added

- **️ Multimodal Vision Engine (`imgsee/`)**:
 - **Native Agent Tool (`imgsee`)**: Enables agents to inspect local screenshots, UI mockups, diagrams, and image URLs via out-of-band one-shot vision requests (`path`, `question`, `mode`).
 - **Isolated Gateway Bridge (`client.js`)**: Routes vision tasks to local OMP Gateway (`:4010` / `:4000`) or OpenAI-compatible vision endpoints without polluting primary session contexts.
 - **Format Sniffer & Loader (`loader.js`)**: Validates PNG, JPEG, GIF, and WEBP formats via file magic bytes with a 20 MiB safety cap.
 - **Diagnostic Prompt Directives (`prompts/vision-system.md`)**: Evidence-first analysis, verbatim OCR extraction, spatial UI coordinates, and root cause debugging.
 - **Deterministic `/imgsee` Slash Command**: Inspect visual artifacts directly in session transcripts with 0 LLM token cost.
 - **Test Suite Expansion**: Added unit tests in `tests/imgsee.test.js` (**128 passing unit tests**).

## [0.4.4] - 2026-08-26

### Changed

- ** OMP Catalog Enhancement**:
 - **Pretty Model Names**: `formatModelName()` renders `[OMP] deepseek-chat` as `Deepseek (omp)` with brand casing (Gemini, GPT, QwQ, Claude) and provider aliases (`openai` → `oai`, `github-copilot` → `copilot`).
 - **Health Filtering**: Registers only healthy models based on `gn ping` cache (`~/.config/gn/cache/ping/`) when health data is available.
 - **Gateway Disk Cache**: Fetch results cached for 1 hour in `~/.config/opencode/cache/omp-catalog-cache.json`; network failures fall back to stale cache.

### Fixed

- **️ Prompt Router No Longer Overwrites Custom Agent Personas (#12)**:
 - `prompts/` router previously replaced the base prompt segment unconditionally, destroying user-authored agent personas defined in OpenCode config (`agent.<name>.prompt`).
 - Added built-in base prompt fingerprint detection (`hasCustomPersona`) — the router now only swaps OpenCode's generic provider prompts (`default`, `anthropic`, `beast`, `gpt`, `gemini`, `kimi`, `meta`) and leaves custom personas untouched.
 - New opt-in flag `prompts.overridePersona` in `omh.jsonc` restores the old overwrite-everything behavior when explicitly desired.
- **PR Review Fixes**:
 - Dropped dead 4th argument in `/compress` `deliverCommandOutput` call.
 - Isolated gateway cache write so disk failures never discard freshly fetched models.
 - Retargeted agent-context tests to the live `compress/agent-context.js` and removed the orphaned duplicate in `context/`.

## [0.4.3] - 2026-08-23

### Added

- **️ Context Compression & Dynamic Pruning Suite (`compress/`)**:
 - Re-architected `context/` into a dedicated `compress/` suite with backward-compatible deprecation shims.
 - **Dynamic Tool Output Pruning (`experimental.chat.messages.transform`)**: Intelligently collapses bulky historical test/build/git outputs into clean, deterministic markers while preserving recent 2-turn window and failure outputs (`FAILED`, `panic:`, `Traceback`, `npm ERR!`).
 - **Milestone & Post-Push Idle Auto-Compaction (`automation.js`)**: Automatically detects successful `git push` executions in bash, takes branch/diff snapshots, and triggers background compaction when the agent enters an idle state with strict safety gates (min 30 messages, 2-turn delay, 10-minute cooldown, max 2 auto-compactions per session).
 - **Deterministic Slash Commands (`commands.js`)**: Added `/compress` (immediate compaction) and `/compress stats` (metrics inspection) delivered to session transcripts with 0 LLM token cost.
 - **Persistent Stats Ledger (`stats.js`)**: Tracks pruned outputs, bytes saved, and estimated token savings per session and global aggregates bounded to 50 sessions.
 - **TUI Observability Integration (`tui/`)**: Added live pruning and token savings counters to OpenCode TUI sidebar widget and metrics helpers.
 - **E2E Hook Pipeline Expansion**: Added deterministic `compress.hook.e2e.js` test pipeline (**112 passing unit tests** and **5 E2E pipelines**).

- ** OMP Gateway Bridge (`omp/`)**:
 - **Dynamic Auto-Discovery**: Fetches live models from local OMP Gateway (`:4000`) and registers them into OpenCode's `config.provider` at startup — zero hardcoding.
 - **`models.yml` Aggregator**: Parses `~/.omp/agent/models.yml` and bridges custom providers (Kilo, OpenCode Zen, OpenRouter, Charm Hyper) with automatic API key resolution from env vars.
 - **Model Intelligence**: Built-in classification for reasoning models (`deepseek-v4`, `o3`, `gpt-5`, `claude-sonnet-4`, etc.) and non-chat models (embedding, TTS, image-gen) with context window estimation.
 - **OMP Extension (`extension.ts`)**: Generic TypeScript loader for OMP runtime — any provider added to `models.yml` becomes instantly available via `pi.registerProvider()`.
 - **Unified Gateway Proxy (`gateway-proxy.ts`)**: Standalone Bun proxy on `:4000` that aggregates `models.yml` curated providers + internal OMP Auth-Gateway (`:4002`) into a single OpenAI-compatible endpoint.

## [0.4.2] - 2026-08-23

### Added

- ** Dynamic System Prompt Router (`prompts/`)**:
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
- ** Test Suite Expansion**:
 - Added unit test suite covering resolution hierarchy, wildcard routes, family keywords, and custom default fallbacks (**96 passing unit tests**).

## [0.4.1] - 2026-08-22

### Added

- ** Pure Markdown Memory Engine & Native Agent Tool (`memory/`)**:
 - Re-architected memory storage to 100% human-readable Markdown stores (`~/.config/opencode/memory/MEMORY.md` for Global and `projects/<slug>/MEMORY.md` for Project rules).
 - Pushed over 1,000 lines of complex boilerplates (JSONL schemas, BM25 indexing, queue workers) out of the critical path.
 - **Native OpenCode Agent Tool (`memory`)**: Exposes an autonomous 4-action tool (`add`, `replace`, `remove`, `list`) with Hermes-style substring matching (`old_text`) and secret scanner protection.
 - **Unified `/memory` Slash Command**: Single deterministic command entrypoint with `noReply: true` + `createHandledError()` output delivery (0 token LLM).
- **️ Native OpenCode TUI Dialog Integration (`tui/`)**:
 - Replaced custom scrollboxes with native OpenCode `api.ui.DialogSelect` and `api.ui.DialogPrompt` components for instant keyboard navigation (`↓/↑`, `j/k`, `Enter`, `Esc`, `PageUp/Down`) and live fuzzy search (`fuzzysort`).
 - **3 Dedicated Scoped Modals**:
 - `Memory: All` (Read & Replace/Edit on `Enter`).
 - `Memory: Global` (Add via `Ctrl+A`, Delete via `Ctrl+D` 2x, Edit on `Enter`).
 - `Memory: Project` (Add via `Ctrl+A`, Delete via `Ctrl+D` 2x, Edit on `Enter`).
 - **Double-Trigger Delete Confirmation**: 1st press of `Ctrl+D` highlights row with red warning background (`theme.error`); 2nd press executes deletion. Moving cursor resets confirmation.
 - **Native Clean Footer**: Typography-driven action bar (`edit enter new ctrl+a delete ctrl+d`) matching `/session` and `/models` styling without bracket clutter.
 - **Streamlined Sidebar**: Focused 3-item monitor (`Mode`, `Shields`, `Memory`) with red color coding for disabled states.
- ** Architectural Standard in `AGENTS.md`**:
 - Added dedicated `## TUI & Slash Command Architecture` documenting dual execution models (Visual Modal vs Deterministic Transcript) and the autocomplete anti-collision rule.

## [0.4.0] - 2026-08-22

### Added

- ** Terminal-Native Interactive Plan Line Reviewer (`plans/parser.js` & `tui/src/index.tsx`)**:
 - Line-level markdown parser supporting arbitrary document structures (headings, checklists, codeblocks, tables, blockquotes).
 - Contextual annotation modal in OpenCode TUI (`/plan review` / `oh-my-hook.plan.review`):
 - `[↓]/[↑]` arrow navigation across document lines (unfocused by default).
 - `[Enter]` opens inline correction box to dispute or rectify specific lines.
 - `[Ctrl+A]` submits line-level feedback and auto-approves.
 - Dynamic navigation hint footer adapting to current view state.
- **‍️ Goblin Plan Protocol (Anti-OVT Agent Gate)**:
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
 - Re-architected `share/block.js` and `share/messages.js` into clean, concise English blockquotes (`#### Title\n> *Reason*\n> *Hint*`).
 - Updated template prompts (`plan.md`, `design.md`, `approve.md`) into structured RFC templates.
- **Strict Regex Intent Detection**:
 - Replaced naive substring matching with explicit regex phrase matchers (`PLAN_INTENT_PATTERNS` & `EXECUTE_INTENT_PATTERNS`) to eliminate false-positive plan mode triggers.
- Increased test suite to **93 passing unit tests** and deterministic E2E verification.

## [0.3.0] - 2026-08-21

### Added

- ** Dedicated Sandbox Module (`sandbox/`)**:
 - Re-architected pre-execution security and runtime gate into a cohesive `sandbox/` module.
 - **Native OpenCode Hook Integration**:
 - `"permission.ask"`: Auto-denies risky operations at the core permission gate before annoying modal popups appear.
 - `"shell.env"`: Injects runtime isolation environment variables (`OMH_SANDBOX=1`, `OMH_SESSION_ID`, `NO_COLOR=1`) into all subshells.
 - **Advanced Secret AST Scanner**: Extended coverage to PKCS#8 private keys (`-----BEGIN PRIVATE KEY-----`), AWS STS Session Keys (`ASIA...`), and modern DB URI schemes (`postgresql://`).
 - **Dangerous Bash Hardening**: Added patterns for `rm -fr /*`, `wget ... | bash`, and block storage rewrites (`/dev/nvme*`, `/dev/vd*`).
 - **Chained Git Push Protection**: Detects and blocks force-pushing to main/master even in chained commands (`git add . && git push origin main --force`).
 - **Anti Self-Stale Lockout**: Auto-refreshes session read ledger immediately upon successful `write`/`edit`/`patch` tool execution and post-edit linter autofixes.
- ** XDG Base Directory Specification Separation**:
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

- ** Self-Learning & Dynamic Relevance Memory Upgrade (Reflexio Architecture)**:
 - **Auto-Detection & Distill**: Heuristic regex classifier (`memory/detect.js`) for user corrections and prohibitions with async throttled queue (`queue.jsonl`).
 - **Dynamic BM25 Relevance Matcher**: Pure JS Okapi BM25 token scoring engine (`memory/matcher.js`) with zero external dependencies and bilingual stopwords (ID/EN) for prompt token safety.
 - **Categorized Structured Store**: Automatic storage in `~/.config/opencode/memory/rules/` for preferences, project skills (SOPs), and shared skills.
 - **Smart Session Injection**: Dynamic context injection (`memory/inject.js`) into `experimental.chat.system.transform` matching only relevant rules per prompt turn.
 - **Jaccard Dedup & Contradiction Superseding**: Background distiller (`memory/distill.js`) merges similar rules and retires obsolete contradicted rules.
- **️ Native TUI Memory Inspector Modal (`tui/`)**:
 - Direct `/memory` slash command dialog popup via `api.keymap.registerLayer` and `api.ui.dialog.replace`.
 - Tabbed interactive browser (`[Semua]`, `[Preferences]`, `[Project Skills]`) with native scrollbox and `Esc` close handler.
 - Live structured memory counters in the collapsible sidebar widget.
- **New Memory Slash Commands**:
 - `/memory-forget <id>`: Soft-delete / retract obsolete memory rules.
 - `/memory-scan`: Force process pending background distill queue jobs.

### Changed

- Updated storage architecture to clean Markdown-centric layout in `~/.config/opencode/memory/` with automatic CWD detection (Home `~` Global `MEMORY.md`, Project `projects/<slug>/MEMORY.md`).
- Increased test coverage to **89 passing unit tests** and full E2E hook pipeline verification.

## [0.2.0] - 2026-08-16

### Added

- **OpenCode TUI Frontend Module (`tui/`)**:
 - `session_prompt_right` slot: Dynamic reactive badge ` [plan mode]` rendered in warning orange when the active session is in plan mode. Automatically hides during execute mode.
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
 - **3-Level Template Resolution**: Loads prompt templates with precedence: Project (`.opencode/prompts/`) Global (`~/.config/opencode/prompts/`) Built-in fallback (`plans/prompts/`).
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

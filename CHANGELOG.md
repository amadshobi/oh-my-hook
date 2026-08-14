# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

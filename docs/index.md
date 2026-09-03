# oh-my-hook Documentation

Welcome to the comprehensive documentation suite for **oh-my-hook**, the production-grade runtime safety supervisor, execution harness, and TUI surface for OpenCode agents.

---

## Quickstart (1-Minute Setup)

`oh-my-hook` is designed with **zero-config defaults**. You can register it immediately in your OpenCode configuration files without creating an initial config file.

### 1. Register Plugin

Add `oh-my-hook` to both your server hooks and TUI surface:

```jsonc
// ~/.config/opencode/opencode.jsonc
{
 "$schema": "https://opencode.ai/config.json",
 "plugin": [
 "oh-my-hook" // or local absolute path: "/path/to/oh-my-hook"
 ]
}
```

```jsonc
// ~/.config/opencode/tui.jsonc
{
 "$schema": "https://opencode.ai/tui.json",
 "plugin": [
 "oh-my-hook" // or local absolute path: "/path/to/oh-my-hook"
 ]
}
```

### 2. Verify Installation

Launch `opencode` in any project workspace and check:
- **TUI Sidebar**: A collapsible `▼ oh-my-hook` section appears in the sidebar displaying status (`● ACTIVE` / `● PLAN` / `● EXEC`), active shield counts, and memory bullet totals.
- **Deterministic Commands**: Run `/mode` or `/usage` directly in the prompt input.

---

## Documentation Portal

Explore the documentation by section:

| Section | Description |
| :--- | :--- |
| [**Introduction & Philosophy**](./intro.md) | The problem space of AI agents, core engineering pillars, and why `oh-my-hook` exists. |
| [**Architecture & Internals**](./architecture/index.md) | Hook lifecycle flows, the handled 0-token transcript pattern, adapter boundary isolation, and reactive TUI runtime. |
| [**Showcase & Products**](./showcase/sandbox/index.md) | Deep dives and terminal UX mockups for Sandbox, Plans, Memory, Compress, Usage, Imgsee, Prompts, and Gateway. |
| [**Configuration Reference**](./config/overview.md) | Complete multi-file configuration guide (`.jsonc`, `.json`, `.yaml`, `.yml`), precedence rules, and custom message interpolation. |
| [**Developer Guides**](./guides/custom-hooks.md) | Step-by-step tutorials for authoring zero-dependency hooks and writing deterministic E2E tests. |
| [**Troubleshooting & Runbook**](./troubleshooting.md) | Actionable solutions for guardrail blocks, stale file detection, SQLite permissions, and debugging tips. |

---

## Zero-Dependency Purity

`oh-my-hook` core runtime relies **exclusively** on native Node.js ESM built-ins (`node:fs`, `node:path`, `node:child_process`, `node:crypto`, `node:os`). It introduces zero supply-chain vulnerabilities, executes instantaneously, and ensures predictable execution across Linux and macOS environments.

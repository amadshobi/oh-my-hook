# Contributing to oh-my-hook

Thank you for your interest in contributing to **oh-my-hook**! We welcome contributions, bug reports, and feature proposals that help make the AI agent developer loop robust, safe, and disciplined.

---

## 🏗️ Architecture & Design Philosophy

1. **Pure ESM & Standard Library First**: We rely strictly on Node.js built-in modules (`node:fs`, `node:path`, `node:child_process`, `node:os`). Do not add external runtime dependencies without prior discussion.
2. **Single Entry Hook Composition**: `index.js` serves as the sole entry point, composing `guard/`, `context/`, `reminder/`, and `memory/` modules via `share/merge.js`.
3. **Hard Blocks vs. Soft Nudges**:
   - Guard violations throw errors via `blockMessage()` in `share/block.js`.
   - Reminders and non-fatal warnings notify or attach metadata via `warnMessage()`.
4. **State Isolation**: Persistent states reside under `~/.config/opencode/`. Unit tests must clean up or restore state in `finally` blocks.

---

## 🛠️ Development Workflow

### Prerequisites

- Node.js >= 18.0.0

### Running Tests

```bash
# Run fast unit tests
npm test

# Run deterministic hook E2E pipeline
npm run test:e2e

# Run all test suites
npm run test:all
```

---

## 📜 Commit Guidelines

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- Format: `type(scope): description`
- Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.
- Rules:
  - Max 72 characters for subject line.
  - Lowercase description.
  - No trailing period.
  - **No emojis** in commit titles.

---

## 🚀 Submitting a Pull Request

1. Fork the repository and create a descriptive feature branch (`git checkout -b feat/my-new-guard`).
2. Implement your changes following existing patterns and naming conventions (kebab-case files).
3. Add unit tests under `tests/` covering your changes and edge cases.
4. Verify all tests pass (`npm run test:all`).
5. Open a Pull Request with a clear description of the problem and technical rationale.

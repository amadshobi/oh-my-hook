# Contributing to oh-my-hook

Thank you for your interest in contributing to **oh-my-hook**! We welcome contributions, bug reports, and feature proposals that help make the AI agent developer loop robust, safe, and disciplined.

---

## Architecture & Design Philosophy

1. **Pure ESM & Standard Library First**: We rely strictly on Node.js built-in modules (`node:fs`, `node:path`, `node:child_process`, `node:crypto`, `node:os`). Do not add external runtime dependencies to server hooks without prior architectural discussion.
2. **Single Entry Hook Composition**: `index.js` serves as the sole entry point, composing `sandbox/`, `plans/`, `memory/`, `compress/`, `usage/`, `gateway/`, `imgsee/`, `prompts/`, and `reminder/` modules via `share/merge.js`.
3. **Hard Blocks vs. Soft Nudges**:
 - Guard violations throw errors via `formatBlockMessage()` in `share/messages.js`.
 - Reminders and non-fatal warnings notify or attach metadata via `formatWarnMessage()`.
4. **State Isolation**: Persistent session states reside under `~/.local/share/opencode/` or `~/.config/opencode/`. Unit tests must clean up or restore state in `finally` blocks.

---

## Development Workflow

### Prerequisites

- Node.js >= 18.0.0 (or Bun >= 1.0)
- OpenCode CLI (for local integration testing)

### Setting Up Workspace

```bash
# Clone the repository
git clone https://github.com/amadshobi/oh-my-hook.git
cd oh-my-hook

# Install development dependencies (esbuild for TUI)
npm install

# Build the OpenCode TUI frontend bundle
npm run build:tui
```

### Running Test Suites

```bash
# Run fast unit tests (140+ passing tests)
npm test

# Run deterministic hook E2E pipeline
npm run test:e2e:hooks

# Run all test suites
npm run test:all
```

---

## Commit Guidelines

We strictly enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- Format: `type(scope): description`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.
- Constraints:
 - Max **72 characters** for the subject line.
 - Description must start with a lowercase letter.
 - No trailing period.
 - **No emojis** in commit titles.

### Co-Author Attribution
If authoring commits with AI assistance, append the appropriate `--trailer`:
```bash
git commit -m "feat(sandbox): add new security pattern" \
 --trailer "Co-authored-by: opencode-agent[bot] <219766164+opencode-agent[bot]@users.noreply.github.com>"
```

---

## Submitting a Pull Request

1. Fork the repository and create a descriptive feature branch (`git checkout -b feat/my-new-guard`).
2. Implement your changes following existing patterns and naming conventions (kebab-case files).
3. If modifying TUI components, verify that `npm run build:tui` produces a clean bundle.
4. Add unit tests under `tests/` covering your changes and edge cases.
5. Verify all tests pass (`npm run test:all`).
6. Open a Pull Request filling out the PR checklist in `.github/PULL_REQUEST_TEMPLATE.md`.

# Headless & Deterministic Testing

`oh-my-hook` includes automated unit tests and deterministic E2E pipelines that run locally without live LLM provider connections or interactive TUI sessions.

---

## 🧪 Running Test Suites

### 1. Unit Tests
Executes unit tests covering all core modules (`sandbox/`, `plans/`, `memory/`, `compress/`, `gateway/`, `imgsee/`, `usage/`):

```bash
npm test
```

### 2. Hook E2E Pipeline Tests
Executes deterministic lifecycle tests simulating full OpenCode agent sessions:

```bash
npm run test:e2e:hooks
```

### 3. Run All Suites
```bash
npm run test:all
```

---

## 💻 Manual Headless Verification Workflow

To test slash commands or memory generation headless via OpenCode CLI:

```bash
# 1. Test Project-Scoped Memory
mkdir -p /tmp/test-project
opencode run --dir /tmp/test-project "/remember Always run tests with bun test in this repo"

# 2. Inspect persisted memory
cat ~/.config/opencode/memory/projects/tmp/test-project/MEMORY.md

# 3. Clean up test fixtures
rm -rf /tmp/test-project ~/.config/opencode/memory/projects/tmp/test-project
```

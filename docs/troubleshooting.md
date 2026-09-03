# Troubleshooting & Runbook

Common runtime questions, guardrail error codes, and operational fixes.

---

## Guardrail Error Codes & Actions

### 1. `Unread File`
- **Cause**: The agent attempted to modify a file before reading it in the active session.
- **Action**: Run `read` or `grep` on the target file first.

### 2. `Stale File`
- **Cause**: The file was modified on disk by another process or user after the agent read it.
- **Action**: Call `read` again to load the updated content and synchronize the read ledger.

### 3. `Plan Mode Active`
- **Cause**: The active session is in Plan Mode, locking source code modifications.
- **Action**: Run `/approve` (or `/exec`) to transition into implementation mode.

### 4. `Secret Detected`
- **Cause**: The file content or edit payload contains patterns matching API keys, JWTs, or private keys.
- **Action**: Remove the secret and replace it with environment variable references (e.g. `process.env.API_KEY`).

### 5. `Dev Server Blocked`
- **Cause**: A command like `npm run dev` or `vite` was started in the foreground.
- **Action**: Launch dev servers inside a `tmux` or `screen` session.

---

## ️ SQLite Database Diagnostics

### `/usage` Displays "Database not found"
- **Cause**: The OpenCode SQLite database (`~/.local/share/opencode/opencode.db`) or OMP database (`~/.omp/agent/agent.db`) has not been initialized.
- **Action**: Run at least one session in `opencode` or `omp` to create the databases.

---

## Resetting State Ledgers

If you need to completely reset session state or read tracking:

```bash
# Clear read ledger
rm -f ~/.local/share/opencode/oh-my-hook-read-ledger.json

# Reset mode states
rm -f ~/.local/share/opencode/oh-my-hook-mode.json
```

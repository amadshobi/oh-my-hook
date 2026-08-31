# Read-Before-Write & Stale-Write Guard

The Read-Before-Write and Stale-Write guardrails enforce execution discipline by ensuring that agents never blindly overwrite files or clobber out-of-band changes made by users or external tools.

---

## Problem Solved

1. **Hallucinated Edits**: Models frequently attempt to rewrite files based on guessed assumptions about structure, imports, or variable names without reading the existing implementation.
2. **Race Conditions & File Clashes**: When a user or linter modifies a file on disk after the agent read it, subsequent blind edits overwrite the external updates.

---

## How It Works

```
[Agent triggers edit/write] ──► [Check Session Read-Ledger]
 │
 ┌─────────────────────┴─────────────────────┐
 ▼ ▼
 [Never Read] [Was Read]
 │ │
 Throw Block Error [Inspect Disk State]
 │
 ┌───────────────────────┴───────────────────────┐
 ▼ ▼
 [mtime/Size Changed] [State Unchanged]
 │ │
 Throw Stale Error Allow Execution
 │
 ▼
 [tool.execute.after]
 │
 Auto-Sync New mtime/Size
```

### 1. Read-Before-Write Barrier
Before any `write`, `edit`, or `patch` tool runs, `oh-my-hook` queries the session read-ledger (`~/.local/share/opencode/oh-my-hook-read-ledger.json`). If the file was not read in the active session:

```
#### GUARDRAIL BLOCK: Unread File
> *File 'src/auth/token.js' has not been read in this session.*
> *Use read tool to inspect file before editing.*
```

### 2. Stale-Write Detection
If the file was read earlier, `oh-my-hook` verifies that the file's current modification timestamp (`mtimeMs`) and byte size match the values recorded when the agent read it. If the file was altered externally:

```
#### GUARDRAIL BLOCK: Stale File
> *File 'src/auth/token.js' changed on disk after last read.*
> *Re-read file to fetch latest changes before writing.*
```

### 3. Self-Mutation Auto-Sync
When the agent successfully edits a file through authorized tools, `tool.execute.after` automatically refreshes the ledger entry with the new `mtimeMs` and `size`. This prevents the agent from blocking itself on successive edits to the same file.

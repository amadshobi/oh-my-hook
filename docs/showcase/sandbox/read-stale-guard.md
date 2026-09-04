# Read-Before-Write, Stale-Write & Bash Mutation Guard

The Read-Before-Write and Stale-Write guardrails enforce execution discipline by ensuring that agents never blindly overwrite files or clobber out-of-band changes made by users or external tools.

---

## Capabilities

### 1. Read-Before-Write Barrier
Before any `write`, `edit`, or `patch` tool runs, `oh-my-hook` queries the session read-ledger (`~/.local/share/opencode/oh-my-hook-read-ledger.json`). If the file was not read in the active session:

```
🛑 BLOCKED: Read before you edit
Reason: File "src/auth/token.js" has not been read in this session.
Action: Call `read` tool first. Shell bypass is forbidden.
```

### 2. Bash File-Mutation Interceptor
Models prevented from editing via native tools often attempt workarounds through terminal commands (`cat << 'EOF' > file`, `echo "code" >> file`, `tee -a file`, or `sed -i`). The guardrail inspects terminal commands and intercepts bash mutations targeting unread files.

### 3. Cross-Session Ledger Preservation
When sessions are detached, reconnected, or restarted, `oh-my-hook` performs a cross-session lookup across the ledger. If the file was read in a previous session and its on-disk physical state (`mtimeMs` and `size`) remains unchanged, mutation is allowed without requiring a redundant re-read, and the ledger automatically re-syncs to the active session.

### 4. Stale-Write Detection
If a file was read earlier, `oh-my-hook` verifies that the file's current modification timestamp (`mtimeMs`) and byte size match disk state. If altered externally out-of-band:

```
🛑 BLOCKED: Stale file detected
Reason: File "src/auth/token.js" changed on disk after last read.
Action: Re-read file to fetch latest changes before writing.
```

### 5. Self-Mutation Auto-Sync
When the agent successfully mutates a file through authorized tools or shell commands, `tool.execute.after` automatically refreshes the ledger entry with the updated `mtimeMs` and `size`, preventing self-stale lockouts on successive edits.

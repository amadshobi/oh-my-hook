# Dangerous Bash & Dev Server Guard

The `dangerousBash` and `devServerGuard` protections prevent agents from damaging host filesystems, entering recursive fork loops, or spawning orphan background server processes.

---

## Destructive Command Barrier

When the agent invokes the `bash` tool, `sandbox/security.js` tests the command against strict regular expression signatures before subprocess execution.

### Blocked Command Signatures:
- **Root Filesystem Deletions**: `rm -rf /`, `rm -fr /*`, `rm -rf /`
- **Filesystem Formatting**: `mkfs.ext4`, `mkfs.vfat`, etc.
- **Direct Block Device Overwrites**: `dd if=... of=/dev/sda`, `> /dev/nvme0n1`
- **Recursive Permission Escalations**: `chmod -R 777 /`
- **Fork Bombs**: `:(){ :|:& };:`
- **Piped Remote Shell Execution**: `curl ... | sh`, `wget ... | bash`

### Terminal Output:
```
#### GUARDRAIL BLOCK: Dangerous Command Blocked
> *Command "rm -rf /" matches destructive system patterns.*
> *Action requires explicit user confirmation.*
```

---

## ️ Dev Server Guard (`devServerGuard`)

Coding agents frequently attempt to run live development servers (e.g. `npm run dev`, `vite`, `next dev`, `python manage.py runserver`) directly in foreground subshells. This hangs the agent loop and creates orphaned background processes.

### Enforcement Rule:
Dev servers are **only permitted** when running inside a terminal multiplexer (`tmux` or `screen`) or when explicit environment variables (`TMUX` or `STY`) are detected.

### Terminal Output:
```
#### GUARDRAIL BLOCK: Dev Server Blocked
> *Command "npm run dev" cannot run as orphan foreground process.*
> *Run dev servers inside a tmux or screen session.*
```

---

## ️ Force Push Protection

To protect Git collaboration integrity, `oh-my-hook` intercepts `git push` commands:
- **Force Push to Main/Master**: Hard-blocked immediately (`git push --force origin main`).
- **Standard Force Push / Missing Remote**: Generates non-blocking soft warnings in the session transcript to alert the developer.

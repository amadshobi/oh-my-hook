# Plan Mode & Mutation Barrier

When an agent enters Plan Mode, `oh-my-hook` erects a strict mutation barrier that blocks destructive actions across source code while allowing durable planning files to be authored.

---

## 🔒 The Plan Mode Barrier

When a session enters Plan Mode (via `/plan` or `/design`):

1. **Mutating Tool Lockout**: The tools `write`, `edit`, `patch`, and state-mutating `bash` commands are completely disabled for project files.
2. **Read-Only Commands Allowed**: Inspection commands (`git status`, `git diff`, `npm test`, `cargo check`, `grep`, `glob`, `read`) remain fully functional.
3. **Plan Directory Whitelist**: The agent is permitted to write **only** to the configured plan directory (`~/.opencode/plans/` or subpaths under `~/.opencode/plans/designs/`).

### Terminal Output:
```
#### 🚫 GUARDRAIL BLOCK: Plan Mode Active
> *Cannot modify project code while session is in Plan Mode.*
> *Run '/approve' or wait for execution trigger to modify files.*
```

---

## 📂 Versioned Plan Archiving

When saving durable plans via `/plan to-file <name>`:
- The target file is written to `~/.opencode/plans/<name>.md`.
- If an older draft exists at that location, `plans/store.js` automatically archives it into `~/.opencode/plans/versions/<name>-v<N>.md` before overwriting.
- Up to `versionLimit` (default: 20) historical versions are retained, creating an audit trail of architectural evolution.

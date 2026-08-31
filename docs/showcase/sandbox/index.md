# Sandbox Execution Safety Suite

The `sandbox/` module provides strict, pre-execution gates that reject dangerous terminal commands, unread file overrides, concurrent file collisions, and credential leaks.

---

## Module Overview

```
 Agent Tool Call (write, edit, bash, etc.)
 │
 ▼
 ┌────────────────────────┐
 │ tool.execute.before │
 └────────────┬───────────┘
 │
 ┌───────────────────────┼───────────────────────┐
 │ │ │
 ▼ ▼ ▼
 [Read & Stale Guard] [Secret AST Scanner] [Dangerous Bash Guard]
 • Read-before-write • API keys (OpenAI/etc) • Destructive bash commands
 • Stale mtime / size • Private keys (PKCS#8) • Orphan background servers
 • Self-mutation sync • High-entropy secrets • Force pushes to main
```

---

## ️ Sandbox Sub-Components

- [**Read-Before-Write & Stale-Write Guard**](./read-stale-guard.md): Forces agents to read and understand files before editing; detects out-of-band disk changes and prevents self-mutation lockouts.
- [**Secret Scanner**](./secret-scanner.md): Regex AST engine detecting API tokens, private keys, database connection strings, and JWTs in tool payloads before they touch disk.
- [**Dangerous Bash & Dev Server Guard**](./dangerous-bash.md): Blocks destructive commands (`rm -rf /`, piping wget/curl to shell) and enforces terminal session managers (`tmux`) for dev servers.
- [**Commit Guard & Co-Author Trailers**](./commit-guard.md): Enforces pure Conventional Commits format and appends appropriate bot attribution trailers.

---

## ️ Default Configuration

```jsonc
// ~/.config/opencode/omh.jsonc
{
 "sandbox": {
 "readBeforeWrite": true,
 "staleWrite": true,
 "secretScanner": true,
 "commitGuard": true,
 "devServerGuard": true,
 "dangerousBash": true
 }
}
```

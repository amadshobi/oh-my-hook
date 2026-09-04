# Dangerous Bash, Dev Server Guard & Push Protection

The `dangerousBash`, `devServerGuard`, and `checkPush` protections prevent agents from damaging host filesystems, corrupting Git repositories, locking foreground subshells, or force-pushing destructive changes.

---

## Destructive Command Barrier

When the agent invokes the `bash` tool, `sandbox/security.js` validates commands against safety signatures before execution.

### Blocked Destructive Signatures:
- **Filesystem Root Deletion**: `rm -rf /`, `rm -fr /*`
- **User Home Directory Deletion**: `rm -rf ~`, `rm -rf $HOME`
- **Git Repository Corruption**: `rm -rf .git`
- **Workspace Root Deletion**: `rm -rf .`, `rm -rf *`
- **Destructive Git Operations**: `git reset --hard`, `git clean -fdx`, `git clean -f`
- **Filesystem Formatting**: `mkfs.ext4`, `mkfs.vfat`, etc.
- **Direct Block Device Overwrites**: `dd if=... of=/dev/sda`, `> /dev/nvme0n1`
- **Permission Escalations**: `chmod -R 777 /`
- **Fork Bombs**: `:(){ :|:& };:`
- **Piped Remote Shell Execution**: `curl ... | sh`, `wget ... | bash`

### Terminal Output:
```
🛑 BLOCKED: Dangerous command blocked
Reason: Command "rm -rf .git" matches destructive wipe or system overwrite signature.
Action: Action forbidden. Ask user for manual execution if needed.
```

---

## ⚙️ Configuration in `omh.jsonc`

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "sandbox": {
    "dangerousBash": {
      "enabled": true,
      "blockWipeHome": true,      // Block rm -rf ~, $HOME
      "blockWipeGit": true,       // Block rm -rf .git
      "blockWipeWorkspace": true, // Block rm -rf . or rm -rf *
      "blockGitDestructive": true // Block git reset --hard, git clean -fdx
    }
  }
}
```

---

## Dev Server Guard (`devServerGuard`)

Development servers (e.g. `npm run dev`, `vite`, `next dev`, `python manage.py runserver`) running in foreground subshells deadlock agent turn loops.

### Enforcement Rule:
Dev servers are **only permitted** inside terminal multiplexers (`tmux` or `screen`) or when multiplexer environment variables (`TMUX` or `STY`) are present.

### Terminal Output:
```
🛑 BLOCKED: Dev server blocked
Reason: Command "npm run dev" cannot run as orphan foreground process.
Action: Run inside tmux: `tmux new -d -s dev "npm run dev"`
```

---

## Git Push & Branch Protection

Protects Git remotes from accidental history destruction:
- **Force Push to Main/Master**: Hard-blocked immediately (`git push --force origin main`).
- **Remote Branch Deletion**: Hard-blocked for main/master (`git push origin --delete main`, `git push origin :main`).
- **Force Push to Feature Branches**: Surfaces soft warnings in transcript.

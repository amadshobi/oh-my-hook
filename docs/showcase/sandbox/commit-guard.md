# Commit Guard & Co-Author Attribution

The `commitGuard` component enforces standardized Git histories across human and AI-assisted commits, prevents hook bypasses, and validates automated attribution trailers.

---

## Conventional Commits Enforcement

When `bash` executes `git commit` or `gh pr merge`, `sandbox/security.js` parses the commit message and validates it:

### Validation Rules:
1. **Format**: Must follow `type(scope): description` or `type: description`.
2. **Allowed Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.
3. **Configurable Length**: Subject line length is validated against `sandbox.commitGuard.maxChars` (default 72).
4. **No Trailing Period**: Subject lines must not end with a period.
5. **Lowercase Description**: Description after prefix must begin with a lowercase letter.
6. **No Emojis**: Keeps git logs clean and machine-parsable.
7. **Hook Bypass Protection**: Flags like `--no-verify` or `-n` are blocked.
8. **Optional Co-Author Requirement**: When `requireCoAuthor: true`, commits without a valid attribution trailer are blocked.
9. **GitHub CLI Interception**: Validates PR merge subjects passed via `gh pr merge --subject`.

### Terminal Output:
```
🛑 BLOCKED: Invalid commit format
Reason: Commit message issues:
  - Subject line is 84 chars (max 72)
  - Description should start with lowercase letter
Action: Use Conventional Commits: `type(scope): description`
```

---

## ⚙️ Configuration in `omh.jsonc`

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "sandbox": {
    "commitGuard": {
      "enabled": true,
      "maxChars": 72,        // Set custom limit (e.g. 50, 72, 100)
      "requireCoAuthor": true, // Require Co-authored-by trailer
      "blockNoVerify": true,  // Prevent bypassing git hooks
      "interceptGh": true     // Validate gh pr merge --subject
    }
  }
}
```

---

## Co-Author Attribution

When committing via agentic sessions, append the appropriate co-author trailer:

### In OpenCode Sessions:
```bash
git commit -m "feat(sandbox): add commit format validation" \
  --trailer "Co-authored-by: opencode-agent[bot] <219766164+opencode-agent[bot]@users.noreply.github.com>"
```

### In Command Code Sessions:
```bash
git commit -m "feat(sandbox): add commit format validation" \
  --trailer "Co-authored-by: Command Code <noreply@commandcode.ai>"
```

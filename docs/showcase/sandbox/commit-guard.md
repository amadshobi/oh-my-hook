# Commit Guard & Co-Author Attribution

The `commitGuard` component enforces high-quality, standardized Git histories across human and AI-assisted commits while maintaining automated attribution trailers.

---

## Conventional Commits Enforcement

When the `bash` tool executes `git commit`, `sandbox/security.js` parses the commit message flag (`-m`) and validates it against strict rules:

### Validation Rules:
1. **Format**: Must follow `type(scope): description` or `type: description`.
2. **Allowed Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.
3. **Length Constraint**: Subject line must not exceed **72 characters**.
4. **No Trailing Period**: Subject lines must not end with `.`.
5. **Lowercase Description**: Description after the prefix must begin with a lowercase letter.
6. **No Emojis in Commit Message**: Keeps git logs machine-parsable and professional.

### Terminal Output:
```
#### GUARDRAIL BLOCK: Invalid Commit Format
> *Commit message issues:*
> * - Subject line is 84 chars (max 72)*
> * - Description should start with lowercase letter*
> *Use Conventional Commits: type(scope): description*
```

---

## Co-Author Attribution

When committing via agentic sessions, append the appropriate co-author trailer to give transparent attribution:

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

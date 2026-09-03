# Prompt Templates & Precedence Hierarchy

The planning suite loads structured Markdown instructions when invoking `/plan`, `/design`, and `/approve`. You can easily customize these instructions globally or per-project.

---

## 3-Level Override Hierarchy

When resolving a prompt template for a command (e.g. `plan.md`), `oh-my-hook` checks directories in the following order:

```
1. Project Workspace Override:
 <workspace>/.opencode/prompts/<command>.md
 ▲ (Highest priority - project-specific instructions)
 │
2. User Global Override:
 ~/.config/opencode/prompts/<command>.md
 ▲ (Medium priority - user-wide preferences)
 │
3. Built-in Core Defaults:
 oh-my-hook/plans/prompts/<command>.md
 (Fallback default)
```

---

## Dynamic Macro Interpolation

Custom Markdown templates support dynamic placeholders that are replaced at runtime:

| Macro | Description | Example Value |
| :--- | :--- | :--- |
| `{plan_name}` | Sanitized name of the target plan | `auth-service` |
| `{plan_file}` | Absolute path to the plan file | `/home/user/.opencode/plans/auth.md` |
| `{plan_content}` | Raw text content of the active plan | *Plan Markdown text* |
| `{topic}` | Optional topic argument supplied by user | `OAuth2 refresh token flow` |
| `{target_dir}` | Target storage directory for plans | `/home/user/.opencode/plans` |
| `{session_id}` | Active OpenCode session identifier | `ses_0195a...` |

---

## Example Custom Template

Create `<workspace>/.opencode/prompts/plan.md`:

```markdown
# Custom Planning Protocol for Project {plan_name}

You are acting as the Lead Architect for this repository.
Target Document: {plan_file}

Guidelines:
1. Always evaluate existing database models before proposing schema migrations.
2. Outline test fixtures and mocks in Section 4.
3. Keep code modifications strictly in Plan Mode until approved.
```

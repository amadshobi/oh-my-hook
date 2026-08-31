# Native Agent Memory Tool

The agent tool `memory` provides autonomous memory management directly within the model's tool execution loop.

---

## 🛠️ Tool Definition & Schema

```json
{
  "name": "memory",
  "description": "Manage persistent curated memory across sessions.",
  "parameters": {
    "type": "object",
    "required": ["action", "content", "old_text", "scope"],
    "properties": {
      "action": {
        "type": "string",
        "enum": ["add", "replace", "remove", "list"]
      },
      "content": {
        "type": "string",
        "description": "Memory bullet text (required for add and replace)."
      },
      "old_text": {
        "type": "string",
        "description": "Substring of existing entry to target (required for replace and remove)."
      },
      "scope": {
        "type": "string",
        "enum": ["project", "global"],
        "default": "project"
      }
    }
  }
}
```

---

## ⚡ Supported Actions

### 1. `add` (Save New Memory)
Appends a concise rule or architectural decision to the targeted Markdown file.
- **Safety**: Automatically scanned by `share/security.js`—attempts to save API keys, tokens, or private keys are immediately blocked.

### 2. `replace` (Update via Substring Match)
Replaces an existing bullet note identified by unique substring (`old_text`).
- Returns an actionable error if `0` matches or multiple ambiguous matches are found.

### 3. `remove` (Delete via Substring Match)
Deletes a bullet note matching `old_text` from the target scope.

### 4. `list` (Inspect Active Notes)
Returns formatted Markdown bullets currently loaded in global or project scope.

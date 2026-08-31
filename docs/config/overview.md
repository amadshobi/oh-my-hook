# Configuration Overview & Precedence

`oh-my-hook` is configured via dedicated files located in `~/.config/opencode/`, keeping your primary `opencode.jsonc` clean and focused.

---

## 📂 Multi-File Format Precedence

`share/config.js` searches for configuration files in the following order. The **first** file found is loaded:

```
1. ~/.config/opencode/omh.jsonc   (Recommended: JSON with comments)
2. ~/.config/opencode/omh.json    (Standard JSON)
3. ~/.config/opencode/omh.yaml    (YAML format)
4. ~/.config/opencode/omh.yml     (YML format)
```

If no configuration file is present, `oh-my-hook` initializes with production-ready built-in defaults.

---

## 🧩 Deep Merge Behavior

User settings are deep-merged on a per-section basis over built-in `DEFAULTS`. You only need to declare the specific properties you wish to customize.

```jsonc
// Minimal omh.jsonc example: customize only sandbox
{
  "sandbox": {
    "commitGuard": false
  }
}
```

---

## 📝 Custom Messages & External Templates

All guardrail block and warning messages can be customized in the `messages` configuration block.

### 1. Direct Message Overrides
```jsonc
{
  "messages": {
    "dangerousBash": {
      "title": "Restricted Command",
      "reason": "Execution of \"{command}\" is blocked by organizational policy.",
      "suggestion": "Request admin approval before proceeding."
    }
  }
}
```

### 2. External File Templates (`{file:...}`)
For large teams maintaining shared safety policies, you can reference external JSON or text files:

```jsonc
{
  "messages": {
    "secretDetected": "{file:~/.config/opencode/policies/secret-policy.json}"
  }
}
```

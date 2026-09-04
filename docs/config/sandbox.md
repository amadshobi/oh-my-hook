# Sandbox Configuration

Configuration options for pre-execution guardrails, payload security, protected file shields, and temporal integrity.

---

## ⚙️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "sandbox": {
    "enabled": true, // Master toggle for all sandbox guardrails

    // --- 1. Read-Before-Write & Temporal Integrity ---
    "readGuard": {
      "enabled": true, // Enable file inspection verification before mutations
      "readBeforeWrite": true, // Require reading files via read tool before edit/write
      "staleWrite": true, // Block edits if files on disk were modified out-of-band
      "interceptBashMutation": true // Intercept file mutations in bash (cat >, echo >, sed -i, tee)
    },

    // --- 2. Secret Scanner & Sensitive File Shield ---
    "secretScanner": {
      "enabled": true, // Scan tool payloads for API keys, private keys, and tokens
      "scanBash": true, // Scan bash commands for plain-text credentials (curl -H, export KEY=)
      "protectedFiles": {
        "enabled": true, // Block reading raw credential files via read tool or terminal
        // Blocked file patterns (supports **, *, ?, ~, and relative/absolute paths):
        "blacklist": [
          "**/.env*",         // All .env variants (.env, .env.local, .env.prod)
          "**/auth.json",     // OpenCode & provider auth credentials
          "**/settings.json", // Settings potentially holding tokens
          "**/*.pem",         // SSL / TLS / RSA private keys
          "**/*.key",         // Private key files
          "**/id_rsa*",       // SSH RSA private keys
          "**/id_ed25519*",   // SSH Ed25519 private keys
          "**/exports.sh",    // Environment export scripts
          "**/secrets.sh"     // Local credential scripts
        ],
        // Exceptions permitted for inspection (template schemas without real secrets):
        "whitelist": [
          "**/.env.example",  // Environment variable templates
          "**/.env.sample",   // Sample environment files
          "**/.env.template", // Template environment files
          "**/.env.dist"      // Distribution environment files
        ]
      }
    },

    // --- 3. Conventional Commit & Git Attribution Guard ---
    "commitGuard": {
      "enabled": true, // Validate commit message subject lines and format
      "maxChars": 72, // Configurable subject line length limit
      "requireCoAuthor": true, // Enforce Co-authored-by attribution trailer
      "blockNoVerify": true, // Block --no-verify and -n bypass flags
      "interceptGh": true // Validate PR merge subjects via gh pr merge --subject
    },

    // --- 4. Destructive Bash Command Barrier ---
    "dangerousBash": {
      "enabled": true, // Block destructive system commands
      "blockWipeHome": true, // Block rm -rf ~, $HOME
      "blockWipeGit": true, // Block rm -rf .git
      "blockWipeWorkspace": true, // Block rm -rf . or rm -rf * in root
      "blockGitDestructive": true // Block git reset --hard, git clean -fdx
    },

    // --- 5. Orphan Dev Server Guard ---
    "devServerGuard": {
      "enabled": true // Prevent long-running servers from locking the foreground subshell
    }
  }
}
```

---

## Default ON Behavior

All sandbox guards (`readGuard`, `secretScanner`, `commitGuard`, `dangerousBash`, `devServerGuard`) are enabled (`true`) by default. You **do not** need to include options with `true` values in your configuration.

Only declare options when disabling a guard or tweaking its parameters:

```jsonc
// Example: disable dangerousBash and customize commit message length
{
  "sandbox": {
    "dangerousBash": false,
    "commitGuard": {
      "maxChars": 80
    }
  }
}
```

---

## Backward Compatibility

Legacy flat configuration properties (`readBeforeWrite`, `staleWrite`, `secretScanner`, `commitGuard`, `devServerGuard`, `dangerousBash`) are automatically normalized into their modular counterparts via `normalizeSandboxConfig` without requiring configuration migration.

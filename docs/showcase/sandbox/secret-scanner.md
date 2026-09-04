# Secret Scanner & Protected Files Shield

The `secretScanner` module provides dual-layer protection:
1. **Payload Scanner**: Intercepts `write`, `edit`, `patch`, and `bash` commands containing raw API keys, private keys, or tokens.
2. **Protected Files Shield**: Blocks reading or inspecting sensitive files (`.env`, `auth.json`, `*.pem`, `id_rsa`) via native tools or terminal utilities, with configurable exceptions for template files.

---

## 🛡️ Protected Sensitive Files Shield

Prevents agents from reading or echoing credential stores to terminal output or session context:

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "sandbox": {
    "secretScanner": {
      "enabled": true,
      "scanBash": true, // Intercepts curl -H "Authorization: ..." or export KEY=...
      "protectedFiles": {
        "enabled": true,
        "blacklist": [
          "**/.env*",
          "**/auth.json",
          "**/settings.json",
          "**/*.pem",
          "**/*.key",
          "**/id_rsa*",
          "**/id_ed25519*",
          "**/exports.sh",
          "**/secrets.sh"
        ],
        "whitelist": [
          "**/.env.example",
          "**/.env.sample",
          "**/.env.template",
          "**/.env.dist"
        ]
      }
    }
  }
}
```

### Dual-Surface Interception:
- **Native Tools**: Calling `read({ filePath: ".env" })` is blocked immediately.
- **Terminal Utilities**: Intercepts `cat .env`, `head auth.json`, `tail`, `grep`, `source`, and redirection `< .env`.
- **Whitelisted Templates**: Allows inspecting `.env.example` so the agent can discover environment variable names without accessing real values.

```
🛑 BLOCKED: Protected sensitive file
Reason: Direct access to ".env" is blocked by security policy.
Action: Inspect .env.example or ask user for non-secret schema.
```

---

## Supported Secret Signatures

Tool inputs and bash command payloads are scanned against high-precision regular expression signatures:

| Secret Category | Pattern Signature / Prefix | Example Pattern Form |
| :--- | :--- | :--- |
| **GitHub Tokens** | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_` | `ghp_[a-zA-Z0-9]{36}` |
| **OpenAI API Keys** | `sk-[a-zA-Z0-9_-]{20,}` | `sk-proj-[a-zA-Z0-9_-]+` |
| **Anthropic Keys** | `sk-ant-[a-zA-Z0-9_-]{20,}` | `sk-ant-api03-[a-zA-Z0-9_-]+` |
| **Google AI Keys** | `AIza[0-9A-Za-z-_]{35}` | `AIzaSy[0-9A-Za-z-_]+` |
| **AWS Access Key ID** | `AKIA[0-9A-Z]{16}`, `ASIA[0-9A-Z]{16}` | `AKIA[0-9A-Z]{16}` |
| **AWS Secret Key** | `(?i)aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}` | `aws_secret_access_key = ...` |
| **Private Keys** | `-----BEGIN (RSA\|OPENSSH\|EC\|DSA\|PRIVATE) KEY-----` | Full PEM / PKCS#8 Key Blocks |
| **Database Protocols** | PostgreSQL, MongoDB, MySQL connection string URIs | `protocol://user:pass@host/db` |
| **JSON Web Tokens** | `eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}` | Standard 3-part signed JWTs |

---

## Authoritative Terminal Block Output

When a secret signature is detected in a payload or command:

```
🛑 BLOCKED: Secret detected in payload
Reason: Payload contains sensitive credentials:
  - Line 42: Anthropic API Key
Action: Remove credentials immediately. Use environment variables.
```

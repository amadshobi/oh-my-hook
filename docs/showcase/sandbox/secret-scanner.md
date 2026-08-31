# Secret Scanner

The `secretScanner` guardrail intercepts tool arguments across `write`, `edit`, and `patch` operations to prevent hardcoded credentials from being written to disk or committed to source control.

---

## 🔍 Supported Secret Signatures

`sandbox/security.js` scans tool inputs against high-precision regular expression signatures covering major cloud providers, identity providers, and cryptographic keys:

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

## 🚫 Terminal Block Output

When a secret signature is detected in a tool payload, execution is halted immediately:

```
#### 🚫 GUARDRAIL BLOCK: Secret Detected
> *Payload contains sensitive credentials:*
> *  - Line 42: Anthropic API Key*
> *Use environment variables or .env files instead.*
```

---

## 🔒 Custom Message Configuration

You can override the rejection message or route it through an external template file in `omh.jsonc`:

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "messages": {
    "secretDetected": {
      "title": "Credential Leak Blocked",
      "reason": "Hardcoded token detected in payload:\n{detail}",
      "suggestion": "Store secrets securely in environment variables or a .env file."
    }
  }
}
```

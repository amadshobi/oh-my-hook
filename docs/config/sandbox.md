# Sandbox Configuration

Configuration options for pre-execution guardrails and security checks.

---

## ️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
 "sandbox": {
 // Enforces that files must be read before edit/write
 "readBeforeWrite": true,

 // Prevents overwriting files modified out-of-band on disk
 "staleWrite": true,

 // Blocks API keys, JWTs, and private keys in tool arguments
 "secretScanner": true,

 // Enforces Conventional Commits and max line lengths
 "commitGuard": true,

 // Prevents running orphan foreground dev servers
 "devServerGuard": true,

 // Blocks destructive terminal patterns (rm -rf /, fork bombs)
 "dangerousBash": true
 }
}
```

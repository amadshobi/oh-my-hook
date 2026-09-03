# Imgsee Configuration

Configuration options for multimodal visual analysis and vision gateway endpoints.

---

## ️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
 "imgsee": {
 "enabled": true,

 // Local vision proxy completions endpoint
 "gatewayUrl": "http://127.0.0.1:4010/v1/chat/completions",

 // Model targeted for vision inspection
 "model": "google-antigravity/gemini-2.5-flash",

 // Maximum image payload size (default: 5 MiB)
 "maxBytes": 5242880,

 // Request timeout in milliseconds
 "timeoutMs": 60000
 }
}
```

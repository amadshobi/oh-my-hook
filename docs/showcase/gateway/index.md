# Local Gateway Bridge

The `gateway/` module connects OpenCode to local AI routing daemons (`gn gw` on `:4010` or `:4000`), enriching models with live catalog metadata and shielding against Google Cloud Code Assist (CCA) schema rejections.

---

## 🔌 Core Capabilities

### 1. Zero-Config Interactive Auth
Automatically bridges OpenCode's authentication layer with local daemons. Run `opencode auth -p local-gateway` to connect instantly.

### 2. OMP Catalog Metadata Enrichment
Enriches discovered models with exact pricing rates (`cost`), context token limits, and thinking tiers (`variants`) directly from the Oh-My-Pi catalog (`models.json`).

### 3. Google Antigravity CCA Schema Sanitization
Google Cloud Code Assist endpoints strictly reject OpenAI tool schemas containing modern OpenAPI keywords. `gateway/antigravity.js` recursively sanitizes tool definitions in-flight, stripping:
- `$schema`
- `title`
- `additionalProperties`
- `$defs` / internal references

This eliminates HTTP 400 Malformed Argument rejections during agent tool calls.

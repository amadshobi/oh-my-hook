# Multimodal Vision Engine (`imgsee`)

The `imgsee/` module provides out-of-band visual inspection, allowing text-only and hybrid agent pipelines to analyze screenshots, UI mockups, error popups, and architecture diagrams without context poisoning.

---

## 👁️ Why `imgsee`?

1. **Zero Context Poisoning**: Large binary image payloads are never stuffed into primary conversational contexts. Image analysis runs out-of-band against a local vision model (`gemini-2.5-flash` / `gemini-3.7-flash` on `:4010` / `:4000`), returning structured Markdown back to the session.
2. **Magic Bytes Format Sniffing**: Header sniffing supports PNG, JPEG, GIF, and WEBP formats with a 20 MiB safety cap.
3. **Evidence-First OCR & Layout Analysis**: Specialized vision system directives extract verbatim text coordinates, alignment faults, and runtime error messages.

---

## 🛠️ Dual Invocation Modes

### 1. Autonomous Agent Tool (`imgsee`)
The model invokes the tool when evaluating UI layouts or error screenshots:

```json
{
  "path": "screenshot.png",
  "question": "What is the exact error shown in the red modal?",
  "mode": "debug"
}
```

### 2. Deterministic Slash Command (`/imgsee`)
Users can trigger vision analysis directly from the terminal prompt:

```text
/imgsee path/to/error.png "Extract all error stack trace lines verbatim"
```

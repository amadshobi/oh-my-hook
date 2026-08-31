# Boundary Contracts & Adapter Isolation

To maintain long-term architectural stability and zero-dependency purity, `oh-my-hook` strictly isolates domain logic from host framework adapters.

---

## 🏛️ The Three Architectural Laws

The codebase is governed by three strict structural rules, continuously verified in CI by `tests/boundary.test.js`:

```
                       ┌──────────────────────────────┐
                       │     Root Adapter Layer       │
                       │          (index.js)          │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │    Domain Logic Modules      │
                       │   (sandbox/, plans/, etc.)   │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │     Shared Helper Layer      │
                       │           (share/)           │
                       └──────────────────────────────┘
```

### 1. Pure Logic Modules
Modules (`sandbox/`, `plans/`, `memory/`, `compress/`, `prompts/`, `reminder/`, `gateway/`, `imgsee/`, `usage/`) must contain only pure domain logic.
- Modules may import **only** `node:` built-ins, their own sub-files, or files from the `share/` directory.
- Modules **must never** import directly from another feature module directory (e.g. `sandbox/` importing from `plans/` is strictly forbidden).

### 2. `share/` is the Sole Shared Layer
Cross-cutting utilities (path resolution, notification wrappers, error formatters, hook input normalizers, and state ledgers) reside exclusively in `share/`:
- `share/hook.js`: Input shape normalizers (`toolArgs`, `bashCommand`, `filePathOf`).
- `share/messages.js`: Centralized message dictionary and template interpolation.
- `share/block.js`: Standardized block and warning message formatting.
- `share/state.js`: Read-ledger and session mode-state persistence.
- `share/merge.js`: Deep hook merging engine.
- `share/handled.js`: Zero-token transcript completion helper (`createHandledError`).

### 3. Root `index.js` as the Single Hook Assembler
The root `index.js` acts as the sole adapter layer connecting OpenCode to the internal domain modules. It instantiates each module factory in parallel and composes them into a unified hook set via `mergeHooks`.

---

## 🧩 Hook Composition with `mergeHooks`

OpenCode plugins export a single hooks object. When multiple modules define the same lifecycle hook (such as `tool.execute.before` or `config`), `mergeHooks` resolves collisions deterministically:

- **Function Hooks**: Chained sequentially in order of registration. If any hook throws a block error, subsequent hooks are not executed, and the violation is reported immediately.
- **Object Maps**: Merged recursively by key (e.g., merging multiple `tool.*` definitions or `command.*` registrations).

```javascript
// share/merge.js composition logic
export function mergeHooks(...hookObjects) {
  const result = {};
  for (const hooks of hookObjects) {
    if (!hooks) continue;
    for (const [key, value] of Object.entries(hooks)) {
      if (typeof value === "function") {
        const prev = result[key];
        result[key] = prev
          ? async (...args) => {
              await prev(...args);
              return await value(...args);
            }
          : value;
      } else if (typeof value === "object" && value !== null) {
        result[key] = { ...(result[key] || {}), ...value };
      }
    }
  }
  return result;
}
```

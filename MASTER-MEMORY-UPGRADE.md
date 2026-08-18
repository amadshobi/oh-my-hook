# MASTER IMPLEMENTATION PLAN
## Self-Learning & Dynamic Smart Injection Memory (Reflexio-style) for `oh-my-hook`

> Target: upgrade `memory/` dari **curated flat markdown** menjadi **categorized
> structured store dengan self-learning loop** (auto-correction detection,
> background distill, rule merging) dan **dynamic relevance injection** (pure-JS
> BM25, zero heavy deps) — setara arsitektur `claude-smart` / Reflexio engine.

---

## 1. Ringkasan & Gap Analysis

| Aspek | Saat Ini | Target (Level Reflexio) |
|---|---|---|
| Storage | Flat `MEMORY.md` (global + per-project) | Kategori terstruktur: `preference`, `project_skill`, `shared_skill` (JSONL records dengan triggers & rationale) |
| Injection | **Selalu** inject SEMUA memory (noise saat memory besar) | **Relevance-matched**: hanya rule yang relevan dengan konteks turn yang di-inject |
| Learning | Manual (`/remember`, `/capture`) | Otomatis: correction detector → distill → merge/dedup → confidence scoring |
| Retrieval | Tidak ada (read-all) | BM25 token scoring, pure JS, no deps |
| Feedback loop | Tidak ada | Hits / corrections counters → confidence → promote/supersede rules |
| Slash commands | `/remember` `/memory` `/capture` | + `/memory-rules` `/memory-scan` `/memory-forget` `/memory-stats` |
| Backward compat | — | Legacy `MEMORY.md` tetap dibaca/ditulis, API `store.js` tidak berubah |

**Prinsip desain (non-negotiables):**
1. Zero heavy dependencies — hanya `node:fs`, `node:path`, `node:child_process` (pattern repo).
2. Memory tetap **curated** — tidak pernah auto-log transcript mentah; yang masuk store hanya rule hasil distill/klasifikasi.
3. Semua operasi baru **fail-safe**: kalau structured store error → fallback ke legacy path, hook tidak pernah crash.
4. Compat penuh: test lama (`tests/memory.test.js`) harus tetap hijau tanpa perubahan asersi.

---

## 2. Arsitektur Target — ASCII Data Flow

### 2.1 Runtime injection flow (setiap turn)

```
 ┌──────────────────────────── OpenCode Agent Loop ────────────────────────────┐
 │                                                                             │
 │  user message ──► "chat.message" hook                                       │
 │        │                                                                     │
 │        ├──► memory/ctx.js : cache per-session                               │
 │        │      { lastUserMessage, recentTools, recentFiles, ts }             │
 │        │                                                                     │
 │        └──► memory/detect.js : heuristic scan (regex, cheap)                │
 │               ├─ correction signal? ──► queue distill job                   │
 │               └─ success signal?     ──► boost confidence (later flush)     │
 │                                                                             │
 │  "experimental.chat.system.transform" hook                                  │
 │        │                                                                     │
 │        ├─ 1. ctx.js  : build QUERY (user msg + tools + files)               │
 │        ├─ 2. rstore.js: load rules (global prefs, global shared,            │
 │        │                project skills) ──► matcher.js (BM25)               │
 │        ├─ 3. inject.js: rank + budget (topK/minScore) ──► sections          │
 │        │      ## PREFERENCES (relevant)                                     │
 │        │      ## PROJECT SKILLS (relevant)                                  │
 │        │      ## SHARED SKILLS (relevant)                                   │
 │        ├─ 4. legacy  : MEMORY.md (global+project) — compat, selalu ada      │
 │        └─ 5. output.system.push(sections)                                   │
 │                                                                             │
 │  "experimental.session.compacting" hook ──► same injector (no budget cap)   │
 └─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Self-learning loop (async, off critical path)

```
 ┌─────────────── signal sources ───────────────┐
 │ chat.message (user role)                     │
 │ session.idle / session.deleted (event hook)  │
 └──────────────────┬───────────────────────────┘
                    ▼
        ┌─────────────────────────┐
        │  memory/detect.js       │  heuristic regex (ID+EN), cheap, sync-ish
        │  confidence >= 0.6 ?    │
        └───────────┬─────────────┘
                    ▼
        ┌─────────────────────────┐
        │  memory/distill.js      │  queue.jsonl (file-based, idempotent)
        │  - job: {id, kind,      │  cooldown + maxQueue throttling
        │    sessionID, context}  │
        └───────────┬─────────────┘
                    ▼
        ┌─────────────────────────┐
        │  AI distill (ephemeral) │  memory/ai/*.js (cmd -p --no-session)
        │  prompt → JSON rules    │  REUSED — no new adapter needed
        └───────────┬─────────────┘
                    ▼
        ┌─────────────────────────┐
        │  schema.js validate     │  normalize, kategori, trigger extraction
        └───────────┬─────────────┘
                    ▼
        ┌─────────────────────────┐
        │  rstore.js merge        │  Jaccard dedup / contradiction supersede
        │  rules/*.jsonl          │  bump counters, recompute confidence
        └───────────┬─────────────┘
                    ▼
        ┌─────────────────────────┐
        │  flush meta.json        │  hits/corrections counters, migration flags
        └─────────────────────────┘
```

### 2.3 Storage layout

```
~/.config/opencode/memory/
├── MEMORY.md                          # legacy global (compat, read + mirror-write)
├── projects/<slug>/MEMORY.md          # legacy per-project (compat)
├── rules/                             # NEW structured store (JSONL)
│   ├── meta.json                      # version, migration flags, throttle clock
│   ├── queue.jsonl                    # pending distill jobs
│   ├── global/
│   │   ├── preferences.jsonl          # category: preference  (scope: global)
│   │   └── skills.jsonl               # category: shared_skill (scope: global)
│   └── projects/<slug>/
│       └── skills.jsonl               # category: project_skill (scope: project)
```

---

## 3. JSON Schema — Rule Record

Satu record = satu baris JSONL. Semua timestamp dalam **epoch millis** (konsisten dengan `state.js`).

```jsonc
{
  "id": "prf_3f2a9c1b",                 // <prefix>_<fnv1a-hex8> ; prefix: prf|psk|ssk
  "scope": "global",                    // "global" | "project"
  "category": "preference",             // "preference" | "project_skill" | "shared_skill"
  "content": "Gunakan kebab-case untuk nama file proyek ini",
  "triggers": ["penamaan", "file", "kebab-case", "naming"],
  "rationale": "User mengoreksi penggunaan camelCase pada 2026-08-17",
  "source": "correction",               // "remember"|"capture"|"correction"|"distill"|"migrated"
  "project": "home/shobixlinuxdev/projects/foo",  // slug; hanya saat scope=project
  "createdAt": 1755388800000,
  "updatedAt": 1755388800000,
  "hits": 0,                            // matched & injected count
  "corrections": 0,                     // dikoreksi user count
  "confidence": 0.5,                    // 0..1, see §7.3
  "status": "active",                   // "active" | "superseded" | "retracted"
  "supersededBy": null,                 // rule id, saat digantikan rule baru
  "mergedFrom": []                      // rule ids yang dilebur ke rule ini
}
```

### 3.1 Constraint & validation (`memory/schema.js`)

| Field | Rule |
|---|---|
| `content` | wajib, non-empty string, ≤ 400 chars, di-trim |
| `category` | enum wajib; fallback `shared_skill` |
| `triggers` | array string (≤ 10), otomatis dari top token content bila kosong |
| `scope` | wajib; `project` mengharuskan `project` slug |
| `id` | generated `fnv1a` 32-bit hex dari `${category}:${content}:${project}` (deterministic → idempotent re-distill) |
| `confidence` | clamp 0–1 |
| `status` | enum; rule `superseded`/`retracted` tidak ikut matcher |

---

## 4. Module-by-Module Spec

### 4.1 `memory/schema.js` (NEW) — schema & util

```js
export const CATEGORIES = ["preference", "project_skill", "shared_skill"];
export const CATEGORY_PREFIX = { preference: "prf", project_skill: "psk", shared_skill: "ssk" };

export function fnv1a(str);                 // 32-bit FNV-1a → 8-hex string
export function newRuleId(rule);            // deterministic id (lihat §3.1)
export function normalizeRule(raw, opts);   // trim/validate/defaults → valid record
export function extractTriggers(content);   // top-4 non-stopword tokens
export function classifyCategory(text);     // heuristic: "jangan|prefer|selalu|gunakan" → preference, else shared_skill
export function isValidRule(rule);          // boolean guard
```

### 4.2 `memory/rstore.js` (NEW) — structured JSONL store

```js
export const RULES_ROOT;                    // ~/.config/opencode/memory/rules
export function rulesFile(scope, category, projectSlug);   // absolute .jsonl path
export function listRules({ scope, category, projectSlug, activeOnly = true }); // parse JSONL
export function appendRule(rule);           // atomic append (appendFileSync + "\n")
export function updateRule(id, patch);      // find → merge → rewrite file (atomic tmp+rename)
export function removeRule(id);             // mark retracted (soft delete — audit trail)
export function rewriteCategory(file, rules); // full rewrite (dedup/merge path)
export function loadMeta();  saveMeta(patch);  // meta.json
export function bumpHits(ids);              // throttled (60s cooldown in meta.json) counter flush
export function enqueueJob(job); dequeueJobs(limit); markJobDone(id); // queue.jsonl
```

**Atomicity rule:** all writes go through `tmp` file + `renameSync` — same pattern as repo's plans archive; JSONL append is `appendFileSync` (single-line write is atomic enough on Linux/macOS).

### 4.3 `memory/matcher.js` (NEW) — pure-JS BM25

```js
export function tokenize(text);             // lowercase, split \W+, drop stopwords, len>=2
export function buildIndex(ruleDocs);       // { term → { docId → tf }, docLen[], avgdl }
export function scoreAll(query, rules, index, opts);  // → [{ rule, score }] sorted desc
export function bm25Score(queryTokens, docTokens, index, opts);
export function buildQuery(ctx, opts);      // weighted query: user 1.0, tool/file 0.5 (repeat tokens)
```

Full algorithm & formulas in **§6**.

### 4.4 `memory/ctx.js` (NEW) — per-session context cache

```js
const sessions = new Map();                 // sessionID → { lastUserMessage, tools[], files[], ts }
export function recordMessage(input);       // called from "chat.message"
export function getQuery(sessionID, fallback);  // build query string for matcher
export function prune(maxAgeMs = 6h);
```

> **Integration point:** `chat.message` input shape di OpenCode menyediakan
> `sessionID` + `message.parts[]`. `extractTextParts()` dibuat defensive:
> baca `input.message?.parts` → ambil `type === "text"` dari role user;
> fallback `input.userMessage` / `input.text`. Jika semua kosong → matcher
> pakai **recency fallback** (top rules by `updatedAt`), bukan inject-all.
> **Verifikasi saat Phase 4** dengan log debug sekali terhadap hook asli.

### 4.5 `memory/detect.js` (NEW) — correction & success heuristics

```js
export const CORRECTION_PATTERNS;           // [{ re, confidence, label }]
export const SUCCESS_PATTERNS;              // [{ re, confidence }]
export function analyzeUserMessage(text);   // → { kind: "correction"|"success"|null, confidence, excerpt }
export function shouldQueue(signal, cfg);   // confidence >= cfg.detector.minConfidence
export function extractTarget(signal);      // "jangan pakai X" → { verb, subject } untuk trigger hints
```

Full patterns in **§7.1**.

### 4.6 `memory/distill.js` (NEW) — background distill + merging

```js
export function queueDistill({ sessionID, context, kind, reason });
export async function processQueue(cfg, notify);   // drain jobs → AI → validate → merge
export function buildDistillPrompt(context, reason); // strict JSON-only output contract
export function parseRulesJSON(text);              // extract first [ ... ] block, JSON.parse, normalize
export function mergeRule(existing, incoming);     // Jaccard dedup / supersede — see §8
export function jaccard(a, b);                     // token-set similarity
```

Reuses `capture()` from `memory/ai/index.js` — **no new adapter, no new binary**.

### 4.7 `memory/inject.js` (NEW) — dynamic injection builder

```js
export function selectRules(rules, query, cfg);    // BM25 → budget → categories
export function formatSections(selected);          // markdown per kategori
export function buildLegacyBlock(directory);       // readAllMemory (compat)
export async function injectMemory({ directory, query, cfg, capBudget = true });
// → { text, hitIds } ; hitIds flushed via rstore.bumpHits
```

Budget logic (§9): `topK=8`, `minScore=0.5`, jatah kategori
`preferences:2 / project:3 / shared:3`, `boostProject=1.3`, `boostPrefs=1.2`.
Empty-match → recency fallback top-3 (configurable).

### 4.8 `memory/migrate.js` (NEW) — one-time legacy migration

```js
export function migrateIfNeeded();          // meta.json flags; idempotent
export function migrateFile(mdFile, scope, projectSlug); // bullets → shared_skill/project_skill, source:"migrated"
```

- Legacy `MEMORY.md` **tidak dihapus / tidak diubah** (read-only source).
- Flag per-scope di `meta.json.migrated` → tidak pernah double-migrate.
- Trigger otomatis di `memoryHooks` factory init (cheap, sync, <50ms).

---

## 5. Backward Compatibility Strategy

| Permukaan | Jaminan |
|---|---|
| `store.js` exports | `projectSlug`, `projectMemoryFile`, `GLOBAL_FILE`, `readMemory`, `readAllMemory`, `appendMemory`, `parseBullets` — **signature & behavior identik** |
| `/remember` | Default: tulis legacy `MEMORY.md` (sama persis) + mirror ke structured store (`source:"remember"`) jika `memory.store !== "legacy"` |
| `/memory` | Output lama + ringkasan rules terbaru (count per kategori) |
| `/capture` | Tidak berubah; hasil distill sekarang masuk **kedua** store (legacy mirror + structured) |
| Config lama | Semua key baru punya default aman; `omh.jsonc` lama valid tanpa edit |
| Error path | Setiap akses structured store dibungkus try/catch → fallback legacy injection, `notify(..., "warn")` |
| `experimental.session.compacting` | Sama seperti sebelumnya tapi lewat injector tanpa budget cap (compact harus membawa SEMUA memory — jangan hilangkan konteks) |

---

## 6. Algoritma BM25 Matcher (pure JS)

### 6.1 Tokenization

```
tokenize(text):
  lowercase(text)
  split /\W+/            // non-word boundaries
  drop len < 2
  drop stopwords (ID + EN inline set, ~120 kata: "yang","dan","ini","itu","the","a","use","pakai","untuk","dengan"...)
  return tokens
```

> Stopwords dipilih konservatif — hanya kata fungsi, bukan kata domain.
> Kata seperti "file", "npm", "api", "jangan" **tetap dipertahankan**
> karena itu sinyal retrieval yang kuat.

### 6.2 Index & scoring

```
N     = jumlah rule aktif (per query scope)
df(t) = jumlah dokumen yang mengandung term t
avgdl = rata-rata panjang dokumen (tokens)
dl(D) = panjang dokumen D
f(t,D)= term frequency t dalam D
k1 = 1.5, b = 0.75  (konstanta standar BM25)

IDF(t)  = ln( (N − df(t) + 0.5) / (df(t) + 0.5) + 1 )

score(D,Q) = Σ over t ∈ (Q ∩ D):
             IDF(t) × [ f(t,D) × (k1 + 1) ] / [ f(t,D) + k1 × (1 − b + b × dl(D)/avgdl) ]
```

```js
// memory/matcher.js — reference implementation (runnable shape)
const STOPWORDS = new Set(["yang","dan","ini","itu","dari","dengan","untuk","pada","the","and","for","with","use","pakai","jangan","aja","saja","kalo","kalau","atau","di","ke","a","an","is","are","of","to","in","on","that","this","it","as","by","not","or"]);

export function tokenize(text = "") {
  return String(text).toLowerCase().split(/\W+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function buildIndex(docs) {
  const docTokens = docs.map((d) => tokenize(`${d.content} ${(d.triggers ?? []).join(" ")}`));
  const index = new Map();
  docTokens.forEach((tokens, docId) => {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, f] of tf) {
      if (!index.has(t)) index.set(t, new Map());
      index.get(t).set(docId, f);
    }
  });
  const avgdl = docTokens.reduce((s, t) => s + t.length, 0) / Math.max(1, docs.length);
  return { index, docTokens, avgdl };
}

export function scoreAll(query, docs, opts = {}) {
  const { index, docTokens, avgdl } = buildIndex(docs);
  const N = docs.length;
  const qTokens = tokenize(query);
  const scores = docs.map((doc, docId) => {
    const dl = docTokens[docId].length;
    if (!dl) return { doc, score: 0 };
    let score = 0;
    for (const t of qTokens) {
      const postings = index.get(t);
      if (!postings) continue;
      const f = postings.get(docId);
      if (!f) continue;
      const df = postings.size;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      score += idf * (f * (opts.k1 ?? 1.5 + 1)) /
               (f + (opts.k1 ?? 1.5) * (1 - (opts.b ?? 0.75) + (opts.b ?? 0.75) * dl / avgdl));
    }
    return { doc, score };
  });
  return scores.sort((a, b) => b.score - a.score);
}
```

> **Catatan koreksi:** ekspresi `opts.k1 ?? 1.5 + 1` di atas adalah pseudocode
> padat — implementasi final pakai konstanta lokal `const k1 = 1.5` agar
> preseden operator tidak ambigu (ditangkap di review Phase 2).

### 6.3 Query building & boosts

```
buildQuery(ctx, cfg):
  tokens = userMessage × weight 1.0 (diulang 1x)
         + tool names  × weight 0.5 (diulang 1x, di-tokenize)
         + file names  × weight 0.5 (di-tokenize path)
  return string

applyBoosts(score, rule, cfg):
  if rule.scope === "project"   → score × 1.3
  if rule.category === "preference" → score × 1.2
  if rule.confidence > 0.7      → score × 1.1
```

### 6.4 Threshold & budget

```
minScore = 0.5        // below this = noise, jangan inject
topK     = 8          // max rules total per turn
jatah    = { preference: 2, project_skill: 3, shared_skill: 3 } // round-robin fill by score
fallback = top-3 by updatedAt jika zero match (recency mode)
```

---

## 7. Correction & Success Detection (Heuristic)

### 7.1 Pattern table (regex, case-insensitive, user-role only, length ≤ 120 chars)

| Signal | Pattern (contoh) | Confidence |
|---|---|---|
| Larangan eksplisit ID | `/\b(jangan|jgn|gak usah|nggak usah|stop|hindari|skip|drop)\s+(pakai|pake|gunakan|tulis|buat|deploy|install|jalankan|run|make|use)\s+[^,.;!?\n]{2,60}/` | 0.85 |
| Larangan eksplisit EN | `/\b(don'?t|never|stop|avoid|no need to)\s+(use|run|write|install|deploy|call|put)\s+[^,.;!?\n]{2,60}/` | 0.85 |
| Koreksi langsung | `/\b(bukan|bkn|salah|keliru|yang benar|harusnya|seharusnya|mestinya)\b[^.!?\n]{0,80}/` | 0.70 |
| Koreksi EN | `/\b(that'?s wrong|not like that|wrong|incorrect|actually|instead|it should be)\b[^.!?\n]{0,80}/` | 0.70 |
| Preferensi gaya | `/\b(pakai|pake|gunakan|tulis|buat|jadikan|selalu|always)\s+(saja|aja|langsung|every time|mulai sekarang)\b/` | 0.60 |
| Sukses / konfirmasi | `/\b(bagus|mantap|sip|oke sip|nice|good|great|perfect|exactly|bener|betul|terima kasih|makasih|thanks|good job|well done|pas banget)\b/` | 0.55 |

**Rules tambahan:**
- Hanya pesan **role user** (`input.agent` / `message.info.role` check).
- Abaikan pesan > 120 char (panjang = diskusi, bukan koreksi tajam).
- Abaikan kalau message mengandung `http`/URL (bisa kutipan eksternal).
- Anti-spam: max 1 correction signal per session per 5 menit.

### 7.2 Flow

```
chat.message (user) ─► analyzeUserMessage ─► confidence >= 0.6 ?
                                              ├─ correction → enqueueJob({kind:"distill", reason:"correction", context: last 6 messages})
                                              └─ success     → rstore.bumpConfidence(matched rule ids) [flush throttled]
```

### 7.3 Confidence model

```
new rule (correction)          : 0.60
new rule (remember/capture)    : 0.50
hit (matched + injected)       : +0.02 per hit, cap 0.95
correction (rule dikoreksi)    : × 0.6
success confirmation           : +0.05
superseded / retracted         : keluar dari aktif set
```

---

## 8. Distill & Rule Merging/Dedup Algorithm

### 8.1 Distill prompt (strict contract)

```
Kamu adalah memory curator untuk coding agent.
Berikut percakapan yang memuat koreksi/feedback user (atau session baru selesai):

<TRANSCRIPT max 8000 chars>

Ekstrak 1-3 aturan memory yang layak disimpan permanen.
Output HANYA JSON array, tanpa teks lain:
[{"category":"preference|project_skill|shared_skill",
  "content":"kalimat imperatif singkat",
  "triggers":["kata kunci 1","kata kunci 2"],
  "rationale":"kenapa aturan ini ada"}]
```

`parseRulesJSON`: cari `[` pertama & `]` terakhir → `JSON.parse` → filter
`isValidRule` → `normalizeRule` (fallback category heuristic bila AI salah).

### 8.2 Merge pipeline (deterministic)

```
incoming rule (I), candidates C = active rules di file kategori+scope yang sama:

1. normalize: tokenize(content) → set
2. similarity(I, C_i) = |I ∩ C_i| / |I ∪ C_i|      (Jaccard)

3. jika sim >= dedupThreshold (default 0.8):
     a. merge:  content      = content terbaru (updatedAt lebih besar)
                triggers     = union (max 10)
                hits        += C_i.hits
                confidence   = min(1, max(conf) + 0.05)
                mergedFrom  += C_i.id
                C_i.status   = "superseded" ; supersededBy = I.id
     b. conflict (salah satu mengandung negasi "jangan|don't|never" dan yang lain tidak):
        C_i.status = "superseded" (rule lama pensiun), I menjadi rule baru aktif

4. jika 0.4 <= sim < 0.8 → update triggers I dengan token bersama (enrichment)
5. jika sim < 0.4 → append rule baru
```

### 8.3 Queue processing (throttled, never blocks hooks)

```
processQueue(cfg, notify):
  jobs = dequeueJobs(limit=3)
  for job:
    transcript = getSessionTranscript(job.sessionID)   // reuse dari index.js
    rules = distill via adapter (timeout 120s, ephemeral)
    untuk tiap rule → merge ke rstore
    markJobDone(job.id)

triggers:
  - event "session.idle"/"session.deleted" (jika cfg.distill.auto)
  - /memory-scan <sessionID> (manual)
  - guard: cooldownMs=30m antar auto-run; maxQueue=20 (drop tertua)
  - jalankan di setImmediate / tidak di-await di path hook kritis bila memungkinkan
```

---

## 9. Dynamic Injection Builder (`memory/inject.js`)

```
injectMemory({ directory, query, cfg }):
  projectSlug = projectSlug(directory)

  candidates =
    listRules(preference, global)          // ~/.config/.../global/preferences.jsonl
    listRules(shared_skill, global)        // global/skills.jsonl
    listRules(project_skill, projectSlug)  // projects/<slug>/skills.jsonl

  scored = scoreAll(query, candidates) → boosts → filter minScore

  selected = budget-fill per kategori (round robin by score, topK=8)

  sections =
    ## PREFERENCES   (n rules, one bullet each + rationale inline italic)
    ## PROJECT SKILLS
    ## SHARED SKILLS
    ## MEMORY        (legacy readAllMemory — compat, selalu disertakan)

  return { text, hitIds: selected.map(r => r.id) }
```

**Compaction:** injector dipanggil dengan `capBudget=false` → semua rule aktif +
legacy ikut (compaction harus lossless terhadap memory).

---

## 10. Config Extension (`share/config.js` DEFAULTS.memory)

```jsonc
"memory": {
  "enabled": true,
  "store": "hybrid",                 // "legacy" | "structured" | "hybrid" (default)
  "captureAdapter": "commandcode",
  "captureModels": { /* existing */ },
  "maxBullets": 10,
  "injectToSubagents": false,
  "captureAuto": false,              // existing, tetap dihormati

  "matcher": {
    "enabled": true,
    "topK": 8,
    "minScore": 0.5,
    "boostProject": 1.3,
    "boostPrefs": 1.2,
    "recencyFallback": true
  },
  "detector": {
    "correction": true,
    "success": true,
    "minConfidence": 0.6,
    "cooldownMs": 300000
  },
  "distill": {
    "auto": false,                   // drain queue otomatis di session.idle
    "maxQueue": 20,
    "dedupThreshold": 0.8,
    "cooldownMs": 1800000
  },
  "legacyMirror": true               // /remember & /capture tetap tulis MEMORY.md
}
```

---

## 11. File-by-File Action Plan

| # | File | Aksi | Isi | Estimasi |
|---|---|---|---|---|
| 1 | `memory/schema.js` | **NEW** | §4.1 — constants, fnv1a, normalize/validate, trigger extraction, category heuristic | ~150 ln |
| 2 | `memory/rstore.js` | **NEW** | §4.2 — JSONL store, meta, queue, atomic writes, throttled counters | ~230 ln |
| 3 | `memory/matcher.js` | **NEW** | §6 — tokenizer, stopwords, BM25 index+score, boosts | ~180 ln |
| 4 | `memory/ctx.js` | **NEW** | §4.4 — per-session query cache (Map + prune) | ~70 ln |
| 5 | `memory/detect.js` | **NEW** | §7.1 — pattern tables, analyzeUserMessage, anti-spam | ~160 ln |
| 6 | `memory/distill.js` | **NEW** | §8 — queue, prompt builder, JSON parse, merge pipeline | ~210 ln |
| 7 | `memory/inject.js` | **NEW** | §9 — selection, budget, section formatting, legacy block | ~130 ln |
| 8 | `memory/migrate.js` | **NEW** | §4.8 — idempotent legacy→rules migration | ~80 ln |
| 9 | `memory/store.js` | **MODIFY** | + `RULES_ROOT`, `rulesFile`, `rulesDir` path helpers; ekspor lama **tidak disentuh** | +15 ln |
| 10 | `memory/index.js` | **MODIFY** | wire: `chat.message`→ctx+detect; `system.transform`→inject; `compacting`→inject uncapped; `command.execute.before` + 4 command baru; `event`→processQueue; `/remember` mirror structured | +120 ln |
| 11 | `share/config.js` | **MODIFY** | extend `DEFAULTS.memory` §10 | +30 ln |
| 12 | `AGENTS.md` | **MODIFY** | update arsitektur memory section | +20 ln |
| 13 | `README.md` | **MODIFY** | dokumentasi commands + config baru | +30 ln |
| 14 | `tests/memory-matcher.test.js` | **NEW** | §12 | ~120 ln |
| 15 | `tests/memory-rstore.test.js` | **NEW** | §12 | ~130 ln |
| 16 | `tests/memory-detect.test.js` | **NEW** | §12 | ~110 ln |
| 17 | `tests/memory-distill.test.js` | **NEW** | mock adapter, merge/dedup | ~140 ln |
| 18 | `tests/memory-migrate.test.js` | **NEW** | migration idempotency | ~90 ln |
| 19 | `tests/memory.test.js` | **MODIFY** | tambah asersi mirror + compat guard (asersi lama TETAP) | +30 ln |

---

## 12. Test Plan

### 12.1 Unit — `node --test tests/*.test.js`

**`memory-matcher.test.js`**
- tokenize: lowercase, stopword removal, len>=2
- BM25: dokumen yang berisi query term menang atas yang tidak
- IDF: term langka > term umum
- boost: project rule naik di atas global dengan skor sama
- threshold: score < minScore tidak lolos
- budget: max topK, jatah kategori terpenuhi secara proporsional
- empty query → recency fallback

**`memory-rstore.test.js`** (semua pakai `mkdtemp` — jangan sentuh store asli;
inject root via env `OMH_MEMORY_ROOT` override yang ditambahkan di rstore)
- appendRule → baris JSONL valid
- listRules filter scope/category/activeOnly
- updateRule patch → rewrite, id lain utuh
- removeRule → status retracted, bukan delete fisik
- bumpHits throttle: flush hanya setelah cooldown lewat
- enqueue/dequeue roundtrip

**`memory-detect.test.js`**
- "jangan pakai npm install" → correction, conf ≥ 0.8
- "don't use camelCase here" → correction
- "harusnya pakai fetch bukan axios" → correction (target extraction)
- "mantap, thanks!" → success
- pesan > 120 char / mengandung URL → ignored
- pesan dari agent role → ignored

**`memory-distill.test.js`**
- parseRulesJSON: JSON valid di tengah noise → rules
- parseRulesJSON: output AI non-JSON → [] (gagal aman)
- merge: sim 0.9 → merge, lama superseded
- merge: sim 0.2 → append
- conflict negasi → supersede
- queue: maxQueue cap (job tertua dibuang)

**`memory-migrate.test.js`**
- migrateFile: bullets → records `source:"migrated"`, triggers terisi
- idempotent: run 2x → tidak ada duplikat (meta flag)
- legacy file tidak berubah isinya

### 12.2 Compat — asersi `tests/memory.test.js` lama **wajib hijau tanpa modifikasi asersi**. Tambah test baru:
- `/remember` menulis legacy file + structured record (hybrid mode)
- transform inject masih memuat legacy note (compat block)

### 12.3 Manual smoke (Phase 5)
```
npm test && npm run test:all
rm -rf ~/.config/opencode/memory/rules   # fresh store
opencode run → cek transform log mengandung "## PREFERENCES" / "## MEMORY"
/remember "jangan pakai npm install manual" → cek rules/global/preferences.jsonl
/memory-rules "npm" → relevansi terlihat
```

---

## 13. Execution Steps (Phase-based, tiap phase berakhir hijau)

### Phase 0 — Baseline & safety
1. `git status` bersih / buat branch `feat/smart-memory`.
2. `npm test` → catat baseline hijau.
3. Backup real memory: `cp -r ~/.config/opencode/memory ~/.config/opencode/memory.bak-$(date +%s)`.

### Phase 1 — Structured store & migration
4. Buat `memory/schema.js` + `memory/rstore.js` (+ env override `OMH_MEMORY_ROOT` untuk testability).
5. Buat `memory/migrate.js`; panggil `migrateIfNeeded()` di `memoryHooks` init.
6. Tulis `tests/memory-rstore.test.js` + `tests/memory-migrate.test.js`. **Gate: `npm test` hijau.**

### Phase 2 — BM25 matcher
7. Buat `memory/matcher.js`.
8. Tulis `tests/memory-matcher.test.js`. **Gate: hijau + review preseden operator k1/b.**

### Phase 3 — Detection & distill
9. Buat `memory/detect.js` + `memory/distill.js` (merge pipeline, queue).
10. Tulis `tests/memory-detect.test.js` + `tests/memory-distill.test.js` (mock adapter injection). **Gate: hijau.**

### Phase 4 — Injection & wiring
11. Buat `memory/ctx.js` + `memory/inject.js`.
12. Modifikasi `memory/index.js`: transform → injector, chat.message → ctx+detect, compacting → uncapped, event → processQueue.
13. **Verifikasi hook input shape** `chat.message` (log debug sekali) — adjust `extractTextParts` jika beda.
14. **Gate: `tests/memory.test.js` lama hijau + `npm test` penuh hijau.**

### Phase 5 — Config, commands, docs, release
15. Extend `share/config.js` DEFAULTS (§10).
16. Tambah `/memory-rules`, `/memory-scan`, `/memory-forget`, `/memory-stats` di `command.execute.before` + registrasi di `config` hook.
17. Update `AGENTS.md`, `README.md`, `CHANGELOG.md` (Conventional Commits + co-author trailer).
18. Manual smoke §12.3; `npm run test:all`.
19. Restore backup bila smoke gagal: hapus `rules/` + `meta.json` → system kembali ke legacy path penuh (rollback plan).

### Rollback plan (kapan pun)
- `store:"legacy"` di `omh.jsonc` → seluruh fitur baru bypass, perilaku = versi 0.2.0.
- Store baru terisolasi di `rules/` — menghapus folder itu memulihkan kondisi awal tanpa menyentuh `MEMORY.md`.

---

## 14. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Hook input shape `chat.message` berbeda dari asumsi (query kosong) | Defensive extractor + recency fallback; verifikasi eksplisit di Phase 4 |
| BM25 inject rule tidak relevan (noise) | `minScore` + budget topK + stopwords konservatif + tunable config |
| Distill AI output non-JSON | Parser toleran + `parseRulesJSON` gagal-aman → skip job, jangan crash |
| Concurrent write race (multi hook parallel) | JSONL append per-baris atomic; rewrite lewat tmp+rename; cooldown throttle |
| Bloat rule (self-reinforcing noise) | Dedup threshold, maxQueue, supersede flow, `/memory-forget` manual escape hatch |
| Latency di hook kritis | Matcher hanya baca + in-memory index; distill 100% async off-path; store read < 100 rules = sub-ms |
| Token budget injection membengkak | topK=8 + per-rule content ≤ 400 char → worst case ~2KB, setara legacy |

---

## 15. Definition of Done

- [ ] `npm test` hijau termasuk seluruh test legacy **tanpa perubahan asersi**.
- [ ] `/remember`, `/memory`, `/capture` berperilaku sama seperti v0.2.0 dalam mode `legacy`.
- [ ] Correction → distill → merge → inject loop teruji end-to-end dengan mock adapter.
- [ ] BM25 matcher murni JS, zero dependency baru di `package.json`.
- [ ] 4 slash command baru terdaftar via `config` hook (pattern opencode-quota).
- [ ] Docs (`AGENTS.md`, `README.md`) merefleksikan arsitektur baru.

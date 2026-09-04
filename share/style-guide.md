# Style Guide Pesan Guardrail — OpenCode

Saat LLM menerima pesan guardrail (dari `throw new Error` pada hook `tool.execute.before`),
format output dibuat ringkas, tegas, dan langsung dapat ditindaklanjuti.

## Format Block (aksi diblokir keras)

```
🛑 BLOCKED: <JUDUL SINGKAT>
Reason: <alasan singkat dan jelas>
Action: <instruksi tegas / langkah wajib yang harus diambil>
```

**Aturan:**
- Format 2-3 baris padat, tanpa markdown blockquote yang bertele-tele.
- Diawali `🛑 BLOCKED:` agar model AI memahami ini adalah hard-stop, bukan saran opsional.
- `Reason:` menjelaskan apa yang memicu pemblokiran.
- `Action:` memberikan instruksi langsung dan spesifik tindakan apa yang wajib dilakukan selanjutnya.

## Format Warning (peringatan non-block)

```
⚠️ WARN: <JUDUL SINGKAT>
Reason: <penjelasan singkat>
```

**Aturan:**
- Jangan tambah penjelasan panjang.
- Diawali `⚠️ WARN:`.

## Format Info / Reminder

```markdown
> *💡 <pesan reminder singkat>*
```

**Aturan:**
- Satu baris, tidak perlu judul.

## Prinsip

- **Singkat dan langsung ke inti** — model dan user butuh kejelasan aksi, bukan esai.
- **Tegas dan Otoritatif** — blokir keras tidak boleh terdengar seperti saran opsional.
- **Actionable** — selalu sertakan `Action:` yang menyebut nama tool atau perintah konkret yang harus dijalankan.
- **Bahasa Inggris untuk pesan sistem teknis** — konsisten dan mudah dipahami oleh seluruh model LLM.

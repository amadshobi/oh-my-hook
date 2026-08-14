# Style Guide Pesan Guardrail — OpenCode

Saat LLM menerima pesan guardrail (dari `throw new Error` pada hook `tool.execute.before`),
tampilkan ke user dengan format konsisten di bawah ini.

## Format Block (aksi diblokir)

```markdown
#### 🚫 <JUDUL SINGKAT>

> *<alasan singkat dan jelas>*
> *<saran atau langkah selanjutnya>*
```

**Aturan:**
- Jangan tambah penjelasan panjang di luar format di atas.
- Judul singkat (maks 5 kata), diawali emoji 🚫.
- Alasan & saran dalam bentuk italic (blockquote `>` + `*italic*`).
- Jika tidak ada saran, gunakan: `Tunggu persetujuan user sebelum melanjutkan.`

## Format Warning (tidak block)

```markdown
#### ⚠️ <JUDUL SINGKAT>

> *<penjelasan singkat>*
```

**Aturan:**
- Jangan tambah penjelasan panjang.
- Judul diawali emoji ⚠️.

## Format Info / Reminder

```markdown
> *💡 <pesan reminder singkat>*
```

**Aturan:**
- Satu baris, tidak perlu judul.

## Prinsip

- **Singkat dan langsung ke inti** — user tidak butuh esai, butuh aksi.
- **Tegas** — kalau block, jangan dilemahkan dengan kata-kata seperti "mungkin", "sebaiknya".
- **Konsisten** — selalu pakai format yang sama untuk level yang sama.
- **Bahasa Indonesia casual** — sesuai gaya komunikasi user.

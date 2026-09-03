# Mode Eksekusi Aktif (Approved)

Persetujuan telah diberikan oleh user. Mode session sekarang berpindah ke **Execute Mode**.
Semua mutasi file dan perintah implementasi kode sekarang **DIIZINKAN**.

{plan_reference}

---

## ️ Instruksi Disiplin Eksekusi (Engineering Protocol):

1. **Patuhi Dokumen Rencana**: Implementasikan kode secara modular dan presisi sesuai tahapan arsitektur yang telah disetujui. JANGAN melakukan scope creep atau menambah fitur di luar rencana.
2. **Execution Loop (1-Step-at-a-Time)**:
 - Selesaikan 1 tahapan / komponen.
 - Jalankan verifikasi lint / test / build.
 - Tandai milestone selesai, lalu lanjut ke tahapan berikutnya.
3. **Evidence Before "Done"**: Setiap perubahan kode wajib dibuktikan dengan output pengujian nyata yang lolos (passing test).
4. **Self-Correction & Transparency**: Jika menemukan kendala arsitektur tak terduga, laporkan segera ke user dan jangan gunakan workaround tanpa memahami akar masalah.
5. **Laporan Akhir**: Setelah seluruh tahapan tuntas, sajikan ringkasan perubahan file dan bukti verifikasi pengujian kepada BOSS.

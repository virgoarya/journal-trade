# Architecture Decision Records (ADR)

Folder ini menyimpan **keputusan arsitektur** Hunter Trades — *kenapa* kita memilih sesuatu,
bukan hanya *apa* yang kita bangun. Kode menjelaskan "bagaimana"; ADR menjelaskan "mengapa".

## Kapan menulis ADR

Tulis ADR ketika sebuah keputusan **mahal untuk dibalik** atau **mengubah arah** kerja:
- Memilih database / provider / model
- Mengganti arsitektur (mis. LLM Consensus → Agent Consensus)
- Mengubah model monetisasi
- Keputusan yang akan ditanyakan orang 6 bulan lagi: *"kenapa dulu kita pilih ini?"*

Tidak perlu ADR untuk: penamaan variabel, refactor kecil, atau hal yang bisa dibalik dalam 5 menit.

## Konvensi

- **Nama file:** `ADR-NNNN-judul-singkat.md` (nomor urut 4 digit, huruf kecil, tanda hubung)
- **Status:** `Proposed` → `Accepted` → (`Deprecated` | `Superseded by ADR-NNNN`)
- **Satu ADR = satu keputusan.** Jangan gabungkan beberapa keputusan tak terkait.
- **ADR tidak diubah isinya setelah Accepted.** Kalau keputusan berubah, tulis ADR baru dan
  tandai yang lama sebagai `Superseded by ADR-NNNN` — jejak keputusan harus tetap terbaca.

## Struktur wajib

1. **Status** — termasuk tanggal dan siapa pemilik keputusan
2. **Konteks** — masalah & fakta terverifikasi (sertakan path/ukuran, bukan klaim)
3. **Keputusan** — apa yang dipilih, eksplisit
4. **Opsi yang dipertimbangkan** — termasuk yang ditolak, dan alasannya
5. **Konsekuensi** — biaya, risiko, dan aturan yang tidak boleh dilanggar

## Aturan penting

- **Keputusan produk ditulis oleh pemilik keputusan (Bang Vir), bukan hasil voting agent.**
  Agent boleh merekomendasikan; ADR mencatat keputusan final yang benar-benar diambil.
- **Jangan tandai keputusan sebagai "Accepted" sebelum pemiliknya mengonfirmasi.**
- Tulis ADR **saat keputusan diambil** — murah dan mencegah konteks hilang.
  Sebaliknya, dokumentasi arsitektur (`wiki/`) ditulis **setelah** kode stabil.

## Daftar

| ADR | Judul | Status |
|---|---|---|
| [0001](ADR-0001-agent-consensus-engine.md) | Agent Consensus Engine untuk AI Trading | ✅ Accepted (rollout digantikan ADR-0002) |
| [0002](ADR-0002-agent-consensus-rollout.md) | Strategi Rollout: Full Replace LLM → Agent Consensus | ✅ Accepted |

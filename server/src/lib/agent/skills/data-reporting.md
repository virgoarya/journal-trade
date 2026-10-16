---
name: data-reporting
description: Cara menjawab pertanyaan yang meminta ANGKA/DATA spesifik — langsung jawab datanya, jangan melenceng ke analisis
triggers: berapa, berapakah, saldo, nilai, angka, data, sekarang, saat ini, current, level, harga berapa, berapa besar, how much, what is the, tampilkan, show me
priority: 20
---

# SKILL: Pelaporan Data Kuantitatif

## PRINSIP UTAMA

Kalau user meminta **ANGKA** → berikan **ANGKA**. Titik.

Pertanyaan seperti "berapa saldo X?", "berapa level Y?", "nilai Z sekarang?"
adalah pertanyaan **FAKTUAL**, bukan permintaan analisis.

## ATURAN KERAS

1. **Jawab pertanyaan yang ditanya.** Kalau user tanya "berapa saldo ON RRP dan TGA?",
   jawabannya HANYA angka kedua metrik itu. Jangan menambahkan kerangka analisis,
   framework SMC/ICT, protokol eksekusi, atau pembahasan aset yang tidak ditanya.

2. **Angka dulu, konteks belakangan (opsional).** Format yang benar:
   ```
   ON RRP: $11.54B
   TGA: $936.6B
   ```
   Boleh ditambah SATU kalimat konteks singkat (mis. status draining/injecting).
   Maksimal satu kalimat. Bukan satu halaman.

3. **JANGAN PERNAH mengaku "ada batasan data"** kalau datanya ADA di blok
   "DATA MAKRO AKTUAL" atau "MACRO SSOT SNAPSHOT". Cek dulu blok itu sebelum
   menyatakan data tidak tersedia.

4. **Kalau data benar-benar tidak ada** (tertulis "N/A"): katakan terus terang
   "data belum tersedia" dalam satu kalimat. Jangan menggantinya dengan
   pembahasan teori.

5. **Jangan menawarkan analisis yang tidak diminta** sebagai isi utama jawaban.
   Boleh tanya di akhir: "Mau saya kaitkan ke bias XAUUSD?" — tapi itu
   pertanyaan penutup, bukan isi jawaban.

## CONTOH BENAR

**User:** "berapakah saldo ON RRP dan TGA sekarang?"

**Jawaban benar:**
```
ON RRP: $11.54B (naik +$0.09B, netral)
TGA: $936.6B (turun -$22.97B → likuiditas disuntik ke pasar)

Status: INJECTING
```

**Jawaban SALAH** (yang harus dihindari):
> "Untuk menjembatani dinamika likuiditas makro dengan eksekusi harian kamu,
> berikut kerangka kerja kuantitatif SMC/ICT yang wajib diterapkan..."
> ← Ini melenceng. User hanya minta angka.

## ANTI-POLA

| Kalau user bilang | JANGAN lakukan |
|---|---|
| "berapa X?" | Jangan jelaskan framework/metodologi |
| "nilai Y sekarang?" | Jangan bahas aset lain |
| "saldo Z?" | Jangan mengaku batasan data kalau datanya ada |
| "tampilkan A" | Jangan menawarkan analisis panjang |

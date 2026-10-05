---
name: risk-management
description: Kuantifikasi risiko, position sizing, R-multiple, dan aturan manajemen posisi
triggers: risiko, risk, r:r, risk reward, position size, lot, sizing, drawdown, stop loss, take profit, kelly, 1%, 2%, modal, equity, margin, leverage, hedging, hedge
priority: 12
---

# SKILL: Manajemen Risiko

## ATURAN DASAR (NON-NEGOTIABLE)

1. **Risiko per trade**: 1–2% dari modal. Tidak pernah lebih tanpa alasan eksplisit.
2. **R:R minimum**: 1:2. Setup di bawah itu **ditolak**, bukan "dipertimbangkan".
3. **Selalu ada stop loss.** Tidak ada setup tanpa SL.
4. **Maksimal risiko harian**: 4–6% (akumulasi semua posisi terbuka).

## POSITION SIZING

```
Ukuran Posisi = (Modal × Risiko%) / (Jarak SL dalam poin × Nilai per poin)
```

**Contoh XAUUSD:**
- Modal: $10,000. Risiko 1% = $100.
- Entry 2650, SL 2645 → jarak 5 poin ($5 per 0.01 lot... sesuaikan kontrak).
- Ukuran lot = $100 / (jarak SL × nilai per poin).

## R-MULTIPLE

- **1R** = jumlah uang yang dipertaruhkan (mis. $100).
- Menang 1:3 → +3R. Kalah → −1R.
- Target ekspektasi: win rate 40% dengan 1:3 sudah profitable (EV = 0.4×3 − 0.6×1 = +0.6R).

## MANAJEMEN POSISI TERBUKA

| Kondisi | Aksi |
|---|---|
| Profit +1R | Geser SL ke break-even |
| Profit +2R | Ambil partial 50%, sisanya trailing |
| Struktur berubah berlawanan | Exit, jangan berharap |
| Setup invalidasi tersentuh | Exit tanpa diskusi |

## KALAU SETUP TIDAK LAYAK

Katakan terus terang, contoh:
> "Setup ini R:R hanya 1:1.2 — di bawah minimum 1:2. Saya tidak rekomendasikan.
> Kalau mau tetap masuk, risiko harus dikecilkan ke 0.5% atau tunggu retest di <level>."

Jangan menyetujui setup buruk hanya karena user ingin entry.

## JANGAN

- Jangan sebut R:R tanpa angka konkret (entry/SL/TP).
- Jangan merekomendasikan tanpa SL.
- Jangan menaikkan risiko karena "yakin" — keyakinan bukan edge.

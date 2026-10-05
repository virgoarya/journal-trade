---
name: liquidity-macro
description: Membaca & melaporkan likuiditas makro (ON RRP, TGA, Net Liquidity) dan dampaknya ke pasar
triggers: on rrp, onrrp, tga, treasury general account, reverse repo, net liquidity, likuiditas, liquidity, draining, injecting, walcl, reserve balance, saldo likuiditas
priority: 15
---

# SKILL: Analisis Likuiditas Makro

## SUMBER DATA (WAJIB PAKAI INI)

Angka ON RRP & TGA ada di blok **"DATA MAKRO AKTUAL (AS) — SUMBER KEBENARAN MUTLAK (SSOT)"**
dan **"MACRO SSOT SNAPSHOT (LIVE)"**. Angka di sana IDENTIK dengan yang tampil di
dashboard Liquidity Flow. Jangan pakai angka lain, jangan mengarang.

| Metrik | Arti | Sumber |
|---|---|---|
| **ON RRP** | Uang parkir institusi di Fed | FRED `RRPONTSYD` |
| **TGA** | Rekening kas Treasury di Fed | Fiscal Data API |
| **Reserve Balance** | Cadangan bank di Fed | FRED `WALCL` |

## CARA BACA ARAH LIKUIDITAS

Net Liquidity ≈ Reserve Balance − ON RRP − TGA

| Kejadian | Efek Likuiditas | Implikasi Pasar |
|---|---|---|
| TGA **naik** | **DRAINING** (uang ditarik dari sistem) | Risk-off, tekanan ke risk asset |
| TGA **turun** | **INJECTING** (uang masuk ke sistem) | Risk-on, dorongan ke risk asset |
| ON RRP **naik** | **DRAINING** (institusi parkir uang) | Likuiditas pasar mengetat |
| ON RRP **turun** | **INJECTING** (uang keluar ke pasar) | Likuiditas bertambah |

**Penting**: yang dilaporkan adalah **delta/perubahan**, bukan hanya level absolut.
TGA $936.6B dengan delta −$22.97B = likuiditas sedang disuntik ke pasar.

## CARA MELAPOR

Kalau user minta **angka** → format ringkas:
```
ON RRP: $11.54B (Δ +$0.09B) → netral
TGA: $936.6B (Δ −$22.97B) → INJECTING
Status Likuiditas: INJECTING
```

Kalau user minta **analisis dampak** → baru jelaskan transmisinya:
1. Arah likuiditas (draining/injecting)
2. Aset yang paling terpapar (XAUUSD, DXY, EURUSD)
3. Katalis yang bisa membalik kondisi

## JANGAN

- Jangan mengaku "batasan data" kalau angka sudah ada di blok SSOT.
- Jangan membahas SMC/ICT kalau user hanya minta angka likuiditas.
- Jangan pakai angka dari ingatan training — selalu dari blok SSOT.

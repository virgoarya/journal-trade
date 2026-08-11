# Implementation Plan: Perbaikan Methodology SMC/ICT/MSNR + LLM Voting

## Overview

Memperbaiki akurasi level harga dan checklist validation pada 3 methodology trading (SMC, ICT, MSNR) yang saat ini meleset dari real chart (contoh: level RBS/OB terdeteksi tapi bukan RBS/OB sebenarnya). Juga memperbaiki LLM voting: model IDs + fallback baru untuk 6 provider, dan reasoning DeepSeek yang masih bahasa Inggris.

## Temuan Audit (Root Cause)

### A. Level Harga Tidak Akurat

**A1. [KRITIS] Bug RBS/SBR terbalik — `market-structure.service.ts:1489-1519`**
```typescript
// SALAH: Resistance + harga turun → diklasifikasikan "RBS"
// BENAR:  Resistance ditembus ke BAWAH = SBR (Support Become Resistance)
// SALAH: Support + harga naik → diklasifikasikan "SBR"
// BENAR:  Support ditembus ke ATAS = RBS (Resistance Become Support)
```
Definisi yang benar:
- **RBS (Resistance Become Support)**: level resistance lama, harga break ke ATAS, lalu level jadi support → terjadi saat candle CLOSE di atas resistance.
- **SBR (Support Become Resistance)**: level support lama, harga break ke BAWAH, lalu level jadi resistance → terjadi saat candle CLOSE di bawah support.

**A2. [KRITIS] Deteksi flip hanya cek 1 candle di index SNR — `market-structure.service.ts:1495-1513`**
- `const recentCandle = candles[snr.index]` → hanya cek candle pada index yang sama dengan level dibuat, bukan candle TERAKHIR yang menembus level. Harus cek candle terakhir (atau lookback 5 candle terakhir).

**A3. [TINGGI] Order Block boundary pakai body candle — `detectOrderBlocks:628-629,659-660`**
- `obTop = max(open, close)`, `obBottom = min(open, close)` — hanya BODY, tidak termasuk wick. Banyak OB sejati yang boundary-nya di wick. Perlu konfigurasi: body-only vs wick-inclusive.

**A4. [TINGGI] Swing detection strength & lookback** — `findSwingHighs/Lows:340-431`
- Konfirmasi parameter `leftBars=3, rightBars=2` sudah benar untuk SMC.
- Tambahkan validasi swing minimum jarak (ATR-based) untuk filter noise.

**A5. [SEDANG] KeyLevel clustering rata-rata — `identifyKeyLevels:824-898`**
- Level = rata-rata cluster swing points, tapi tidak ada validasi tap count/strength sebelum dianggap level valid.

**A6. [RISET] Checklist validation** — `checklist-validator.ts` & `smc/ict/msnr.strategy.ts`
- SMC: checklist `smc-liq` (liquidity sweep), `smc-ob` (order block), `smc-mss` (MSS) — perlu validasi harga level yang ditampilkan benar-benar level sebenarnya.
- ICT: `validatePOI`, `validateInducement` — perlu validasi FVG/OTE zone.
- MSNR: `detectMSNRSetup` (QML/RBS/SBR levels) — tergantung fix A1/A2.

### B. LLM Voting

**B1. Model IDs baru + fallback — `llm-consensus.service.ts:64-71` (NINE_ROUTER_MODELS)**

| Provider | Model Utama (baru) | Fallback (baru) |
|---|---|---|
| deepseek | `oc/deepseek-v4-flash-free` | `oc/laguna-s-2.1-free` |
| gpt | `groq/openai/gpt-oss-120b` | `groq/llama-3.3-70b-versatile` |
| gemini | `gc/gemini-3.1-flash-lite-preview` | `gc/gemini-2.5-pro` |
| mistral | `mistral/mistral-large-latest` | `mistral/mistral-medium-latest` |
| nemotron | `oc/nemotron-3-ultra-free` | `nvidia/minimaxai/minimax-m3` |
| claude-opus | `ag/claude-opus-4-6-thinking` | `kr/claude-sonnet-4.5` |

**B2. [KRITIS] Fallback tidak diimplementasi** — `getAvailableProviders():193-258`
- `NINE_ROUTER_MODELS` hanya punya 1 `model` per provider, TIDAK ada fallback model. Saat model utama gagal (rate-limit/error), seluruh provider di-skip. Harus tambah `fallbackModel` dan retry dengan fallback saat utama gagal.

**B3. DeepSeek reasoning masih Inggris — `parseVerdict:916-1074`**
- `forceIndonesian()` hanya translate kata kunci terbatas (`the trend is`, `strong buy`, dll). Model think-block (`reasoning_content`) yang panjang dalam bahasa Inggris tidak ditranslate dengan baik.
- Perlu: (a) prompt tambahan di SYSTEM_PROMPT untuk reasoning_content, (b) perluas kamus forceIndonesian, (c) pakai model `oc/deepseek-v4-flash-free` yang reasoning-nya sudah seharusnya ID.

## Architecture Decisions

- **RBS/SBR fix**: Definisi SMC/ICT yang benar — RBS = break atas, SBR = break bawah. Gunakan CLOSE price untuk konfirmasi break, bukan low/high wick.
- **Fallback model**: Tambah field `fallbackModel` di `LLMProvider` interface. Saat call model utama gagal (non-2xx / rate-limit), retry sekali dengan fallback.
- **Level validation**: Semua level (OB, RBS, SBR, QML) divalidasi terhadap harga aktual candle terakhir sebelum ditampilkan sebagai sinyal.
- **forceIndonesian**: Perluas kamus dengan istilah SMC/ICT/SNR umum; tambahkan deteksi "reasoning panjang" untuk translate kalimat utuh.

## Task List

### Phase 1: Fix Level Harga (Paling Kritis)
- [ ] Task 1: Fix bug RBS/SBR terbalik di `detectSNRFlip` (market-structure.service.ts:1489-1519)
  - [ ] RBS = resistance lama, candle terakhir CLOSE di atas level
  - [ ] SBR = support lama, candle terakhir CLOSE di bawah level
  - [ ] Gunakan lookback 5 candle terakhir, bukan hanya candle di index SNR
  - Verification: test unit — buat 10 candle mock dengan break atas/bawah, assert type RBS/SBR benar.
- [ ] Task 2: Perbaiki deteksi Order Block boundary (wick-inclusive opsional)
  - [ ] Tambah config `obUseWickBoundary` di strategy-config (default false)
  - [ ] Bila true: obTop = current.high, obBottom = current.low
  - Verification: OB level tampil cocok dengan real chart.
- [ ] Task 3: Validasi swing detection (filter noise ATR-based)
  - [ ] Swing valid hanya jika jarak dari swing sebelumnya > 0.5 × ATR
  - Verification: jumlah swing berkurang, level lebih bermakna.
- [ ] Task 4: Perbaiki KeyLevel clustering — tambah validasi tap count
  - [ ] Level hanya valid jika di-tap minimal 2× (ada 2+ swing points di cluster)
  - Verification: level RBS/SBR hanya muncul jika pernah diuji.

### Checkpoint 1: Level harga
- [ ] RBS/SBR level cocok dengan real chart (verifikasi manual 5 simbol)
- [ ] OB level cocok dengan displacement candle asli
- [ ] Build server sukses, test unit lulus

### Phase 2: Checklist Validation 3 Methodology
- [ ] Task 5: Riset & perbaiki checklist SMC (`smc.strategy.ts:128-231`)
  - [ ] Validasi `smc-ob`: level OB harus overlap dengan displacement candle
  - [ ] Validasi `smc-liq`: sweep price harus = harga wick yang menyapu level
  - Verification: checklist SMC menampilkan harga level yang benar.
- [ ] Task 6: Riset & perbaiki checklist ICT (`ict.strategy.ts:237-339`)
  - [ ] Validasi FVG zone: top/bottom sesuai gap candle sebenarnya
  - [ ] Validasi OTE: zona 61.8%-79% dari swing range yang benar
  - Verification: FVG/OTE zone cocok di chart.
- [ ] Task 7: Riset & perbaiki checklist MSNR (`msnr.strategy.ts:355-452`)
  - [ ] QML shoulder/head dari swing yang benar (depend Task 1)
  - [ ] SNR-Flip type & level dari detectSNRFlip yang sudah difix
  - Verification: QML/RBS/SBR cocok di chart.

### Checkpoint 2: Checklist validation
- [ ] Ketiga methodology menampilkan level harga yang akurat
- [ ] Backtest 100 candle per simbol — tidak ada level yang meleset jauh (>2 ATR dari level sebenarnya)

### Phase 3: LLM Voting & Model IDs
- [ ] Task 8: Update NINE_ROUTER_MODELS dengan model utama + fallback (llm-consensus.service.ts:64-71)
  - [ ] Tambah field `fallbackModel` di interface LLMProvider
  - [ ] Update 6 provider sesuai tabel B1
  - Verification: `getAvailableProviders()` mengembalikan model+fallback yang benar.
- [ ] Task 9: Implementasi fallback retry di call provider
  - [ ] Di `LLMConsensusService.callProvider` (sekitar line 750-790): jika call utama gagal (non-2xx/rate-limit), retry dengan `fallbackModel`
  - [ ] Logging: `[LLM-CONSENSUS] deepseek: primary fail → fallback oc/laguna-s-2.1-free`
  - Verification: test dengan mock fetch — primary 429 → fallback sukses.
- [ ] Task 10: Perbaiki reasoning DeepSeek → Bahasa Indonesia
  - [ ] Perluas `forceIndonesian` kamus (istilah SMC/ICT: order block, fair value gap, liquidity, sweep, manipulation, dll)
  - [ ] Tambah translate kalimat umum (dictionary-based phrase replacement)
  - [ ] Update SYSTEM_PROMPT: instruksi keras "reasoning_content JANGAN dalam bahasa Inggris"
  - Verification: reasoning DeepSeek muncul dalam Bahasa Indonesia di UI.

### Checkpoint 3: LLM voting
- [ ] 6 provider aktif dengan model baru
- [ ] Saat model utama rate-limited, fallback dipakai otomatis
- [ ] DeepSeek reasoning dalam Bahasa Indonesia

### Phase 4: Testing & Release
- [ ] Task 11: Unit test untuk RBS/SBR + fallback model
- [ ] Task 12: Full rebuild (server tsc, frontend build, buildApp, buildPatch)
- [ ] Task 13: Bump version → v1.0.15, update CHANGELOG
- [ ] Task 14: Commit & push

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Perubahan level RBS/SBR mempengaruhi sinyal MSNR/ICT yang ada | Medium | Test unit + backtest sebelum release; pastikan sinyal tidak menurun drastis |
| Fallback model tidak tersedia di 9router (404) | Medium | Health check di startup: jika fallback juga gagal, skip provider |
| forceIndonesian terlalu agresif merusak kalimat | Low | Hanya translate saat deteksi bahasa Inggris kuat (enCount >> idCount) |
| Model baru (gemini-3.1, claude-opus-4-6-thinking) belum di 9router | High | Test `get_trading_account_info`-style probe ke 9router `/v1/models` sebelum commit |

## Open Questions
1. Apakah `oc/nemotron-3-ultra-free` dan `ag/claude-opus-4-6-thinking` tersedia di 9router yang berjalan? (perlu probe `/v1/models`)
2. Apakah `gc/gemini-3.1-flash-lite-preview` tersedia? (perlu probe)
3. Level OB: mau body-only (default) atau wick-inclusive? (Task 2, default body-only dulu)

# Todo — Perbaikan Methodology SMC/ICT/MSNR + LLM Voting

## Phase 1: Fix Level Harga
- [x] Task 1: Fix bug RBS/SBR terbalik di detectSNRFlip (market-structure.service.ts:1489) — **Done di v1.0.15**
- [x] Task 2: Order Block boundary (config wick-inclusive opsional) — **Done di v1.0.15**
- [x] Task 3: Validasi swing detection (filter noise ATR-based) — **Done di v1.0.15** (`findSwingHighs:388-399`, `findSwingLows:447-458`)
- [x] Task 4: KeyLevel clustering — validasi tap count min 2 — **Done di v1.0.15** (`identifyKeyLevels:906`)
- [x] **Checkpoint 1: RBS/SBR & OB cocok real chart** — **Done**

## Phase 2: Checklist Validation 3 Methodology
- [x] Task 5: Checklist SMC — validasi level OB & sweep price — **Done di v1.0.15**
- [x] Task 6: Checklist ICT — validasi FVG & OTE zone — **Done di v1.0.15**
- [x] Task 7: Checklist MSNR — QML & SNR-Flip (depend Task 1) — **Done di v1.0.15**
- [x] **Checkpoint 2: 3 methodology tampil level akurat** — **Done**

## Phase 3: LLM Voting & Model IDs
- [x] Task 8: Update NINE_ROUTER_MODELS — 6 provider model+fallback baru — **Done di v1.0.15**
- [x] Task 9: Implementasi fallback retry di callProvider — **Done di v1.0.15** (`callProvider:756-798`)
- [x] Task 10: Reasoning DeepSeek → Bahasa Indonesia (forceIndonesian + prompt) — **Done di v1.0.15**
- [x] **Checkpoint 3: 6 provider aktif, fallback jalan, reasoning ID** — **Done**

## Phase 4: Testing & Release
- [x] Task 11: Unit test RBS/SBR + fallback model — **Done** (snr-flip.test.ts: 21 tests pass)
- [x] Task 12: Full rebuild (tsc, frontend, buildApp, buildPatch) — **Done**
- [x] Task 13: Bump v1.0.15 + CHANGELOG — **Done**
- [x] Task 14: Commit & push — **Done** (15 commits ahead of main)

## Status: ✅ SEMUA SELESAI
Branch `feat/checklist-display-only` siap di-merge ke main.

# Todo — Perbaikan Methodology SMC/ICT/MSNR + LLM Voting

## Phase 1: Fix Level Harga
- [ ] Task 1: Fix bug RBS/SBR terbalik di detectSNRFlip (market-structure.service.ts:1489)
- [ ] Task 2: Order Block boundary (config wick-inclusive opsional)
- [ ] Task 3: Validasi swing detection (filter noise ATR-based)
- [ ] Task 4: KeyLevel clustering — validasi tap count min 2
- [ ] **Checkpoint 1: RBS/SBR & OB cocok real chart**

## Phase 2: Checklist Validation 3 Methodology
- [ ] Task 5: Checklist SMC — validasi level OB & sweep price
- [ ] Task 6: Checklist ICT — validasi FVG & OTE zone
- [ ] Task 7: Checklist MSNR — QML & SNR-Flip (depend Task 1)
- [ ] **Checkpoint 2: 3 methodology tampil level akurat**

## Phase 3: LLM Voting & Model IDs
- [ ] Task 8: Update NINE_ROUTER_MODELS — 6 provider model+fallback baru
- [ ] Task 9: Implementasi fallback retry di callProvider
- [ ] Task 10: Reasoning DeepSeek → Bahasa Indonesia (forceIndonesian + prompt)
- [ ] **Checkpoint 3: 6 provider aktif, fallback jalan, reasoning ID**

## Phase 4: Testing & Release
- [ ] Task 11: Unit test RBS/SBR + fallback model
- [ ] Task 12: Full rebuild (tsc, frontend, buildApp, buildPatch)
- [ ] Task 13: Bump v1.0.15 + CHANGELOG
- [ ] Task 14: Commit & push

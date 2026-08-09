# Todo — Sinkronisasi Total AI Trading Pipeline

## Phase 0 — Baseline
- [ ] Task 0: `npx tsc` server bersih + `npm run build` frontend sukses + `npm test` server pass

## Phase 1 — Koneksi & Data Live (read-only)
- [ ] Task 1: `/connect` + `/status` connected; ConnectionPanel OK
- [ ] Task 2: `/account` & `/symbols` sinkron dengan MT5 desktop
- [ ] Task 3: `/positions` menampilkan `{positions, orders, total}`; badge UI benar
- [ ] **Checkpoint 1**

## Phase 2 — Trading Write Ops (trade_api.py)
- [ ] Task 4: Open market order BUY/SELL (0.01 lot) — retcode 10009
- [ ] Task 5: Place pending BUY_LIMIT/STOP — muncul di orders
- [ ] Task 6: Cancel pending order — hilang dari list
- [ ] Task 7: Close open position — hilang dari list
- [ ] Task 8: Modify SL/TP (posisi & pending) — berubah di MT5
- [ ] **Checkpoint 2 — tanpa error "not permitted"**

## Phase 3 — Pipeline & LLM
- [ ] Task 9: Pipeline start/stop/pause/resume — status & logs benar
- [ ] Task 10: `/analyze` & `/analyze-multi` → confluence/entry/SL/TP
- [ ] Task 11: `/llm-status` model tidak hibernasi; LLMConsensusViz benar
- [ ] **Checkpoint 3**

## Phase 4 — Backtest & History
- [ ] Task 12: `/auto-backtest` & `/performance` jalan
- [ ] Task 13: AITradeHistories & journal sinkron PnL
- [ ] Task 14: Badge AI/MANUAL benar setelah trade ops

## Phase 5 — E2E & Regression
- [ ] Task 15: `server/scripts/integration-test.mjs` — full E2E scripted
- [ ] Task 16: Frontend smoke manual checklist per panel

## Phase 6 — Release
- [ ] Task 17: Full rebuild packaged (tsc → frontend → buildApp → buildPatch → checksum → push)
- [ ] Verifikasi `git status` kosong & `git log` mencerminkan fix terakhir
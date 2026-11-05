# BRIEFING DEVELOPMENT — Hunter Trades Journal
**Tanggal:** 26 Oktober 2026  
**Disusun:** SAGE (Docs/DX), dikoordinasikan dengan KIRA  
**Board:** `hunter-trades-journal`  
**SOP:** `team-sop` — evidence-based, serial dispatch, report format SOP 6.1

---

## 1. Status Build Terakhir (Evidence)

- Manifest final: `.release-manifest-final-20261023-1926.txt`
- HEAD saat build: `7470d58`
- Build window: `2026-10-23 19:16:11` → `19:20:44 (+07:00)`
- `npm run build:all` → **exit 1**: `EBUSY buildApp.js:78` (environmental)
- Fallback: `npm --prefix desktop run build:pack` → **exit 0**
- Artifact: `desktop/dist-app/win-unpacked/Hunter Trades.exe`
- Size: `201,233,408` bytes
- SHA256: `588bd82e36ad1acdae4615b6336284e420704389864f54ef2d10ea66c1a3cde0`
- BUILD_ID source = artifact = `3fA8ZE5enYI04-Z7gDCnE`
- **Current HEAD:** `0f6aa35` → artifact is **1 commit behind HEAD**
- Build was produced from a **dirty working tree**: 17 tracked modified + 7 untracked

---

## 2. Temuan yang Belum Diselesaikan

1. **Build tidak reproducible.** `build:all` gagal EBUSY, lalu diakali dengan `build:pack`. Ini bukan build bersih.
2. **Artifact stale.** EXE dibangun dari `7470d58`, sedangkan HEAD sekarang `0f6aa35`.
3. **Perubahan belum di-commit.** Payment UI/backend, test baru, dan dokumen masih di working tree.
4. **Kanban tidak punya antrean siap.** 4 running, 10 blocked, 0 todo/review. Dispatch tidak bisa bergerak.
5. **Provider fallback belum dikembalikan.** Semua agent dipindah ke `nous`; `9router` masih rate-limited.
6. **Devtools MCP belum diverifikasi fungsional.** Baru dicek ada di config, belum ada bukti tool call berhasil.
7. **Briefing Kira sebelumnya fokus config, bukan build/QA.** Belum menjawab temuan build terakhir.

### Perubahan yang masih terbuka (ringkas)

**Tracked modified:**
- `client/components/payment/PaymentStatus.tsx`
- `client/lib/api/payment.ts`
- `client/pages/ai-trading/payment.tsx`
- `frontend/src/app/(dashboard)/ai-trading/components/AccountOverview.tsx`
- `frontend/src/app/(dashboard)/ai-trading/components/PaymentStatusBanner.tsx`
- `frontend/src/app/(dashboard)/ai-trading/hooks/useAccountInfo.ts`
- `frontend/src/app/(dashboard)/ai-trading/hooks/usePaymentGate.ts`
- `frontend/src/app/(dashboard)/ai-trading/page.tsx`
- `frontend/src/components/PaymentModal.tsx`
- `server/mcp-mt5-server/server.py`
- `server/src/mt5-streamer.ts`
- `server/src/services/__tests__/payment.service.test.ts`
- `server/src/services/ai-trading-engine.service.ts`
- `server/src/services/backtest.service.ts`
- `server/src/services/mt5-mcp.service.ts`
- `server/src/services/risk-manager.service.ts`
- `server/src/services/trading-pipeline.service.ts`

**Untracked:**
- `docs/smart-risk-prop-firm-cfd-patch-spec.md`
- `frontend/src/app/(dashboard)/ai-trading/components/__tests__/PaymentStatusBanner.test.tsx`
- `frontend/src/app/(dashboard)/ai-trading/hooks/__tests__/useAccountInfo.test.ts`
- `frontend/src/app/(dashboard)/ai-trading/hooks/account-info-normalizer.ts`
- `frontend/src/lib/__tests__/payment-endpoints.test.ts`
- `frontend/src/lib/payment-endpoints.ts`
- `server/src/services/__tests__/position-sizing.test.ts`

---

## 3. Yang Harus Dilakukan dari Build Terakhir

### P0 — Build & Release
1. **Freeze scope.** Commit atau stash semua perubahan; jangan build dari dirty tree.
2. **Rebuild dari HEAD `0f6aa35`** dengan `npm run build:all` sampai **exit 0**.
3. **Perbaiki `buildHooks/buildApp.js:78` EBUSY.** Pastikan `Hunter Trades.exe` tidak sedang berjalan; tambahkan retry/backoff atau output direktori sementara.
4. Jalankan `npm run preflight:bundle` dan `npm run build:patch`.
5. Verifikasi **SHA256 artifact = source BUILD_ID** dan catat manifest baru.
6. **Clean install test**: uninstall versi lama, install EXE baru, launch, cek versi `1.2.1`.

### P1 — Unblock Kanban (serial, satu per satu)
1. `t_fb089313` — Nova COMMIT-1: commit `usePipelineData.ts`
2. `t_345ec48c` — Sage COMMIT-2: commit DOCS-1 wiki updates
3. `t_8c3c23f4` — Nova PAY-FRONTEND: align + cleanup B4/C1/C5
4. `t_c95a3f4a` / `t_8426cfbd` — Axis PAY-BACKEND: B1–B7
5. `t_471ac12d` — Vera PAY-VERIFY: E2E payment
6. `t_7ba9b25b` — Riku RIKU-1: onboarding overlay z-index + screenshot
7. `t_00368f35` — Vera VERIFY-2: E2E Agent Consensus

### P2 — Hygiene
- Setelah `9router` recover, kembalikan config canonical `9router/auto-free-model`.
- Uji devtools MCP dengan satu tool call nyata, bukan hanya cek `config.yaml`.
- Hapus file probe sementara `frontend/riku-qc-probe*.mjs` dan `playwright.tmp-e2e.config.ts` jika tidak dipakai.

---

## 4. Assignment

- **Forge:** build reproducibility, EBUSY fix, clean install.
- **Axis:** commit backend payment, B1–B7, unit test.
- **Nova:** commit frontend payment/UI, UI-2 cleanup.
- **Vera:** E2E payment + Agent Consensus, screenshot evidence.
- **Riku:** onboarding overlay QC.
- **Sage:** commit DOCS-1, ADR-0003.
- **Volco:** TOOL-1b vitest forks.
- **Kira:** serial dispatch, no batch, unblock berurutan.

---

## 5. Definition of Done

- Git tree bersih pada satu commit.
- `npm run build:all` exit 0.
- Artifact SHA256 + BUILD_ID tercatat dan cocok.
- Clean install lulus.
- Task kanban `done` dengan evidence.
- Tidak ada task `blocked` tanpa owner dan next action.

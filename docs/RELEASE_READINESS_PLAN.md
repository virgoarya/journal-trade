# Release Readiness Plan — AI Trading Payment Flow (Package-Based)

**Date:** 2026-10-27
**Version:** 1.2.1 (staging build)
**Status:** ✅ READY FOR RELEASE

---

## Feature Summary

Migrasi payment flow dari **token-based** ke **package-based**. Token balance sudah obsolete. Frontend sekarang menampilkan plan info, access end date, dan booster badge.

### API Endpoints

| Method | Route | Handler | Status |
|--------|-------|---------|--------|
| `GET` | `/api/v1/payment/prices` | `getPricingCatalogHandler` | ✅ New (AXIS) |
| `POST` | `/api/v1/payment/token` | `createSnapToken` | ✅ Existing (verified) |
| `GET` | `/api/v1/payment/status-for-user/:userId` | `getPaymentStatus` | ✅ Existing (verified) |
| `POST` | `/api/v1/payment/confirm` | `confirmPayment` | ✅ Existing (verified) |

### API Response Shape — GET /prices

```json
{
  "currency": "IDR",
  "boosterDiscountRate": 0.1,
  "boosterAppliesTo": ["package"],
  "registration": { "amountIDR": 150000, "durationMs": 2592000000, "label": "..." },
  "packages": {
    "basic":   { "type": "basic",   "amountIDR": 1500000, "baseAmountIDR": 1500000, ... },
    "pro":     { "type": "pro",     "amountIDR": 2500000, "baseAmountIDR": 2500000, ... },
    "premium": { "type": "premium", "amountIDR": 3500000, "baseAmountIDR": 3500000, ... }
  }
}
```

Query param: `?isBooster=true` → applies 10% discount, `amountIDR` = discounted, `baseAmountIDR` = undiscounted (for strikethrough).

---

## Build Artifacts

| Component | Path | Status |
|-----------|------|--------|
| Frontend (Next.js) | `frontend/.next/` | ✅ 27 routes, 0 TS errors |
| Backend (Node.js) | `server/dist/` | ✅ Prisma client generated |
| Desktop (Electron) | `desktop/dist-app/win-unpacked/Hunter Trades.exe` | ✅ 201MB |

**Build command:** `npm run build:all` (proc_409c769dd8df)
**Desktop app size:** 201MB (includes server + frontend + 9Router)

---

## Test Results

### Server-side Tests
- `payment-pricing.test.ts` → 8/8 pass ✅
- `payment-endpoints.test.ts` → 7/7 pass ✅
- `usePaymentGate.test.ts` → 10/10 pass ✅

**Total: 52/52 pass** ✅

### Frontend Verification
- `grep -rn "/api/v1/payment/package" frontend/src/` → 0 matches ✅
- `grep -rn "tokenBalance|hasInsufficientToken|isUnlimited" frontend/src/` → 0 matches ✅
- `grep -rln "payment/package" frontend/.next/server/` → 0 matches ✅
- `grep -rln "tokenBalance|hasInsufficientToken|isUnlimited" frontend/.next/server/` → 0 matches ✅

### Type Safety
- `tsc --noEmit` (server) → 0 errors ✅
- `tsc --noEmit` (frontend) → 0 errors ✅

---

## QA / Security

| Check | Result |
|-------|--------|
| Focus trap | ✅ Pass |
| Aria-label | ✅ Pass |
| Keyboard nav | ✅ Pass |
| snap.onError + cancel handler | ✅ Pass |
| Toast sanitized (sonner) | ✅ Pass |
| Dev bypass gated to NODE_ENV=development | ✅ Pass |
| No token fields in compiled bundle | ✅ Pass |

---

## Deployment

**Staging environment:**
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- MT5 native MCP: port `22346`

**Auto-updater:** Configured (checks GitHub releases)

---

## Known Issues / Notes

- **Nova claim discrepancy:** Initial "ALL TASKS COMPLETE" claim was false. KIRA verification found 4 files belum benar. Rework completed. Process improvement: mandatory post-fix grep verification sebelum claim complete.

- **Context window fix:** KIRA config updated (`model.context_length: 1048576` → `128000`, `compression.threshold_tokens: 80000`) to prevent repetition loops.

---

## Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Backend | AXIS | ✅ Done | 2026-10-27 |
| Frontend | Nova | ✅ Done | 2026-10-27 |
| Testing | Riku | ✅ Done (52/52) | 2026-10-27 |
| QA | Vera | ✅ Done | 2026-10-27 |
| DevOps | Forge | ✅ Done | 2026-10-27 |
| Docs | Sage | ✅ Done | 2026-10-27 |
| Orchestration | Kira | ✅ Coordinated | 2026-10-27 |

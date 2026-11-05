# 🔍 AUDIT REPORT — Journal Trade v1.2.1
**Tanggal:** 5 November 2026  
**Auditor:** KIRA (AI/Orchestration Agent)  
**Tipe:** Read-Only Audit — Backend + Frontend  
**Branch:** Current working tree (120 modified/deleted files)

---

## RINGKASAN EKSEKUTIF

| Area | Status | Detail |
|------|--------|--------|
| Server Typecheck | ✅ PASS | 0 errors |
| Frontend Typecheck | ✅ PASS | 0 errors |
| Server Tests | ✅ PASS | 318/318 (53 files) |
| Frontend Tests | ✅ RESOLVED | **226/226 PASS** (37 failures fixed via setupFiles) |
| Discord OAuth Login | ✅ RESOLVED | Verified by Vera (SDK signIn.social + preflight health guard + trustedOrigins) |
| Route Inconsistency | ✅ RESOLVED | Mounted `/v1/agent-consensus/` with aiLimiter in `routes/index.ts` |
| Git Hygiene | ⚠️ WARNING | 24 files deleted, uncommitted changes |

---

## TEMUAN AUDIT

### 🚨 CRITICAL — C1: Frontend Test Failures (37 tests, 6 files)

**Root Cause:** `vitest.config.ts` memiliki `globals: true` dan `environment: 'jsdom'` tapi **TIDAK ADA `setupFiles`** yang menunjuk ke `src/setupTests.ts`.

Akibatnya: `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeEmptyDOMElement`, `toHaveAttribute`) tidak ter-register ke Vitest — semua test yang pakai matchers ini gagal dengan `Invalid Chai property`.

**File terdampak:**
1. `src/components/__tests__/PaymentModal.test.tsx` — 4 failed / 9 total
2. `src/components/macro-terminal/__tests__/MacroPriceChart.test.tsx` — 9 failed / 23 total
3. `src/app/(dashboard)/playbook/__tests__/PlaybookPage.a11y.test.tsx` — 2 failed / 5 total
4. `src/app/(dashboard)/ai-trading/components/__tests__/PaymentStatusBanner.test.tsx` — 5 failed / 6 total
5. `src/components/macro-terminal/__tests__/MacroScreener.test.tsx` — 15 failed / 16 total
6. `src/components/macro-terminal/__tests__/AiPersonaChatPanel.test.tsx` — 2 failed / 2 total

**Fix:** Tambahkan `setupFiles: ['./src/setupTests.ts']` ke `test` block di `frontend/vitest.config.ts`.

**Prioritas:** CRITICAL — semua test yang baru ditulis tidak bisa diverifikasi.

---

### 🚨 CRITICAL — C2: Route Path Inconsistency di `agent-consensus.routes.ts`

**Masalah:** File `agent-consensus.routes.ts` di-mount di `server/src/index.ts` line 115 dengan:
```ts
app.use("/api", agentConsensusRoutes);
```

Tapi **di dalam file route**, beberapa handler mendefinisikan path dengan prefix `/v1/agent-consensus/...` dan beberapa hanya `/parallel`, `/sequential`:

| Route Definition | Actual Resolved Path | Konsisten? |
|---|---|---|
| `POST /v1/agent-consensus/deep-research` | `/api/v1/agent-consensus/deep-research` | ✅ |
| `GET /v1/agent-consensus/insights` | `/api/v1/agent-consensus/insights` | ✅ |
| `POST /v1/agent-consensus` | `/api/v1/agent-consensus` | ✅ |
| `POST /parallel` | `/api/parallel` | ❌ MISMATCH |
| `POST /sequential` | `/api/sequential` | ❌ MISMATCH |
| `POST /v1/agent-consensus/debate` | `/api/v1/agent-consensus/debate` | ✅ |
| `POST /v1/agent-consensus/single/:persona` | `/api/v1/agent-consensus/single/:persona` | ✅ |

**Impact:** `/api/parallel` dan `/api/sequential` route paths salah — seharusnya `/api/v1/agent-consensus/parallel` dan `/api/v1/agent-consensus/sequential`. Kedua endpoint ini tidak terjangkau di path yang benar.

**Fix:** Ubah line 88 dan 102 di `agent-consensus.routes.ts`:
- `router.post("/parallel", ...)` → `router.post("/v1/agent-consensus/parallel", ...)`
- `router.post("/sequential", ...)` → `router.post("/v1/agent-consensus/sequential", ...)`

Atau refactor mounting agar konsisten dengan pattern lain di `routes/index.ts`.

---

### ⚠️ HIGH — H1: Agent Consensus Routes TIDAK di-mount via `routes/index.ts`

**Masalah:** Semua route lain di-mount lewat `routes/index.ts` dengan pattern:
```ts
router.use("/v1/ai-trading", aiTradingRoutes);
```
Tapi `agent-consensus` di-mount langsung di `server/src/index.ts`:
```ts
app.use("/api", agentConsensusRoutes);
```

Ini menyebabkan:
1. **Tidak ada rate limiter** — route lain yang lewat `routes/index.ts` bisa diberi middleware global; agent-consensus bypass ini
2. **Inkonsistensi arsitektur** — susah maintain ketika semua route lain ada di satu tempat tapi satu ini terpisah
3. **Double path prefix** — route mendefinisikan `/v1/agent-consensus/...` sendiri alih-alih memakai pattern router yang sudah ada

**Fix:** Pindahkan mounting ke `routes/index.ts` dan sesuaikan path definition.

---

### 🚨 CRITICAL — C3: Blank Screen pada Login Discord OAuth

**Gejala:** User buka aplikasi, klik "Login with Discord", layar blank — tidak redirect ke Discord OAuth.

**Analisis Flow:**
1. User klik tombol → `handleDiscordLogin()` di `app/page.tsx` line 11-22
2. Function set `loading=true`, lalu `window.location.href = /api/auth/signin/social?provider=discord&callbackURL=...`
3. Next.js rewrite (`next.config.ts` line 28-34) proxy `/api/:path*` → `http://localhost:5000/api/:path*`
4. Backend middleware (`index.ts` line 98-111) cek `req.url.startsWith("/api/auth")` → forward ke `authHandler`
5. `authHandler` = `toNodeHandler(auth)` — better-auth handles Discord OAuth redirect

**Kemungkinan Root Cause (urutan probabilitas):**

1. **Backend belum ready saat login** — `authHandler` di-set `null` di line 94, baru diinisialisasi SETELAH `connectDB()` selesai (line 189-195). Jika DB lambat connect (Atlas timeout), user klik login → backend return `503 "Database connecting, please retry"` → **tapi frontend tidak handle response ini** — `window.location.href` sudah navigasi ke URL backend, jadi user lihat JSON `{"error":"Database connecting..."}` atau blank page, bukan error UI.

2. **`BETTER_AUTH_URL` mismatch** — Server `.env` punya `BETTER_AUTH_URL=http://...5000`. Jika ini tidak match dengan origin yang user akses (misalnya user akses via `localhost:3000` tapi better-auth generate callback ke port 5000 langsung), cookie `sameSite: "lax"` tidak akan ter-set cross-origin → session hilang → blank redirect loop.

3. **Discord OAuth App Redirect URI salah** — Di Discord Developer Portal, redirect URI harus `http://localhost:5000/api/auth/callback/discord`. Jika salah (misalnya pakai port 3000 atau domain lama), Discord tolak callback → blank/error.

4. **`trustedOrigins` mismatch di Electron** — Auth config (`auth/index.ts` line 43-53) list trusted origins tapi **TIDAK include `file://`** untuk Electron. Jika app jalan di Electron (`file://` origin), better-auth bisa block request karena origin tidak trusted.

5. **`window.location.origin` di Electron** — Line 15 pakai `window.location.origin` untuk `callbackURL`. Di Electron yang load `file://`, origin = `"null"` (literal string) → `callbackURL=null/dashboard` → invalid redirect setelah OAuth.

**Fix yang direkomendasikan:**
- **Immediate:** Tambahkan error handling di `handleDiscordLogin` — jangan langsung `window.location.href`. Fetch `/api/auth/signin/social?...` dulu, cek response status, baru redirect.
- **Root cause 1:** Tambah health check sebelum login — hit `/health` endpoint dulu, jika 503 tampilkan "Server belum siap" di UI.
- **Root cause 4-5 (Electron):** Tambah `file://` ke `trustedOrigins` dan handle `window.location.origin === "null"` case.
- **Root cause 3:** Verifikasi Discord Developer Portal redirect URI match dengan `BETTER_AUTH_URL`.

**Prioritas:** CRITICAL — user tidak bisa masuk aplikasi sama sekali.

---

### ⚠️ HIGH — H2: 24 File Frontend Terhapus (Uncommitted)

**File terhapus (git status `D`):**
- `.gitignore` — **KRITIS**, project frontend tanpa gitignore
- `.env.example` — kehilangan dokumentasi environment variables
- `eslint.config.mjs` — linting config hilang
- `.storybook/*` (5 files) — semua Storybook hilang
- `e2e/*` (8+ files) — semua E2E test spec hilang
- `AGENTS.md`, `CLAUDE.md`, `README.md`, `RESPONSIVE_AUDIT.md`, `UX_AUDIT.md` — dokumentasi hilang
- `playwright.config.ts` — E2E config hilang

**Impact:** Ini bisa sengaja (cleanup) atau accidental deletion. Kehilangan `.gitignore` paling kritis — tanpa ini, `node_modules`, `.next`, `.env` bisa masuk commit.

**Action needed:** Bang Vir perlu keputusan — apakah file-file ini memang sengaja dihapus (cleanup) atau perlu di-restore (`git checkout -- <file>`).

---

### ⚠️ MEDIUM — M1: Route Komentar Misleading di `agent-consensus.routes.ts`

Line 86 komentar mengatakan `POST /v1/agent-consensus/parallel` tapi definisi actual di line 88 adalah `router.post("/parallel", ...)`. Komentar dan kode tidak sinkron.

Line 99-100 komentar `POST /parallel` — salah, seharusnya `POST /sequential`. Copy-paste error.

---

### ⚠️ MEDIUM — M2: `reset-data` Endpoint Tidak Reset Settings & MT5Connection

Di `settings.routes.ts` line 192-203, endpoint `POST /reset-data` menghapus:
- Trade, Playbook, TradingAccount, AiReview, DailySnapshot

Tapi **TIDAK** menghapus:
- `UserSettings` — settings tetap ada
- `MT5Connection` — koneksi broker tetap tersimpan
- `AITradeLog` — log AI trading masih ada

**Impact:** User yang reset data masih punya ghost settings dan koneksi lama. Ini mungkin by design (preservasi settings), tapi perlu didokumentasikan.

---

### ℹ️ LOW — L1: `setupTests.ts` Ada Tapi Tidak Dipakai

File `frontend/src/setupTests.ts` (1,855 chars) berisi setup yang benar:
- Import `@testing-library/jest-dom`
- Custom matchers
- Global mocks

Tapi karena C1 di atas, file ini tidak pernah dieksekusi oleh Vitest.

---

### ℹ️ LOW — L2: Payment Endpoint Frontend-Backend Match ✅

Verifikasi API contract untuk payment:
| Frontend (`payment-endpoints.ts`) | Backend (`payment.routes.ts` + `index.ts`) | Match? |
|---|---|---|
| `POST /api/v1/payment/token` | `POST /api/v1/payment/token` | ✅ |
| `POST /api/v1/payment/confirm` | `POST /api/v1/payment/confirm` | ✅ |
| `GET /api/v1/payment/status/:orderId` | `GET /api/v1/payment/status/:orderId` | ✅ |
| `GET /api/v1/payment/status-for-user/:userId` | `GET /api/v1/payment/status-for-user/:userId` | ✅ |
| `GET /api/v1/payment/prices` | `GET /api/v1/payment/prices` | ✅ |

Payment contract sudah konsisten.

---

### ℹ️ LOW — L3: AI Trading Settings Frontend-Backend Match ✅

| Frontend Service | Backend Route | Match? |
|---|---|---|
| `GET /api/v1/settings/ai-trading` | `GET /api/v1/settings/ai-trading` | ✅ |
| `PATCH /api/v1/settings/ai-trading` | `PATCH /api/v1/settings/ai-trading` | ✅ |

---

## PLAN IMPLEMENTASI PERBAIKAN

### Phase 1: Quick Fix (Estimated: 45 min) — Assignee: NOVA + VERA

| # | Task | Agent | Priority | Status |
|---|---|---|---|---|
| 1.1 | Tambahkan `setupFiles: ['./src/setupTests.ts']` di `frontend/vitest.config.ts` | Nova | CRITICAL | ✅ DONE |
| 1.2 | Re-run frontend test, verifikasi 37 failures resolved | Vera | CRITICAL | ✅ DONE (226/226 PASS) |
| 1.3 | Fix Discord OAuth blank screen di `app/page.tsx` + `server/src/auth/index.ts` | Nova + Axis | CRITICAL | ✅ DONE |
| 1.4 | Test login flow end-to-end (browser & desktop) | Vera | CRITICAL | ✅ DONE (PASS) |

### Phase 2: Route Fix (Estimated: 1 jam) — Assignee: AXIS

| # | Task | Agent | Priority | Status |
|---|---|---|---|---|
| 2.1 | Fix path `/parallel` → `/v1/agent-consensus/parallel` dan `/sequential` → `/v1/agent-consensus/sequential` di `agent-consensus.routes.ts` | Axis | CRITICAL | ✅ DONE |
| 2.2 | Fix komentar misleading di line 86 dan 99-100 | Axis | MEDIUM | ✅ DONE |
| 2.3 | Pertimbangkan migrasi mounting dari `index.ts` ke `routes/index.ts` (konsistensi) | Axis | HIGH | ✅ DONE |
| 2.4 | Re-run server test untuk pastikan tidak ada regresi | Vera | HIGH | ✅ DONE (318/318 PASS, 10/10 E2E PASS) |

### Phase 3: Git Hygiene (Estimated: 15 min) — Assignee: KIRA + BANG VIR

| # | Task | Agent | Priority |
|---|---|---|---|
| 3.1 | Review 24 deleted files — keputusan: intentional cleanup atau perlu restore | Bang Vir | HIGH |
| 3.2 | Jika `.gitignore` dihapus sengaja, pastikan ada penggantinya | Nova/Forge | HIGH |
| 3.3 | Commit state saat ini setelah semua fix | Forge | MEDIUM |

### Phase 4: Documentation (Estimated: 30 min) — Assignee: SAGE

| # | Task | Agent | Priority |
|---|---|---|---|
| 4.1 | Dokumentasikan behavior `reset-data` — apa yang di-reset dan apa yang tidak | Sage | MEDIUM |
| 4.2 | Update API reference jika ada endpoint path yang berubah | Sage | MEDIUM |

---

## URUTAN EKSEKUSI (Mengikuti SOP Resource Contention)

```
Phase 1 (Nova → Vera) → Phase 2 (Axis → Vera) → Phase 3 (Bang Vir → Forge) → Phase 4 (Sage)
```

Sequential execution untuk menghindari contention di D: volume.

---

*Report generated by KIRA — AI/Orchestration Agent*
*"Sebuah agent yang tidak bisa dijelaskan perilakunya adalah agent yang tidak seharusnya ada di production."*

# E2E Test Plan — Journal Trade Frontend Components

**Author:** VERA (QA Agent)
**Project:** D:/Journal Trade
**Date:** 2026-09-10
**Status:** DRAFT — awaiting review
**Framework recommendation:** Playwright (not yet installed; Puppeteer is present but suboptimal for E2E)

---

## 1. Executive Summary

| Component | Status | Test Priority |
|---|---|---|
| DashboardCard | EXISTS — `frontend/src/components/DashboardCard.tsx` | Medium |
| JournalEntryForm | INLINE in `frontend/src/app/(dashboard)/log-trade/page.tsx` (modal) | Critical |
| SignalChart | **DOES NOT EXIST** — no file found in codebase | BLOCKER |

### BLOCKER: SignalChart Does Not Exist

Searched the entire `D:/Journal Trade` tree — no file named `SignalChart`, `signal-chart`, or `signalchart` (any casing) exists. Before E2E tests for this component can be written, the component must be implemented first. This test plan assumes SignalChart will render chart data (candlestick, line, or area) from a trade's `chartLink` or market data feed.

**Recommendation:** Defer SignalChart E2E tests until the component is built. When it is, use the test skeleton in Section 4 below.

---

## 2. Environment & Prerequisites

**Running the app:**
```
cd D:/Journal Trade/frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

**Authentication:** The app uses `better-auth` via `useSession()`. E2E tests need a seeded test user. Create a test fixture:
- Email: `test-qa@journaltrade.dev`
- Password: (define in env, never hardcode)
- Active trading account with known `initialBalance` (e.g. $10,000)

**Test data seeding:** Before each test suite, seed:
- 1 active TradingAccount (FUTURES type and CFD type for size unit tests)
- 3+ trades (1 win, 1 loss, 1 breakeven)
- 1+ playbook for assignment tests

**Recommended framework setup:**
```bash
npm i -D @playwright/test
npx playwright install chromium
```
Config: `playwright.config.ts` with `baseURL: http://localhost:3000`, `webServer` pointing to `npm run dev`.

---

## 3. Component Test Cases

### 3.1 DashboardCard

**File:** `frontend/src/components/DashboardCard.tsx`
**Type:** Presentational component (no API calls, no state)
**Props:** title, value, change, subtitle, icon, href, variant, className

#### 3.1.1 Rendering

| ID | Case | Steps | Expected |
|---|---|---|---|
| DC-01 | Renders title and value | Mount with `title="Win Rate" value="67.5%"` | Card visible with "WIN RATE" uppercase text and "67.5%" in mono font |
| DC-02 | Renders subtitle when provided | Mount with subtitle | Subtitle text visible below value |
| DC-03 | No subtitle when omitted | Mount without subtitle | No subtitle element in DOM |
| DC-04 | Renders icon when provided | Pass icon prop | Icon rendered inside `bg-accent-gold/10` container |
| DC-05 | No icon container when omitted | Pass no icon prop | No icon wrapper div rendered |

#### 3.1.2 Variants

| ID | Case | Steps | Expected |
|---|---|---|---|
| DC-06 | Default variant border | Mount with `variant="default"` | Border class `border-white/5`, hover `border-accent-gold/20` |
| DC-07 | Profit variant border | Mount with `variant="profit"` | Border class `border-neon-green/20`, hover `border-neon-green/30` |
| DC-08 | Loss variant border | Mount with `variant="loss"` | Border class `border-neon-red/20`, hover `border-neon-red/30` |
| DC-09 | Warning variant border | Mount with `variant="warning"` | Border class `border-neon-orange/20`, hover `border-neon-orange/30` |

#### 3.1.3 Change / Trend Indicator

| ID | Case | Steps | Expected |
|---|---|---|---|
| DC-10 | Up trend renders green | `change={{ value: 5.2, trend: "up" }}` | `TrendingUp` icon with `text-neon-green`, value shows "+5.2%" |
| DC-11 | Down trend renders red | `change={{ value: -3.1, trend: "down" }}` | `TrendingDown` icon with `text-neon-red`, value shows "-3.1%" |
| DC-12 | Neutral trend renders minus | `change={{ value: 0, trend: "neutral" }}` | `Minus` icon with `text-text-muted` |
| DC-13 | No trend defaults to neutral | `change={{ value: 2.5 }}` (no trend) | `Minus` icon (neutral fallback) |
| DC-14 | Change label renders | `change={{ value: 5.2, trend: "up", label: "vs last week" }}` | "vs last week" visible after percentage |
| DC-15 | Negative value shows minus sign | `change={{ value: -7.8, trend: "down" }}` | Displays "-7.8%" (no extra "+" prefix) |

#### 3.1.4 Link Behavior

| ID | Case | Steps | Expected |
|---|---|---|---|
| DC-16 | Renders as `<a>` when href provided | `href="/dashboard"` | Root element is `<a href="/dashboard">` |
| DC-17 | Renders as `<div>` when no href | No href prop | Root element is `<div>` |
| DC-18 | ChevronRight appears on hover | `href` provided, hover card | ChevronRight icon visible (opacity transitions from 0 to 1) |
| DC-19 | No textDecoration inline | `href="/test"` | Element has `style="text-decoration: none"` |

#### 3.1.5 Accessibility

| ID | Case | Steps | Expected |
|---|---|---|---|
| DC-20 | Focus ring visible on tab | Tab to card with `href` | `focus:ring-2 focus:ring-accent-gold/40` applied |
| DC-21 | Card is keyboard navigable | Press Tab | Focus reaches the card element |

#### 3.1.6 Responsive

| ID | Case | Steps | Expected |
|---|---|---|---|
| DC-22 | Mobile padding | Viewport 375px | Uses `p-4` (sm breakpoint padding) |
| DC-23 | Desktop padding | Viewport 1280px | Uses `sm:p-5` |

---

### 3.2 JournalEntryForm (Manual Logging Terminal)

**File:** `frontend/src/app/(dashboard)/log-trade/page.tsx` (inline modal, lines ~1332-1692)
**Type:** Interactive form with API calls, real-time calculations, multiple modals
**Priority:** CRITICAL — this is the primary data entry surface

#### Preconditions for ALL JournalEntryForm tests:
- User is authenticated
- Active trading account exists (FUTURES or CFD)
- Dashboard loads without error

#### 3.2.1 Form Opening / Closing

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-01 | Open form via "Add Trade" button | Navigate to /log-trade, click "Add Trade" | Modal visible with title "Manual Logging Terminal" |
| JF-02 | Close via X button | Open form, click ✕ | Modal hidden, form fields reset |
| JF-03 | Close via Cancel button | Open form, click "Cancel" | Modal hidden |
| JF-04 | Close via backdrop (no — modal has no backdrop click close) | Verify backdrop click does NOT close | Modal remains open ( intentional design: prevent accidental close) |

#### 3.2.2 Form Fields — Rendering

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-05 | All required fields present | Open form | Inputs visible: pair (select), direction (select), entryPrice, stopLoss, lotSize, actualPnl, tradeDate, emotionalState |
| JF-06 | Optional fields present | Open form | Inputs visible: takeProfit, exitDate, chartLink, notes, session, marketCondition |
| JF-07 | Pair options vary by account type | FUTURES account active | Shows FUTURES_PAIRS categories (Commodities Micro, Indices Mini/Standard, etc.) |
| JF-08 | Pair options for CFD | CFD account active | Shows CFD_PAIRS categories (Commodities, Forex Major, Crypto, etc.) |
| JF-09 | Size Type selector visible for Futures | FUTURES account | "Size Type" select visible (Micro/Mini/Standard) |
| JF-10 | Size Type hidden for CFD | CFD account | "Size Type" select NOT in DOM |
| JF-11 | Entry time defaults to current NY time | Open form for new trade | tradeDate input pre-filled with current time in America/New_York |

#### 3.2.3 Real-Time Risk Calculator

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-12 | Risk % calculated on SL input | Enter entryPrice=1.1000, stopLoss=1.0950, lotSize=1, account equity=$10k, CFD | Risk % badge shows calculated value (not "-") |
| JF-13 | R-Multiple calculated with TP | Enter entryPrice=1.1000, stopLoss=1.0950, takeProfit=1.1100 | "Estimated Reward/Risk" badge shows "2.0 R" |
| JF-14 | No R-Multiple without TP | Enter entryPrice + stopLoss only, no takeProfit | R-Multiple shows "-" |
| JF-15 | LONG direction risk calc | direction=LONG, entry=1.1000, SL=1.0950 | riskPoints = 1.1000 - 1.0950 = 50 pips |
| JF-16 | SHORT direction risk calc | direction=SHORT, entry=1.1000, SL=1.1050 | riskPoints = 1.1050 - 1.1000 = 50 pips |
| JF-17 | Risk % color coding: safe | riskPercent < 1% | Badge uses `text-data-profit` |
| JF-18 | Risk % color coding: warning | 1% <= riskPercent < 2% | Badge uses `text-accent-gold` |
| JF-19 | Risk % color coding: danger | riskPercent >= 2% | Badge uses `text-data-loss` |
| JF-20 | Futures contract size varies by type | MES pair, micro type | Contract size = 5 (not 50 for standard) |

#### 3.2.4 Risk Tier Warning

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-21 | Warning appears when risk > account limit | Set values to trigger riskPercent > accountRiskLimit (default 1%) | Red banner "Risk Tier Violation" visible with exceed-by amount |
| JF-22 | Submit blocked without acknowledgment | Trigger risk warning, do NOT check acknowledge box, submit | `alert()` fires: "Anda harus menyetujui risiko ini..." |
| JF-23 | Submit allowed with acknowledgment | Trigger risk warning, check "Saya memahami risiko ini..." checkbox, submit | Form submits (API call fires) |
| JF-24 | Warning clears on field change | Trigger warning, change entryPrice to lower risk | Warning banner disappears |

#### 3.2.5 Create Trade Flow (Happy Path)

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-25 | Successful trade creation | Fill all required fields with valid data, click "Log Trade" | Modal closes, new trade appears at top of trade list |
| JF-26 | Playbook assignment modal appears | Complete JF-25 | PlaybookAssignmentModal opens for the new trade |
| JF-27 | Trade data persisted | After JF-25, refresh page | New trade still visible in list |
| JF-28 | Result auto-calculated | Set actualPnl=150 (positive) | Result = "WIN" (not visible in form, but stored) |
| JF-29 | Result = LOSS for negative PnL | Set actualPnl=-75 | Result = "LOSS" |
| JF-30 | Result = BREAKEVEN for zero | Set actualPnl=0 | Result = "BREAKEVEN" |
| JF-31 | Session auto-detected | Set tradeDate to 09:00 NY time, session="AUTO" | Session = "NY AM" |
| JF-32 | Session manual override | Set session dropdown to "London" | Session = "London" regardless of time |

#### 3.2.6 Edit Trade Flow

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-33 | Edit opens pre-filled form | Click Edit (pencil icon) on existing trade | Modal opens with title "Edit Trade", all fields pre-filled |
| JF-34 | Cancel edit resets form | Open edit, click "Cancel" | Form closes, no changes saved |
| JF-35 | Update trade successfully | Open edit, change lotSize, click "Update Trade" | Modal closes, trade row reflects new lotSize |
| JF-36 | Edit preserves trade ID | Open edit on trade X, submit | Same trade X updated (not a new trade created) |

#### 3.2.7 Delete Trade Flow

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-37 | Delete opens confirmation modal | Click Trash icon on a trade | Delete confirmation modal visible with "Delete Trade" title |
| JF-38 | Soft delete default | Confirm delete (don't toggle to hard delete) | Trade moves to "Deleted" filter tab, can be restored |
| JF-39 | Soft delete reason required | Delete modal shows reason dropdown | Options: MT5 mismatch, Duplicate entry, Test/demo trade, Data entry error, Other |
| JF-40 | "Other" shows text input | Select "Other" in reason dropdown | Free text input appears |
| JF-41 | Hard delete toggle | Click "Hard Delete" button in delete modal | Confirmation changes to red theme, checkbox appears |
| JF-42 | Hard delete requires checkbox | Check "I understand..." checkbox, click confirm | Trade permanently removed from DB |
| JF-43 | Restore deleted trade | Switch to "Deleted" filter, click Restore icon | Trade moves back to "All" tab |

#### 3.2.8 Table / Card View Toggle

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-44 | Default is table view | Navigate to /log-trade | Table visible, card grid hidden |
| JF-45 | Switch to card view | Click "Card" button | Card grid renders, table hidden |
| JF-46 | Switch back to table | Click "Table" button | Table visible again |

#### 3.2.9 Filter Tabs

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-47 | "All" shows non-deleted trades | Click "All" | All non-deleted trades visible |
| JF-48 | "Win" filters winning trades | Click "Win" | Only trades with result="win" visible |
| JF-49 | "Loss" filters losing trades | Click "Loss" | Only trades with result="loss" visible |
| JF-50 | "Breakeven" filters breakeven | Click "Breakeven" | Only trades with result="breakeven" visible |
| JF-51 | "Deleted" shows soft-deleted | Click "Deleted" | Only deleted trades visible (with Restore buttons) |

#### 3.2.10 Stats Strip

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-52 | Total P&L matches filtered trades | Filter to "Win" | Total P&L = sum of winning trades' pnl |
| JF-53 | Avg Win calculation | 3 win trades with pnl 100, 200, 300 | Avg Win = $200.00 |
| JF-54 | Trade count matches filter | Filter "Loss", 2 losses exist | Trades stat = 2 |

#### 3.2.11 NY Timezone Handling

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-55 | Trade date displays in NY timezone | Create trade at UTC midnight (which is 7PM/8PM NY) | Entry Time column shows NY local time |
| JF-56 | DST handled correctly | Trade date in July (EDT, UTC-4) | Correct offset applied |
| JF-57 | EST handled correctly | Trade date in December (EST, UTC-5) | Correct offset applied |
| JF-58 | Session detection across midnight NY | Trade at 11:30 PM NY (Asia session starts 6:30 PM) | Session = "Asia" |

#### 3.2.12 Edge Cases & Error Handling

| ID | Case | Steps | Expected |
|---|---|---|---|
| JF-59 | Submit with empty required fields | Click "Log Trade" without filling form | Browser native validation prevents submit (required attrs) |
| JF-60 | Negative entry price | Enter -1.00 as entryPrice | Form allows (user error, but no crash) |
| JF-61 | SL > entry on LONG | LONG, entry=1.1000, SL=1.1100 | Risk points negative; risk calculation should handle gracefully |
| JF-62 | Very large lot size | lotSize = 999999 | Risk % exceeds limit, warning appears |
| JF-63 | API failure on create | Mock API to return error | `alert()` shows error message, form stays open |
| JF-64 | Network timeout | Mock network timeout | Error handled, user notified |
| JF-65 | Concurrent edit | Two browser tabs, edit same trade | Last write wins (no conflict detection currently) |

---

### 3.3 SignalChart — TEST SKELLING (Pending Implementation)

**BLOCKER:** Component does not exist yet. Tests below are a skeleton for when it is built.

#### 3.3.1 Rendering (Pending)

| ID | Case | Steps | Expected |
|---|---|---|---|
| SC-01 | Renders chart container | Mount with valid data | Chart canvas/SVG visible |
| SC-02 | Loading state | Mount with fetching=true | Skeleton/spinner visible |
| SC-03 | Empty state | Mount with empty data array | "No data" placeholder visible |

#### 3.3.2 Data Visualization (Pending)

| ID | Case | Steps | Expected |
|---|---|---|---|
| SC-04 | Candlestick/line renders | Provide OHLC data | Visual chart elements present |
| SC-05 | Time range selector | Click "1H", "4H", "1D" buttons | Chart data updates accordingly |
| SC-06 | Tooltip on hover | Hover over data point | Tooltip shows OHLC values |

#### 3.3.3 Integration (Pending)

| ID | Case | Steps | Expected |
|---|---|---|---|
| SC-07 | chartLink opens SignalChart | Click chart link on trade card | SignalChart component renders with trade data |
| SC-08 | External TradingView fallback | Invalid chartLink | Graceful fallback to TradingView embed |

---

## 4. Cross-Cutting Concerns

### 4.1 Authentication Gate

| ID | Case | Steps | Expected |
|---|---|---|---|
| CC-01 | Unauthenticated redirect | Navigate to /log-trade without login | Redirects to "/" (login page) |
| CC-02 | Unauthenticated redirect on dashboard | Navigate to /dashboard without login | Redirects to "/" |

### 4.2 WebSocket / Auto-Refresh

| ID | Case | Steps | Expected |
|---|---|---|---|
| CC-03 | Dashboard auto-refreshes | Stay on dashboard 35 seconds, create trade via API | Dashboard data updates without manual refresh |
| CC-04 | Auto-refresh interval cleanup | Navigate away from dashboard | setInterval cleared (no memory leak) |

### 4.3 Responsive Design

| ID | Case | Steps | Expected |
|---|---|---|---|
| CC-05 | Form modal scrollable on mobile | Viewport 375px, open form | Form scrolls, no horizontal overflow |
| CC-06 | Table horizontal scroll | 50+ trades, viewport 375px | Table scrolls horizontally |
| CC-07 | Stats strip 2-col on mobile | Viewport 375px | Stats grid uses `grid-cols-2` |

### 4.4 Performance

| ID | Case | Steps | Expected |
|---|---|---|---|
| CC-08 | Dashboard initial load < 3s | Cold start, authenticated | Full render in < 3 seconds |
| CC-09 | Form open < 500ms | Click "Add Trade" | Modal visible in < 500ms |
| CC-10 | Trade list render 100 items | Seed 100 trades | No visible jank, list renders < 2s |

---

## 5. Test Execution Matrix

| Suite | Cases | Automated? | Priority |
|---|---|---|---|
| DashboardCard | DC-01 to DC-23 | Unit (Vitest + RTL) | Medium |
| JournalEntryForm | JF-01 to JF-65 | E2E (Playwright) | Critical |
| SignalChart | SC-01 to SC-08 | BLOCKED — awaiting impl | N/A |
| Cross-Cutting | CC-01 to CC-10 | E2E (Playwright) | High |

**Estimated effort:**
- DashboardCard: 2-3 hours (unit tests, not full E2E)
- JournalEntryForm: 1-2 days (complex form, modals, API mocking)
- SignalChart: 0 (blocked)
- Cross-Cutting: 0.5 day

---

## 6. Risk & Recommendations

1. **SignalChart is missing.** Before E2E coverage for this component can begin, the component must exist. Recommend: create a minimal `SignalChart.tsx` stub with defined props interface, then iteratively build out chart rendering. This unblocks testing.

2. **No E2E framework installed.** Puppeteer is in `dependencies` (should be `devDependencies`) but there's no Playwright. Playwright is the industry standard for Next.js E2E. Recommendation: `npm i -D @playwright/test`, add `playwright.config.ts`.

3. **JournalEntryForm is 1700+ lines inline.** This is a maintainability concern. The form modal, delete confirmation modal, AI review modal, and all business logic (risk calc, timezone handling, session detection) are in a single page component. Recommendation: extract `TradeFormModal`, `DeleteConfirmModal`, `AIReviewModal` into separate components. This also makes testing easier.

4. **No API mocking strategy.** E2E tests need a way to mock/stub API responses (tradeService, analyticsService, etc.). Options: MSW (Mock Service Worker) or Playwright route interception.

5. **Delete uses `alert()` for feedback.** Lines 445, 459, 468, 646 use native `alert()`. In E2E tests, these block execution. Consider replacing with `sonner` toast (already a dependency). This also improves UX.

6. **Risk calculation is client-side only.** The `getContractSizeClient` function mirrors server logic. If server contract sizes change, client will be out of sync. Recommend: add an E2E test that verifies client-calculated risk % matches server-stored risk % after trade creation.

---

*Test Plan v1.0 — VERA, QA Agent*
*"If it's not tested, it's broken. You just don't know it yet."*

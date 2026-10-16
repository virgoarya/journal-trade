# Macro Terminal — Design Plan & Gap Analysis

> **Referensi**: [github.com/ErTasselli/OpenTerminal](https://github.com/ErTasselli/OpenTerminal) — terminal-style trading dashboard, Next.js 15 + Express + TypeScript, 1.4k ★, MIT.
> **Pemilik**: Tim Dev 2 (`roomId: rmt9zl3lf-a6lrd`)
> **Status**: **PLAN — belum ada implementasi.** Wajib direview sebelum coding.
> **Tanggal**: 2026-10-12

---

## 1. Tujuan

Meningkatkan halaman **Macro Terminal** Hunter Trades Journal dengan mengambil pelajaran arsitektur & UX dari OpenTerminal — khususnya **layer interaksi** (widget workspace, charting, command palette) dan **ketahanan data** (fallback chain, stale-while-revalidate) — tanpa menurunkan kedalaman analisis makro yang sudah ada.

**Non-goal**: meniru OpenTerminal secara 1:1. OpenTerminal adalah terminal pasar umum (saham/ETF/crypto/opsi/portfolio); Macro Terminal kita fokus makro institusional (yield curve, likuiditas, COT, regime, geo-risk). Yang diadopsi adalah **pola**, bukan seluruh widget.

---

## 2. Kondisi Saat Ini (Hunter Trades Macro Terminal)

**Tab** (`frontend/src/app/(dashboard)/macro-terminal/layout.tsx`): Overview · COT · Quant Lab · Nexus · Intelligence

**Komponen** (`frontend/src/components/macro-terminal/`, 30+ file):
- Regime & likuiditas: `MacroRegimePanel`, `RegimeHistoryTimeline`, `LiquidityGaugePanel`, `VixRegimePanel`
- Yield curve: `YieldCurvePanel`, `CurveExplainerPanel`, `RealYield`, `DurationRisk`, `SensitivityMatrix`, `CentralBankDifferentialsPanel`
- Positioning: `CotPanel`, `CotPanelClient`, `CotDivergenceScanner`
- Risiko: `GeoRiskRadarPanel`
- Pasar & berita: `HeatmapPanel`, `NewsFeedPanel`, `EconomicCalendarPanel`
- AI: `HunterAIReasoningPanel`, `TerminalChatPanel`, `AiPersonaChatPanel`, `AiCoachChatPanel`
- Visual: `Nexus`, `nexus/NexusNode`
- Infra: `ErrorBoundary`, `AsyncErrorBoundary`, `Skeleton`, `MacroNotificationIndicator`, `MacroTerminalContext`

**Backend** (`server/src/services/`): `macro-data.service.ts` (18 KB), `macro-regime.service.ts` (38 KB), `macro-ai.service.ts` (71 KB), `journal-macro-bridge.service.ts`
**Routes**: `/api/v1/macro-ai`, `/api/v1/macro-ai-observer`, `/api/v1/macro-regime`, `/api/v1/chat`

**Data layer** (`macro-data.service.ts`): TTL in-memory cache (`cacheStore`, `getCache`/`setCache`) + fallback **Yahoo → MT5 MCP** per-symbol + flag `fromCache`/`rateLimited`. Status bar layout sudah mengenal `live | cache | fallback | stale | error`.

**Chart library terpasang**: hanya `recharts ^3.8.1`. **Tidak ada** `lightweight-charts`, `d3`, `react-grid-layout`, `zustand`, `@tanstack/react-query`.

**Layout**: grid **hardcoded** per halaman (contoh `overview/page.tsx`: `grid grid-cols-1 xl:grid-cols-2` dengan tinggi panel dipatok manual). Tidak ada drag/resize/persist.

---

## 3. Referensi OpenTerminal — Inventaris Fitur

| # | Fitur | Detail teknis |
|---|-------|---------------|
| 1 | Widget workspace | `react-grid-layout` — drag, resize, add/remove panel; layout disimpan lokal (Zustand persist) dan dipulihkan saat reload |
| 2 | Command palette | `⌘K` — cari saham/ETF/crypto, langsung lompat ke simbol |
| 3 | Charting profesional | `lightweight-charts` — candlestick/bar/line/area, volume, 8 timeframe (1D→MAX), indikator SMA/EMA/VWAP/Bollinger/RSI/MACD, hover legend OHLC+volume+nilai indikator |
| 4 | Quote panel | last/bid/ask/OHLC, volume, mcap, P/E, EPS, div yield, 52w range, beta, shares outstanding |
| 5 | News feed | agregasi + de-duplikasi multi RSS, per-simbol atau global |
| 6 | Screener pasar penuh | filter sektor/mcap/%change/volume, sortable semua kolom |
| 7 | Sector heatmap live | treemap ukuran=mcap, warna=%change harian, refresh tiap beberapa detik |
| 8 | Options chain | calls/puts berdampingan, strike, bid/ask, volume, OI, highlight ITM |
| 9 | Crypto board | top aset + sparkline 7 hari, dominance BTC/ETH, OHLCV charting |
| 10 | Macro dashboard | yield curve UST live, VIX, proxy indeks/komoditas |
| 11 | Portfolio tracker | log buy/sell, avg cost, realized & unrealized P&L (SQLite) |
| 12 | Calendar | event ekonomi (Fed/ECB/CPI/NFP) forecast+previous+actual; earnings calendar |
| 13 | AI assistant | Q&A konteks simbol yang sedang dilihat |
| 14 | Near real-time | quote & indeks refresh tiap detik + flash halus saat berubah |
| 15 | Keyboard shortcuts | `⌘K` cari, `⌥1`–`⌥9` tambah widget |
| 16 | Data resilience | tiap endpoint punya fallback chain (mis. Quotes: Nasdaq → Yahoo → Stooq) + cache stale-while-revalidate |
| 17 | Provider modular | `server/src/providers/` — satu modul kecil per sumber, swap 30 menit |

---

## 4. Gap Analysis

Legenda prioritas: **P0** = wajib untuk pengalaman "terminal" · **P1** = nilai tinggi · **P2** = polish · **N/A** = tidak relevan untuk makro.

| # | Fitur | OpenTerminal | Hunter Trades (sekarang) | Prioritas | Aksi |
|---|-------|--------------|--------------------------|-----------|------|
| 1 | **Charting harga** | `lightweight-charts`, 8 TF, 6 indikator | ❌ tidak ada (hanya recharts) | **P0** | Pasang `lightweight-charts`; buat `MacroPriceChart` untuk indeks/komoditas/DXY/yield |
| 2 | **Widget workspace** | drag/resize/persist | ❌ grid hardcoded | **P0** | `react-grid-layout` + Zustand persist; layout default per tab |
| 3 | **Command palette** | `⌘K` | ❌ tidak ada | **P0** | CommandPalette: lompat tab, cari instrumen makro, toggle widget |
| 4 | **Data fallback chain** | 3-deep + SWR | ⚠️ parsial (Yahoo→MT5, TTL cache, tanpa SWR) | **P0** | Tambah fallback ke-3 (FRED/Stooq) + stale-while-revalidate di `macro-data.service` |
| 5 | **Real-time flash-on-change** | refresh 1s + flash | ⚠️ belum konsisten | **P1** | Hook `useFlashOnChange`; poll adaptif (1s saat aktif, pause saat tab hidden) |
| 6 | **Screener** | pasar penuh, sortable | ❌ tidak ada | **P1** | Screener instrumen makro: indeks, FX major, komoditas, yield — filter & sort |
| 7 | **Sparkline** | watchlist 7-hari | ❌ tidak ada | **P1** | Sparkline inline di ticker strip / watchlist makro |
| 8 | **Keyboard shortcuts** | `⌘K`, `⌥1`–`⌥9` | ❌ tidak ada | **P2** | `⌥1`–`⌥9` tambah widget, `⌘K` palette |
| 9 | **Provider modular** | 1 modul/sumber | ⚠️ tercampur di 1 service | **P2** | Pecah `macro-data.service` → `providers/{yahoo,mt5,fred,stooq}.ts` |
| 10 | Options chain | ✅ | ❌ | **N/A** | Tidak relevan makro — skip |
| 11 | Crypto board | ✅ | ❌ | **N/A** | Bukan fokus makro — skip (kecuali BTC/ETH sebagai proxy likuiditas) |
| 12 | Portfolio tracker | ✅ | ✅ (Trade Journal) | **N/A** | Sudah ada di modul Journal |
| 13 | Earnings calendar | ✅ | ⚠️ economic calendar ada, earnings tidak | **N/A** | Fokus makro = event makro, bukan earnings |
| 14 | AI assistant konteks | ✅ | ✅ (4 panel AI + Nexus) | — | **Sudah lebih kaya** dari referensi |

**Kesimpulan gap**: kedalaman analisis makro kita **sudah melampaui** OpenTerminal (COT, regime, geo-risk, nexus, quant lab tidak ada di referensi). Yang tertinggal adalah **layer interaksi** (widget workspace, charting, command palette) dan **ketahanan data** (fallback chain 3-level + SWR).

---

## 5. Design Specification

### 5.1 Widget Workspace (P0)
- Library: `react-grid-layout` (MIT, ringan) + `zustand` (persist ke `localStorage` key `macro-terminal:layout:<tab>`).
- Setiap panel dibungkus `<WidgetShell>` baru: header (ikon, judul, status data, menu) + body + drag handle.
- Tombol **"Reset Layout"** di header halaman → pulihkan layout default tab.
- Layout default per tab disimpan sebagai konstanta (`DEFAULT_LAYOUTS`), sehingga pengguna baru langsung dapat susunan yang benar.
- Persistensi: `{ tab: { i: widgetId, x, y, w, h }[] }`. Migrasi: kalau versi layout berubah, fallback ke default.

### 5.2 Charting Engine (P0)
- Library: `lightweight-charts` (TradingView, MIT) — dipakai OpenTerminal, ukuran kecil, performa canvas tinggi.
- Komponen baru: `MacroPriceChart` — props `{ symbol, timeframe, indicators[] }`.
- Timeframe: `1D, 5D, 1M, 3M, 6M, 1Y, 5Y, MAX`.
- Indikator awal: **SMA(20/50), EMA(21), VWAP, Bollinger, RSI(14), MACD(12,26,9)** — hitung di `lib/indicators.ts` (fungsi murni, ada unit test).
- Hover legend: OHLC + volume + nilai indikator pada candle yang di-hover.
- Sumber data: endpoint baru `GET /api/v1/macro/candles?symbol=&tf=` (backend: Yahoo chart API → fallback Stooq).
- Instrumen default: `^GSPC`, `^NDX`, `DX-Y.NYB`, `GC=F`, `CL=F`, `^VIX`, `^TNX`.

### 5.3 Command Palette (P0)
- `⌘K` / `Ctrl+K` → overlay `CommandPalette`.
- Sumber perintah: (a) lompat tab, (b) cari & buka instrumen makro di chart, (c) toggle visibilitas widget, (d) aksi cepat (Refresh, Reset Layout, Export).
- Implementasi: `cmdk` (MIT, kecil) atau custom `<dialog>` + filter fuzzy. Prefer `cmdk` bila bundle impact < 10 KB.
- Keyboard: `↑↓` navigasi, `Enter` eksekusi, `Esc` tutup.

### 5.4 Data Layer — Fallback Chain + SWR (P0)
- Restrukturisasi `macro-data.service.ts` → `server/src/services/macro/providers/`:
  - `yahoo.provider.ts` (primary), `mt5.provider.ts` (fallback 1), `stooq.provider.ts` (fallback 2), `fred.provider.ts` (yield/VIX/CPI — primary untuk seri FRED).
- Interface seragam: `fetchQuotes(symbols)`, `fetchCandles(symbol, tf)`, `fetchSeries(seriesId)`.
- Cache: **stale-while-revalidate** — sajikan cache lama segera, refresh di background; tandai `stale: true` bila melewati TTL.
- Status per-sumber tetap mengalir ke `MarketStatusBar` (`live | cache | fallback | stale | error`).
- Rate limit: hormati `rateLimited` flag; backoff eksponensial per provider.

### 5.5 Real-time & Flash-on-Change (P1)
- Hook `useFlashOnChange(value)` → kelas `flash-up`/`flash-down` 600 ms saat nilai berubah.
- Poll adaptif: interval 1 s **hanya saat tab visible dan widget di viewport**; `visibilitychange` → pause; `IntersectionObserver` → pause widget di luar layar.
- Hormati aturan LESSONS: jangan polling saat tab background.

### 5.6 Screener & Sparkline (P1)
- **Screener**: tabel instrumen makro (indeks, FX major, komoditas, yield) — kolom: nama, last, %chg, 52w range, yield, sparkline. Filter: kategori, %chg, arah. Sortable semua kolom.
- **Sparkline**: komponen ringan (SVG path, tanpa library) — 7 hari close. Dipakai di ticker strip & screener.

### 5.7 Layout Final per Tab
- **Overview**: Regime · Chart utama · Liquidity · Heatmap · AI Reasoning · Economic Calendar · News
- **COT**: COT panel · Divergence scanner · Chart positioning
- **Quant Lab**: Yield curve · Real yield · Duration risk · Sensitivity matrix · CB differentials
- **Nexus**: Nexus (existing) + panel konteks
- **Intelligence**: AI panels + News + Screener

---

## 6. Rencana Implementasi Bertahap

### Fase 0 — Fondasi (P0) · estimasi 3–4 hari
| Task | Deliverable | Owner |
|------|-------------|-------|
| 0.1 Pasang deps | `lightweight-charts`, `react-grid-layout`, `zustand`, `cmdk` | forge |
| 0.2 `WidgetShell` + `WidgetWorkspace` | wrapper + grid + persist | nova |
| 0.3 Refactor `macro-data.service` → providers + SWR | `providers/*`, `cache.ts` | axis |
| 0.4 Layout default per tab | `DEFAULT_LAYOUTS` | lyra |

### Fase 1 — Charting + Palette (P0) · estimasi 4–5 hari
| Task | Deliverable | Owner |
|------|-------------|-------|
| 1.1 Endpoint candles | `GET /api/v1/macro/candles` + provider | axis |
| 1.2 `lib/indicators.ts` + unit test | SMA/EMA/VWAP/BB/RSI/MACD | riku |
| 1.3 `MacroPriceChart` + hover legend | komponen chart | nova |
| 1.4 `CommandPalette` + keybindings | `⌘K`, `⌥1`–`⌥9` | nova |

### Fase 2 — Screener + Sparkline (P1) · estimasi 3 hari
| Task | Deliverable | Owner |
|------|-------------|-------|
| 2.1 Screener makro | tabel filter+sort | nova |
| 2.2 Sparkline + ticker strip | komponen SVG | riku |
| 2.3 `useFlashOnChange` + poll adaptif | hook + integrasi | nova |

### Fase 3 — Polish & Hardening (P2) · estimasi 2 hari
| Task | Deliverable | Owner |
|------|-------------|-------|
| 3.1 Pecah provider modular penuh | `providers/*` bersih | axis |
| 3.2 A11y: fokus, aria, keyboard nav | audit + fix | lyra |
| 3.3 Test & QA | unit + e2e + bundle check | vera |
| 3.4 Dokumentasi | `docs/` + USER_GUIDE | sage |

---

## 7. Acceptance Criteria

1. Layout Macro Terminal bisa di-drag, resize, dan **tersimpan** setelah reload.
2. Chart harga tampil untuk minimal 7 instrumen default, 8 timeframe, 6 indikator, hover legend benar.
3. `⌘K` membuka palette; pencarian instrumen & lompat tab berfungsi; `Esc` menutup.
4. Bila provider primary down, data tetap tampil dari fallback dan status bar menunjukkan `FALLBACK`/`STALE` — **UI tidak blank**.
5. Tidak ada polling saat tab background (verifikasi via DevTools Performance).
6. `npx tsc --noEmit` 0 error di `frontend` & `server`; `npx vitest run` hijau.
7. Bundle EXE tetap ter-build via `buildHooks/buildApp.js` tanpa error.
8. Tidak ada regresi pada panel makro existing (regime, liquidity, COT, yield).

---

## 8. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| `lightweight-charts` menambah ukuran bundle | Bundle EXE membesar | Ukur sebelum/sesudah; dynamic import komponen chart |
| `react-grid-layout` bentrok dengan layout dashboard | UI rusak | Isolasi hanya di dalam `/macro-terminal`; layout default sebagai fallback |
| Provider gratis rate-limited / berubah | Data kosong | Fallback chain 3-level + SWR; tampilkan status, jangan blank |
| Persistensi layout korup | Halaman rusak | Validasi skema layout saat load; fallback ke default |
| Regresi panel existing | Fitur hilang | Fase 0 tidak mengubah logika panel — hanya membungkus |

---

## 9. Pembagian Tugas Tim Dev 2

| Agent | Peran | Scope |
|-------|-------|-------|
| **axis** | Backend | Providers + SWR cache, endpoint candles, refactor `macro-data.service` |
| **nova** | Frontend | `WidgetShell`/`WidgetWorkspace`, `MacroPriceChart`, `CommandPalette`, Screener |
| **riku** | App Builder | `lib/indicators.ts`, Sparkline, komponen pendukung |
| **lyra** | UX/Product | Layout default per tab, a11y, review UX |
| **forge** | DevOps | Dependency, bundle size, build EXE verification |
| **kira** | AI/Orchestration | Integrasi panel AI existing dengan workspace baru |
| **vera** | QA | Test plan, verifikasi acceptance criteria |
| **sage** | Docs/DX | Dokumentasi fitur + USER_GUIDE |

---

## 10. Keputusan yang Dibutuhkan (sebelum Fase 0)

1. **Chart library**: setuju pakai `lightweight-charts` (sama seperti referensi) atau tetap `recharts`?
2. **Widget workspace**: full drag/resize (seperti referensi) atau preset layout saja (lebih sederhana)?
3. **Scope crypto/options**: dikonfirmasi **skip** (fokus makro)?
4. **Prioritas**: mulai dari Fase 0 (fondasi) atau langsung charting?

---

## 11. Dokumen Desain Terkait (hasil workstream Tim Dev 2)

| Dokumen | Isi | Baris |
|---------|-----|-------|
| [design/macro-widget-workspace-spec.md](design/macro-widget-workspace-spec.md) | Arsitektur 5 komponen (`WidgetWorkspaceProvider`, `WidgetGrid`, `WidgetShell`, `WidgetRegistry`, `DEFAULT_LAYOUTS`), grid 12-col 5 breakpoint, skema Zustand persist + validasi, interaksi drag/resize/add/hide/reset, mobile stacked <768px, a11y, mapping 16 panel existing → widgetId, layout default 5 tab | 667 |
| [design/macro-charting-and-palette-spec.md](design/macro-charting-and-palette-spec.md) | `MacroPriceChart` (lightweight-charts) + 8 timeframe + 6 indikator (rumus & signature), hover legend, `CommandPalette` (cmdk, ⌘K, 4 kategori, fuzzy search), endpoint `GET /api/v1/macro/candles` (Yahoo→Stooq→Cache + SWR), strategi test, acceptance criteria | 1191 |
| [design/macro-data-layer-spec.md](design/macro-data-layer-spec.md) | Provider modular (`yahoo`/`mt5`/`stooq`/`fred`/`tradingview`/`finnhub`/`rss`), interface seragam per tipe data, fallback chain per endpoint, SWR (TTL + stale window + background revalidation), rate limit & backoff, mapping status → MarketStatusBar, facade pattern untuk backward compat | 615 |

**Total: 2.473 baris spesifikasi desain.**

## 12. Keputusan Terkonsolidasi — ✅ DISETUJUI (2026-10-12)

Dari master plan (§10) + spec widget workspace (§17). **Semua rekomendasi di-ACC oleh Bang Vir** — implementasi Fase 0 boleh dimulai.

| # | Pertanyaan | Keputusan |
|---|-----------|-----------|
| 1 | Chart library: `lightweight-charts` vs tetap `recharts`? | ✅ **`lightweight-charts`** |
| 2 | Widget workspace: full drag/resize vs preset layout saja? | ✅ **Full drag/resize** (`react-grid-layout`) |
| 3 | Library grid: `react-grid-layout` vs `dnd-kit` + custom? | ✅ **`react-grid-layout`** |
| 4 | Mobile: stacked-only vs drag di mobile? | ✅ **Stacked-only <768px** |
| 5 | Add widget UX: modal picker vs toolbar dropdown? | ✅ **Modal picker** (reuse Command Palette) |
| 6 | Hide vs Remove widget: keduanya vs Remove saja? | ✅ **Keduanya** |
| 7 | Feature flag rollout? | ✅ **Ya** — `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED` |
| 8 | Scope crypto/options | ✅ **Skip** — fokus makro |
| 9 | Prioritas mulai | ✅ **Fase 0 (fondasi)** dulu |

---

*Dokumen ini adalah PLAN yang sudah disetujui. Eksekusi mengikuti [design/FASE_0_EXECUTION.md](design/FASE_0_EXECUTION.md).*

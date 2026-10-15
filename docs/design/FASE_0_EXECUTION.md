# Fase 0 — Execution Brief: Macro Terminal Widget Workspace

> **Plan induk**: [MACRO_TERMINAL_DESIGN_PLAN.md](../MACRO_TERMINAL_DESIGN_PLAN.md) (§6 Fase 0, §12 keputusan ✅ DISETUJUI)
> **Spec**: [macro-widget-workspace-spec.md](macro-widget-workspace-spec.md) · [macro-data-layer-spec.md](macro-data-layer-spec.md) · [macro-charting-and-palette-spec.md](macro-charting-and-palette-spec.md)
> **Tim**: Tim Dev 2 (`rmt9zl3lf-a6lrd`)
> **Status**: READY TO EXECUTE — keputusan sudah di-ACC 2026-10-12

---

## 1. Dependency Order (WAJIB diikuti)

```
0.1 Deps install (forge)
      │
      ├──► 0.2 WidgetShell + WidgetWorkspace (nova)
      │          │
      │          └──► 0.4 DEFAULT_LAYOUTS + integrasi tab (lyra)
      │
      └──► 0.3 Data layer providers + SWR (axis)   ← independen, bisa paralel
```

- **0.1 harus selesai lebih dulu** — 0.2 butuh `react-grid-layout` + `zustand` terpasang.
- **0.3 independen** dari 0.1/0.2 — boleh jalan paralel.
- **0.4 setelah 0.2** — butuh `WidgetRegistry` dari nova.

---

## 2. Task 0.1 — Pasang Dependencies · Owner: **forge** — ✅ **SELESAI 2026-10-12**

**Hasil**:
| Library | Versi terpasang | Peer React | Status |
|---------|----------------|-----------|--------|
| `lightweight-charts` | 5.2.1 | — | ✅ |
| `react-grid-layout` | 2.3.0 | `>= 16.3.0` | ✅ |
| `zustand` | 5.0.15 | `>= 18` | ✅ |
| `cmdk` | 1.1.1 | `^18 \|\| ^19` | ✅ |

- `npm run typecheck` → **0 error** ✅
- `npm run build` → **exit 0** ✅
- `@types/react-grid-layout` **tidak** dipasang (paket v2 punya types sendiri) ✅
- `--legacy-peer-deps` **tidak** diperlukan ✅
- Baseline `.next`: 406 MB → 408 MB (deps belum di-import, dampak minimal)
- ⏳ **Pending**: verifikasi `buildHooks/buildApp.js` (EXE) — dijalankan saat 0.2/0.3 masuk bundle, karena saat ini belum ada kode yang meng-import lib baru.

<details><summary>Perintah asli (arsip)</summary>

**Goal**: Pasang 4 library baru di `frontend/` tanpa merusak build EXE.

**Command** (✅ risiko peer-dep sudah diverifikasi 2026-10-12):
```bash
cd "D:/Journal Trade/frontend"
npm install lightweight-charts react-grid-layout zustand cmdk
```

**✅ Verifikasi kompatibilitas (sudah dicek)**:

| Library | Versi | Peer React | Status |
|---------|-------|-----------|--------|
| `react-grid-layout` | **2.3.0** | `>= 16.3.0` | ✅ kompatibel React 19 |
| `cmdk` | **1.1.1** | `^18 \|\| ^19` | ✅ |
| `zustand` | **5.0.15** | `>= 18.0.0` | ✅ |
| `lightweight-charts` | **5.2.1** | — (framework-agnostic) | ✅ |

**⚠️ Catatan penting**:
- **JANGAN pasang `@types/react-grid-layout`** — `react-grid-layout@2.3.0` sudah mengirim types sendiri (`dist/index.d.ts`). Memasang `@types/` justru bisa menimpa types bawaan.
- **`react-grid-layout` v2.3.0 = major bump dari v1.x**. Spec ditulis merujuk pola v1 — **verifikasi API surface v2** (`npm view react-grid-layout` → repo, atau baca `node_modules/react-grid-layout/dist/index.d.ts`) sebelum implementasi. Kalau API berubah signifikan dan menyulitkan, fallback ke `react-grid-layout@1.5.4` (peer-nya juga masih kompatibel).
- `npm install` biasa seharusnya cukup — **`--legacy-peer-deps` TIDAK diperlukan**.

**Acceptance criteria**:
- [ ] `frontend/package.json` memuat 4 deps (tanpa `@types/react-grid-layout`).
- [ ] `npm run typecheck` → 0 error.
- [ ] `npm run build` → sukses.
- [ ] Bundle EXE tetap ter-build: `cd ../desktop && node buildHooks/buildApp.js` → "Build Complete".
- [ ] Ukuran bundle sebelum/sesudah dicatat (baseline vs +4 lib).

**Verifikasi**:
```bash
cd "D:/Journal Trade/frontend" && npm run typecheck && npm run build
```

---

## 3. Task 0.2 — `WidgetShell` + `WidgetWorkspace` · Owner: **nova** — ✅ **SELESAI 2026-10-12**

**Hasil** (diverifikasi mandiri setelah subagent dihentikan karena thrashing):

| Cek | Hasil |
|-----|-------|
| File dibuat | 6 file, **1.062 baris** di `frontend/src/components/macro-terminal/workspace/` |
| Panel existing disentuh? | ❌ **Tidak** — `git status` hanya `?? workspace/` |
| API `react-grid-layout` v2 | ✅ `useContainerWidth()`, `gridConfig`, `dragConfig`, `compactor={verticalCompactor}` |
| Feature flag | ✅ `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED` (`WidgetWorkspaceProvider.tsx:322`) |
| Persist + validasi | ✅ `macro-terminal:layout:<tab>` + `validateTabLayout()` + `isValidLayoutItem()` |
| Mobile stacked | ✅ `<768px` tanpa drag (`WidgetGrid.tsx:90`) |
| ARIA/keyboard | ✅ 10 kemunculan di `WidgetShell.tsx` |
| `npm run typecheck` | ✅ **0 error** |
| `npm run build` | ✅ **exit 0** |

**File**: `types.ts` (130) · `DEFAULT_LAYOUTS.ts` (48, minimal Overview — dilengkapi di 0.4) · `WidgetGrid.tsx` (132) · `WidgetRegistry.tsx` (170) · `WidgetShell.tsx` (259) · `WidgetWorkspaceProvider.tsx` (323)

> **Catatan proses**: subagent sempat thrashing — membunuh build-nya sendiri dan `rm -rf .next/cache` karena bingung membedakan proses background. Verifikasi diambil alih manual. Lihat LESSONS.

<details><summary>Brief asli (arsip)</summary>

**Goal**: Buat fondasi widget workspace **tanpa mengubah 30+ panel existing**.

**File baru** (ikuti spec §2 & §14):
```
frontend/src/components/macro-terminal/workspace/
├── WidgetWorkspaceProvider.tsx   # context + state
├── WidgetGrid.tsx                # react-grid-layout wrapper
├── WidgetShell.tsx               # header + body + drag handle + menu
├── WidgetRegistry.tsx            # daftar widgetId → komponen
└── DEFAULT_LAYOUTS.ts            # (diisi lyra di 0.4)
```

**Kontrak wajib**:
- Panel existing **tidak diubah** — mereka sudah menerima `className` prop (lihat `HeatmapPanel`, `LiquidityGaugePanel`). `WidgetShell` yang membungkus.
- `WidgetShell` props: `{ id, title, icon?, status?, onHide?, onRemove?, children, className? }` — detail di spec §4.
- Feature flag: jika `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED !== "true"`, render grid hardcoded lama (safe rollout, keputusan #7).
- Mobile (<768px): stacked-only, tanpa drag (keputusan #4).
- Persist ke `localStorage` key `macro-terminal:layout:<tab>` + **validasi skema** saat load → fallback ke default bila korup.
- A11y: `role`, `aria-label`, keyboard nav (spec §8).

**⚠️ API `react-grid-layout@2.3.0` BERBEDA dari v1 — WAJIB baca ini**

Spec widget workspace ditulis merujuk pola **v1**. Versi terpasang adalah **v2.3.0** yang berbasis **hooks** + config-object. Perbedaan konkret:

| v1 (yang mungkin dirujuk spec) | v2.3.0 (yang terpasang) |
|--------------------------------|--------------------------|
| `<GridLayout cols={12} rowHeight={40} margin={[10,10]}>` | `<GridLayout gridConfig={{ cols: 12, rowHeight: 40, margin: [10,10] }}>` |
| `width` auto-measure | **`width: number` WAJIB** → pakai `useContainerWidth()` |
| `<Responsive breakpoints={} layouts={}>` | `<ResponsiveGridLayout>` / hook `useResponsiveLayout()` |
| `draggableHandle=".handle"` | `dragConfig={{ handle: '.handle' }}` |
| `isDraggable` / `isResizable` | `dragConfig={{ enabled }}` / `resizeConfig={{ enabled }}` |

**Props `GridLayout` v2**: `children`, `width` (wajib, px), `layout?`, `gridConfig?`, `dragConfig?`, `resizeConfig?`, `dropConfig?`, `positionStrategy?`, `compactor?`, `constraints?`, `droppingItem?`, `autoSize?`

**`GridConfig`**: `cols` (default 12) · `rowHeight` (default 150) · `margin` (`[number, number]`, default `[10,10]`) · `containerPadding` (`[number,number] \| null`) · `maxRows`

**`LayoutItem`**: `{ i: string; x: number; y: number; w: number; h: number; minW?; minH?; maxW?; maxH? }`

**Hooks v2**:
- `useContainerWidth(): { width, mounted, containerRef }` — attach `containerRef` ke wrapper, render grid hanya saat `mounted`.
- `useGridLayout({ layout, cols, preventCollision?, onLayoutChange?, compactor? })` — state drag/resize.
- `useResponsiveLayout({ width, breakpoints, layouts, ... })` — breakpoint handling.

**Pola yang disarankan** (ganti pola v1 di spec §2):
```tsx
const { width, containerRef, mounted } = useContainerWidth();
const { layout, onLayoutChange } = useGridLayout({
  layout: DEFAULT_LAYOUTS[tab],
  cols: 12,
  onLayoutChange: (l) => persist(tab, l),
});

return (
  <div ref={containerRef}>
    {mounted && (
      <GridLayout
        width={width}
        layout={layout}
        gridConfig={{ cols: 12, rowHeight: 40, margin: [12, 12] }}
        dragConfig={{ handle: ".widget-drag-handle" }}
        onLayoutChange={onLayoutChange}
      >
        {children}
      </GridLayout>
    )}
  </div>
);
```

> Fallback bila v2 dirasa terlalu berbeda: `npm install react-grid-layout@1.5.4` (peer juga kompatibel React 19) — tapi v2 jalur utama, v1 hanya jalan keluar.

**Acceptance criteria**:
- [ ] `WidgetShell` merender panel existing tanpa error.
- [ ] Drag & resize berfungsi; layout tersimpan setelah reload.
- [ ] Layout korup → otomatis fallback ke default (tidak blank).
- [ ] Feature flag OFF → tampilan lama tetap jalan (tidak ada regresi).
- [ ] `npm run typecheck` → 0 error.

**Verifikasi**:
```bash
cd "D:/Journal Trade/frontend" && npm run typecheck
# manual: buka /macro-terminal/overview, drag 1 panel, reload, cek posisi bertahan
```

---

## 4. Task 0.3 — Data Layer: Providers + SWR · Owner: **axis** — ✅ **SELESAI 2026-10-12**

**Hasil** (diverifikasi mandiri — typecheck, test, dan review kode):

| Cek | Hasil |
|-----|-------|
| File dibuat | 9 file, **960 baris** di `server/src/services/macro/` |
| Facade pattern | ✅ `macro-data.service.ts` lama jadi re-export tipis (`@deprecated` + `export { macroDataService } from "./macro/macro-data.service"`) |
| Pemanggil existing | ✅ `market-data.service.ts` & `__tests__/macro-data.test.ts` **tidak diubah** — masih import path lama |
| Fallback chain | ✅ `fallback.ts`: Yahoo → MT5 → Stooq, per-symbol + exponential backoff |
| SWR | ✅ `cache.ts`: `ttl` + `staleWindow` terpisah, `isStale()`, eviction di luar stale window |
| File di luar scope | ✅ tidak ada — hanya `macro-data.service.ts` + `macro/` yang tersentuh |
| `npm run typecheck` | ✅ **0 error** |
| `npx vitest run` | ✅ **92/92 pass** (19 file) |

**File**: `cache.ts` (57) · `fallback.ts` (78) · `index.ts` (48) · `macro-data.service.ts` (512) · `providers/{types 97, yahoo 44, mt5 43, stooq 38, fred 43}`

<details><summary>Brief asli (arsip)</summary>

**Goal**: Pecah `server/src/services/macro-data.service.ts` jadi provider modular + stale-while-revalidate, **tanpa mengubah API publik** (facade pattern).

**File baru** (ikuti spec §2, §3, §13):
```
server/src/services/macro/
├── cache.ts                      # SWR cache (TTL + stale window + background revalidation)
├── providers/
│   ├── types.ts                  # IQuoteProvider, ISeriesProvider, ICalendarProvider, INewsProvider, ICandleProvider
│   ├── yahoo.provider.ts
│   ├── mt5.provider.ts
│   ├── stooq.provider.ts
│   └── fred.provider.ts
└── index.ts                      # facade: macroDataService (API publik TIDAK berubah)
```

**Aturan wajib**:
- **Facade pattern** — semua pemanggil `macroDataService.*` existing **tidak boleh diubah**. Cari dulu: `search_files pattern='macro-data.service|macroDataService'`.
- Fallback chain: Quotes `Yahoo → MT5 → Stooq`; News `Finnhub → RSS`; FRED tanpa fallback (keputusan spec §14).
- SWR: sajikan cache lama segera, revalidate di background (fire-and-forget). TTL per tipe: quotes 2 min, yield 10 min, news 1 min; stale window max 5 min.
- Status mengalir ke `MarketStatusBar`: `live | cache | fallback | stale | error`.
- **JANGAN cetak API key / connection string** — pakai placeholder (`FRED_API_KEY`, `FINNHUB_API_KEY`, `MT5_MCP_URL`).
- Rate limit: backoff eksponensial per provider.

**Acceptance criteria**:
- [ ] API publik `macroDataService` tidak berubah (grep pemanggil → 0 perubahan).
- [ ] Simulasi provider primary down → data tetap keluar dari fallback, status `FALLBACK`.
- [ ] Cache lewat TTL → tetap disajikan dengan status `STALE` + revalidate background.
- [ ] `npm run typecheck` → 0 error; `npx vitest run` hijau.

**Verifikasi**:
```bash
cd "D:/Journal Trade/server" && npm run typecheck && npx vitest run
```

---

## 5. Task 0.4 — DEFAULT_LAYOUTS + Integrasi Tab · Owner: **lyra** — ✅ **SELESAI 2026-10-12**

**Hasil** (dikerjakan manual oleh parent — tidak didelegasikan, karena menyentuh halaman existing):

| Item | Hasil |
|------|-------|
| `DEFAULT_LAYOUTS.ts` | ✅ 5 tab lengkap: overview (6 widget), cot (1), quant-lab (3), nexus (1), intelligence (2) |
| `WidgetRegistry.tsx` | ✅ +3 widget: `curve-explainer`, `central-bank-differentials`, `agent-intelligence` |
| 5 halaman terintegrasi | ✅ `overview`, `cot`, `quant-lab`, `nexus`, `intelligence` |
| Legacy fallback | ✅ tiap halaman punya `<LegacyXxx />` — flag OFF = tampilan lama **utuh, tanpa perubahan** |
| Feature flag | ✅ `frontend/.env` → `true` (uji) · `.env.example` → `false` (default aman) |
| `npm run typecheck` | ✅ **0 error** |
| `npm run build` | ✅ **exit 0** |

**Pola integrasi** (seragam di 5 halaman):
```tsx
const enabled = useWidgetWorkspaceEnabled();
if (!enabled) return <LegacyXxx />;            // regresi = nol
return (
  <WidgetWorkspaceProvider tab="xxx" enabled>
    <WidgetGrid tab="xxx">
      <div key="widget-id">
        <WidgetShell widgetId="widget-id" title="…" icon={Icon}>
          <ExistingPanel className="h-full" />   {/* panel TIDAK diubah */}
        </WidgetShell>
      </div>
    </WidgetGrid>
  </WidgetWorkspaceProvider>
);
```

**Catatan operasional**:
- `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED` di-**inline saat build** (Next.js) — mengubah `.env` saja tidak cukup, **harus rebuild**.
- `desktop/buildHooks/buildApp.js` mengecualikan `.env` dari bundle, tapi nilai `NEXT_PUBLIC_*` sudah ter-inline di JS hasil build, jadi flag tetap berlaku di EXE.
- Untuk mematikan workspace: set `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED=false` di `frontend/.env`, lalu rebuild.

<details><summary>Brief asli (arsip)</summary>

**Goal**: Susun layout default per tab + integrasi ke halaman.

**File**:
- `frontend/src/components/macro-terminal/workspace/DEFAULT_LAYOUTS.ts` (baru)
- `frontend/src/app/(dashboard)/macro-terminal/*/page.tsx` (ubah — bungkus grid hardcoded dengan `WidgetWorkspace`)

**Layout default** (spec §10):
| Tab | Widget |
|-----|--------|
| Overview | Regime · Chart utama · Liquidity · Heatmap · AI Reasoning · Economic Calendar · News |
| COT | COT · Divergence Scanner · Chart positioning |
| Quant Lab | Yield Curve · Real Yield · Duration Risk · Sensitivity Matrix · CB Differentials |
| Nexus | Nexus + panel konteks |
| Intelligence | AI panels · News · Screener |

**Acceptance criteria**:
- [ ] 5 tab punya layout default valid.
- [ ] Mapping 16 panel existing → widgetId lengkap (spec §9).
- [ ] Reset Layout → kembali ke default tab.
- [ ] `npm run typecheck` → 0 error.

---

## 6. Definition of Done — Fase 0 — ✅ **SELESAI 2026-10-12**

| # | Kriteria | Status |
|---|----------|--------|
| 1 | 4 deps terpasang & build tetap hijau | ✅ `lightweight-charts` 5.2.1 · `react-grid-layout` 2.3.0 · `zustand` 5.0.15 · `cmdk` 1.1.1 |
| 2 | Widget workspace jalan dengan persistensi | ✅ kode ter-bundle (`macro-terminal-workspace`, `widget-drag-handle`, `react-grid-layout` semua ada di client chunk) |
| 3 | Data layer SWR + fallback chain, API publik tidak berubah | ✅ facade pattern; `market-data.service.ts` & test lama tak berubah; 92/92 test |
| 4 | Layout default 5 tab tersedia | ✅ overview/cot/quant-lab/nexus/intelligence |
| 5 | `typecheck` + `vitest` hijau | ✅ frontend typecheck 0 error · server typecheck 0 error · 92/92 test |
| 6 | Feature flag OFF = tidak ada regresi | ✅ tiap halaman punya `<LegacyXxx />` yang identik dengan JSX lama |
| 7 | Tidak ada panel existing yang diubah logikanya | ✅ panel hanya dibungkus `WidgetShell` |

**Dampak bundle (terukur)**:
| Metrik | Nilai |
|--------|-------|
| Chunk halaman macro-terminal | overview 72.8 KB · intelligence 60.3 KB · quant-lab 36.7 KB · cot 32.6 KB · nexus 28.8 KB |
| Total client JS (`.next/static/chunks`) | 2.8 MB |
| `lightweight-charts` di bundle | 0 (tree-shaken — untuk Fase 1) |
| `cmdk` di bundle | 0 (tree-shaken — untuk Fase 1) |
| Flag `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED` | ✅ ter-inline (nama env var hilang dari client chunk) |

**Sisa (bukan bagian Fase 0)**:
- ⏳ Build EXE (`desktop/buildHooks/buildApp.js`) — belum dijalankan setelah 0.4; perlu untuk menguji workspace di aplikasi desktop.
- Fase 1 (charting + command palette), Fase 2 (screener + sparkline), Fase 3 (polish) — lihat master plan §6.

<details><summary>Kriteria asli (arsip)</summary>

1. 4 deps terpasang & build EXE tetap hijau.
2. Widget workspace jalan di `/macro-terminal/overview` dengan persistensi.
3. Data layer SWR + fallback chain jalan, API publik tidak berubah.
4. Layout default 5 tab tersedia.
5. `npm run typecheck` + `npx vitest run` hijau di frontend & server.
6. Feature flag OFF = tidak ada regresi.
7. **Tidak ada panel existing yang diubah logikanya** — hanya dibungkus.

---

## 7. Catatan Dispatch

Room `Tim Dev` (`rmt9zl3lf-a6lrd`) **tidak bisa dikirim pesan dari sesi CLI/agent** — `message_agent` hanya aktif di sesi berjudul `Bot Chat`, dan cron `--deliver` tidak mendukung target room.
Untuk menugaskan ke tim: tempel brief per-owner di atas ke **Desktop → Routines**, atau jalankan tiap task sebagai workstream paralel dari sesi agent.

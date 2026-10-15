# Widget Workspace — Design Specification (Macro Terminal)

> **Status**: DESAIN — belum ada implementasi. Dokumen ini adalah kontrak untuk implementasi.
> **Pemilik**: Tim Dev 2 (`roomId: rmt9zl3lf-a6lrd`)
> **Tanggal**: 2026-10-12
> **Berdasarkan**: `docs/MACRO_TERMINAL_DESIGN_PLAN.md` §5.1 (Widget Workspace P0)

---

## 1. Tujuan & Scope

### 1.1 Tujuan

Mengganti grid **hardcoded** di setiap halaman Macro Terminal (contoh: `overview/page.tsx` pakai `grid grid-cols-1 xl:grid-cols-2` + tinggi panel dipatok manual) dengan **widget workspace** yang bisa di-drag, di-resize, ditambah/dihapus, dan **tersimpan otomatis** setelah reload — mengadopsi pola dari [OpenTerminal](https://github.com/ErTasselli/OpenTerminal) (react-grid-layout + Zustand persist).

### 1.2 Scope

| In | Out |
|---|---|
| Drag & resize panel di semua tab Macro Terminal | Charting engine (`lightweight-charts`) — lihat spec terpisah |
| Add/remove widget dari layout | Command Palette `⌘K` — lihat spec terpisah |
| Persist layout per-tab ke localStorage | Data fallback chain + SWR — lihat spec terpisah |
| Layout default per tab (`DEFAULT_LAYOUTS`) | Screener & Sparkline — lihat spec terpisah |
| Reset layout ke default | OTA / Electron builder |
| WidgetShell (header + body + drag handle) | |
| Responsive: desktop grid, mobile stack | |
| A11y: keyboard nav, focus management, aria | |

### 1.3 Non-goal

- **Bukan** pengganti panel existing — 30+ komponen di `frontend/src/components/macro-terminal/` tetap dipakai, hanya dibungkus `<WidgetShell>`.
- **Bukan** layout system untuk seluruh dashboard — hanya untuk route `/macro-terminal/*`.
- **Bukan** multi-workspace / multi-profile per-user — satu layout per-tab per-browser (localStorage).

---

## 2. Arsitektur Komponen

```
MacroTerminalLayout (layout.tsx)
├── <ErrorBoundary>                          // sudah ada
│   └── <MacroTerminalProvider>              // sudah ada (data context)
│       └── <WidgetWorkspaceProvider>        // BARU — layout state (Zustand)
│           └── <WidgetGrid>                 // BARU — react-grid-layout wrapper
│               └── <WidgetShell>            // BARU — wrapper per panel
│                   └── <ExistingPanel />    // komponen existing (HeatmapPanel, dll)
```

### 2.1 Komponen Baru

| Komponen | File | Tanggung Jawab |
|---|---|---|
| `WidgetWorkspaceProvider` | `frontend/src/components/macro-terminal/WidgetWorkspaceContext.tsx` | State layout (Zustand persist), provide ke children |
| `WidgetGrid` | `frontend/src/components/macro-terminal/WidgetGrid.tsx` | Wrapper react-grid-layout, render children |
| `WidgetShell` | `frontend/src/components/macro-terminal/WidgetShell.tsx` | Header (drag handle, judul, menu, status) + body |
| `WidgetRegistry` | `frontend/src/components/macro-terminal/widgetRegistry.ts` | Definisi widget yang bisa ditambah (id, komponen, icon, defaultSize, minSize) |
| `DEFAULT_LAYOUTS` | `frontend/src/lib/macro/defaultLayouts.ts` | Layout default per tab |

### 2.2 Komponen Existing (tidak diubah)

- `MacroTerminalProvider` / `useMacroTerminal` — tetap sebagai data context
- `ErrorBoundary` / `AsyncErrorBoundary` / `Skeleton` — tetap dipakai di dalam panel
- Semua panel makro (30+) — **tidak diubah isinya**, hanya cara pemanggilan di page

---

## 3. Layout & Grid System

### 3.1 Library

| Library | Versi | Alasan |
|---|---|---|
| `react-grid-layout` | ^1.5.0 (MIT) | Drag, resize, persist — dipakai OpenTerminal |
| `zustand` | ^5.0.0 | State management + persist middleware ke localStorage |

### 3.2 Grid Konfigurasi

| Properti | Nilai | Keterangan |
|---|---|---|
| `cols` | `{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }` | 12-col desktop, turun ke 2-col mobile |
| `rowHeight` | `60px` | Tinggi minimum per baris |
| `margin` | `[12, 12]` | Gap antar widget (px) |
| `containerPadding` | `[0, 0]` | Padding grid container |
| `compactType` | `"vertical"` | Widget naik mengisi ruang kosong |
| `isDraggable` | `true` | Semua widget bisa di-drag |
| `isResizable` | `true` | Semua widget bisa di-resize |
| `isBounded` | `false` | Widget tidak dibatasi container |
| `useCSSTransforms` | `true` | GPU-accelerated transform |
| `transformScale` | `1` | Tidak ada zoom |
| `preventCollision` | `false` | Widget boleh overlap (drag bebas) |

### 3.3 Breakpoint

| Breakpoint | Lebar | Cols | Catatan |
|---|---|---|---|
| `lg` | ≥1024px | 12 | Desktop penuh |
| `md` | 768–1023px | 10 | Tablet landscape |
| `sm` | 640–767px | 6 | Tablet portrait |
| `xs` | 480–639px | 4 | Mobile landscape |
| `xxs` | <480px | 2 | Mobile portrait |

---

## 4. WidgetShell Design

### 4.1 Kontrak Props

```ts
interface WidgetShellProps {
  /** ID unik widget (harus match key di layout) */
  widgetId: string;
  /** Judul panel (ditampilkan di header) */
  title: string;
  /** Ikon header (lucide-react component) */
  icon?: React.ComponentType<{ className?: string }>;
  /** Status data panel (live/cache/fallback/stale/error) */
  dataStatus?: DataStatus;
  /** Badge kanan header (opsional — mis. regime, countdown) */
  headerBadge?: React.ReactNode;
  /** Widget children (isi panel) */
  children: React.ReactNode;
  /** Tambah class ke body */
  bodyClassName?: string;
  /** Widget bisa di-hide (default: true) */
  hideable?: boolean;
  /** Widget bisa di-remove (default: true) */
  removable?: boolean;
  /** Widget bisa di-refresh (default: false — panel existing punya sendiri) */
  refreshable?: boolean;
}
```

### 4.2 Struktur Visual

```
┌─────────────────────────────────────────────────────┐
│ [≡] [icon] Widget Title          [status] [⋮] [✕] │  ← Header (drag handle)
├─────────────────────────────────────────────────────┤
│                                                     │
│                  Panel Body                         │  ← Existing panel content
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.3 Header Spec

| Elemen | Detail |
|---|---|
| **Drag Handle** | Area header penuh (kecuali tombol) — cursor `grab` → `grabbing` saat drag |
| **Icon** | Kiri header, ukuran 14px, warna `text-accent-gold` |
| **Title** | `font-mono uppercase tracking-wider text-[11px] sm:text-xs` |
| **Status Badge** | Kanan header — indicator `live/cache/fallback/stale/error` (dot + label) |
| **Menu (⋮)** | Dropdown: Hide, Remove, Refresh (kalau refreshable), Reset Position |
| **Close (✕)** | Hapus widget dari layout (bukan hide) |

### 4.4 Kelas Tailwind (Design Token)

```ts
// Wrapper
"glass overflow-hidden relative flex flex-col w-full"

// Header
"flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-white/[0.02] shrink-0"

// Drag handle indicator
"cursor-grab active:cursor-grabbing"

// Body
"flex-1 min-h-0 p-3 overflow-hidden"

// Status dot (pakai token yang ada, jangan hardcoded hex)
// live:     bg-data-profit
// cache:    bg-data-warning
// fallback: bg-data-warning
// stale:    bg-text-muted
// error:    bg-data-loss
```

> **Aturan**: JANGAN hardcode hex color. Selalu pakai token Tailwind: `text-data-profit`, `text-data-loss`, `text-data-warning`, `text-text-muted`, `border-border-subtle`, `bg-bg-surface`, `text-accent-gold`.

---

## 5. State Management & Persistensi

### 5.1 Zustand Store Schema

```ts
interface WidgetLayoutItem {
  i: string;        // widgetId
  x: number;        // kolom (0-indexed)
  y: number;        // baris (0-indexed)
  w: number;        // lebar (grid units)
  h: number;        // tinggi (grid units)
  minW?: number;    // minimum lebar
  minH?: number;    // minimum tinggi
}

interface TabLayout {
  items: WidgetLayoutItem[];
  hidden: string[];  // widgetId yang di-hide (masih ada di items, cuma tidak dirender)
}

interface WidgetWorkspaceState {
  layouts: Record<string, TabLayout>;  // key = tab name (overview, cot, dll)
  activeTab: string;
  version: number;  // schema version untuk migrasi
  // Actions
  setLayout: (tab: string, layout: TabLayout) => void;
  updateWidget: (tab: string, widgetId: string, updates: Partial<WidgetLayoutItem>) => void;
  addWidget: (tab: string, widgetId: string, position?: { x: number; y: number }) => void;
  removeWidget: (tab: string, widgetId: string) => void;
  toggleHide: (tab: string, widgetId: string) => void;
  resetLayout: (tab: string) => void;
  resetAll: () => void;
  importLayout: (tab: string, layout: TabLayout) => void;  // untuk restore dari backup
}
```

### 5.2 Persistensi

| Properti | Nilai |
|---|---|
| Storage | `localStorage` |
| Key | `macro-terminal:layout:<tab>` |
| Deserialize | Validasi skema; kalau korup → fallback ke `DEFAULT_LAYOUTS[tab]` |
| Migrasi | Field `version` — kalau beda, pakai default (layout user hilang, acceptable) |
| Debounce | `300ms` sebelum write ke localStorage |
| Per-tab | Tiap tab punya layout sendiri, disimpan terpisah |

### 5.3 Validasi Saat Load

```ts
// Pseudocode validasi layout
function validateLayout(raw: unknown, tab: string): TabLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const layout = raw as TabLayout;
  if (!Array.isArray(layout.items)) return null;
  // Cek setiap item punya field wajib
  for (const item of layout.items) {
    if (!item.i || typeof item.x !== 'number' || typeof item.y !== 'number' ||
        typeof item.w !== 'number' || typeof item.h !== 'number') return null;
    // Clamp nilai masuk akal
    if (item.x < 0 || item.y < 0 || item.w < 1 || item.h < 1) return null;
    if (item.w > 12 || item.h > 50) return null;
  }
  return layout;
}
```

---

## 6. Interaksi

### 6.1 Drag

| Aspek | Spesifikasi |
|---|---|
| Trigger | Drag dari header WidgetShell (bukan dari body) |
| Visual saat drag | Widget lain geser (reflow), drag ghost semi-transparent |
| Batas | Widget bisa dipindah ke posisi mana saja (tidak bounded) |
| Z-index saat drag | 50 (di atas widget lain) |
| Snap | Snap ke grid saat mendekati posisi (threshold 50%) |
| Mobile | Drag disabled di layar < 768px (stacked layout) |

### 6.2 Resize

| Aspek | Spesifikasi |
|---|---|
| Handle | 8 direction (N, NE, E, SE, S, SW, W, NW) |
| Visual | Resize handle terlihat saat hover di edge widget |
| Min size | Per-widget `minW` / `minH` (dari WidgetRegistry) |
| Max size | Tidak ada (bisa penuh container) |
| Mobile | Resize disabled di layar < 768px |

### 6.3 Add Widget

| Aspek | Spesifikasi |
|---|---|
| Trigger | Tombol "+ Add Widget" di header halaman, atau Command Palette |
| Pilihan | Modal/grid picker: semua widget dari WidgetRegistry yang belum ada di layout |
| Posisi default | Cari slot kosong pertama (bawah kanan), kalau tidak ada → spawn di `(0, maxHeight)` |
| Animation | Fade-in + scale 0.95→1.0, durasi 200ms |

### 6.4 Remove Widget

| Aspek | Spesifikasi |
|---|---|
| Trigger | Tombol ✕ di header WidgetShell, atau menu ⋮ → Remove |
| Confirm | Tidak perlu confirm (bisa di-add ulang) |
| Animasi | Fade-out + scale 1.0→0.95, durasi 150ms |
| Data | Layout langsung ke-save, widget hilang dari state |

### 6.5 Hide Widget

| Aspek | Spesifikasi |
|---|---|
| Trigger | Menu ⋮ → Hide, atau eye icon |
| State | Widget masuk array `hidden`, tidak dirender tapi tetap di layout items |
| Restore | Tombol "Show Hidden" di header halaman → pilih widget untuk tampilkan |
| Visual | Widget yang hidden tidak menempati ruang di grid |

### 6.6 Reset Layout

| Aspek | Spesifikasi |
|---|---|
| Trigger | Tombol "Reset Layout" di header halaman, atau menu ⋮ → Reset |
| Confirm | `confirm("Reset layout to default? Your custom layout will be lost.")` |
| Aksi | `resetLayout(tab)` → ganti dengan `DEFAULT_LAYOUTS[tab]` |
| Scope | Per-tab (reset tab saat ini, bukan semua) |

---

## 7. Responsive & Mobile

### 7.1 Mobile Strategy (< 768px)

| Aspek | Spesifikasi |
|---|---|
| Drag | **Disabled** — tidak ada drag di mobile |
| Resize | **Disabled** — tidak ada resize di mobile |
| Layout | **Stacked** — semua widget tampil full-width, urutan dari layout items |
| Toggle | Tombol "Edit Layout" di header → enable drag/resize sementara |
| Scroll | Vertical scroll natural (bukan grid) |
| Add/Remove | Bisa tetap dipakai (modal picker) |

### 7.2 Transition

- Widget resize/drag pakai CSS transform + transition 150ms ease-out.
- Layout re-flow saat resize pakai FLIP animation (react-grid-layout default).
- Page-level resize (browser window) → grid auto-adjust via `WidthProvider`.

---

## 8. Accessibility

### 8.1 Keyboard Navigation

| Aksi | Kunci |
|---|---|
| Buka Command Palette | `Ctrl+K` / `⌘K` |
| Navigasi widget | `Tab` → fokus masuk ke header widget |
| Drag widget | `Alt + ↑↓←→` (keyboard-driven drag) |
| Resize widget | `Alt + Shift + ↑↓←→` |
| Remove widget | `Alt + Delete` (saat widget fokus) |
| Hide widget | `Alt + H` |
| Reset layout | `Alt + R` |
| Escape | Tutup modal/menu |

### 8.2 ARIA

| Elemen | Attribute |
|---|---|
| WidgetShell root | `role="region"` `aria-label="{title}"` |
| Drag handle | `role="button"` `aria-label="Drag {title}"` `aria-grabbed` |
| Header title | `role="heading"` `aria-level="3"` |
| Status badge | `role="status"` `aria-live="polite"` |
| Menu trigger | `aria-haspopup="true"` `aria-expanded` |
| Grid container | `role="list"` |
| Widget item | `role="listitem"` |
| Hidden widget | `aria-hidden="true"` |
| Add Widget modal | `role="dialog"` `aria-modal="true"` `aria-labelledby` |

### 8.3 Focus Management

- Saat widget di-drag, fokus tetap di header widget (jangan pindah ke body).
- Saat widget di-remove, fokus pindah ke widget sebelahnya (atau tombol Add Widget).
- Saat modal Add Widget terbuka, fokus trap di dalam modal.
- Focus ring visible: `focus-visible:ring-2 ring-accent-gold/50`.

---

## 9. Integrasi dengan Panel Existing

### 9.1 Kontrak Integrasi

Setiap panel existing (30+) **tidak perlu diubah** — cukup dibungkus:

```tsx
// SEBELUM (overview/page.tsx)
<MacroRegimePanel className="h-full min-h-[500px]" />
<HeatmapPanel className="h-full min-h-[500px]" />

// SESUDAH
<WidgetShell widgetId="macro-regime" title="Macro Regime" icon={Activity}>
  <MacroRegimePanel className="h-full" />
</WidgetShell>
```

### 9.2 Mapping Panel → Widget ID

| Widget ID | Komponen | Default Size | Min Size |
|---|---|---|---|
| `macro-regime` | `MacroRegimePanel` | 6×8 | 4×6 |
| `liquidity-gauge` | `LiquidityGaugePanel` | 6×8 | 4×6 |
| `heatmap` | `HeatmapPanel` | 6×6 | 4×4 |
| `ai-reasoning` | `HunterAIReasoningPanel` | 6×6 | 4×4 |
| `economic-calendar` | `EconomicCalendarPanel` | 6×5 | 3×4 |
| `news-feed` | `NewsFeedPanel` | 6×5 | 3×4 |
| `vix-regime` | `VixRegimePanel` | 6×6 | 4×4 |
| `yield-curve` | `YieldCurvePanel` | 6×7 | 4×5 |
| `cot-panel` | `CotPanel` | 6×8 | 4×6 |
| `cot-divergence` | `CotDivergenceScanner` | 6×6 | 4×4 |
| `geo-risk` | `GeoRiskRadarPanel` | 6×6 | 4×4 |
| `nexus` | `Nexus` | 12×10 | 6×8 |
| `screener` | `Screener` (P1, belum ada) | 12×8 | 8×6 |
| `macro-price-chart` | `MacroPriceChart` (P0, belum ada) | 6×7 | 4×5 |
| `ai-coach-chat` | `AiCoachChatPanel` | 4×8 | 3×6 |
| `ai-persona-chat` | `AiPersonaChatPanel` | 4×8 | 3×6 |

> Catatan: ukuran dalam grid units (w × h), dengan 12-col dan `rowHeight=60px`. Contoh: `6×8` = setengah lebar × tinggi 480px.

### 9.3 Status Data Flow

WidgetShell membaca `dataStatus` dari context untuk menampilkan indicator live/stale/error di header:

```tsx
// Di dalam WidgetShell
const { dataStatus } = useMacroTerminal();
// Mapping widgetId → field dataStatus
// macro-regime → dataStatus.regime
// liquidity-gauge → dataStatus.liquidity
// heatmap → dataStatus.quotes
// vix-regime → dataStatus.quant
// news-feed → dataStatus.news
// economic-calendar → dataStatus.calendar
// geo-risk → dataStatus.geoRisk
// cot-panel → dataStatus.cot
// nexus → dataStatus.nexus
```

---

## 10. Layout Default per Tab

### 10.1 Overview

```
┌──────────────────────────┬──────────────────────────┐
│ macro-regime (6×8)       │ heatmap (6×6)            │
├──────────────────────────┼──────────────────────────┤
│ ai-reasoning (6×6)       │ liquidity-gauge (6×6)    │
├──────────────────────────┴──────────────────────────┤
│ economic-calendar (6×5)  │ news-feed (6×5)          │
└──────────────────────────┴──────────────────────────┘
```

### 10.2 COT

```
┌──────────────────────────┬──────────────────────────┐
│ cot-panel (6×8)          │ cot-divergence (6×6)     │
├──────────────────────────┼──────────────────────────┤
│ macro-price-chart (12×7) │                          │
└──────────────────────────┴──────────────────────────┘
```

### 10.3 Quant Lab

```
┌──────────────────────────┬──────────────────────────┐
│ yield-curve (6×7)        │ real-yield (6×6)         │
├──────────────────────────┼──────────────────────────┤
│ duration-risk (6×6)      │ sensitivity-matrix (6×6) │
├──────────────────────────┴──────────────────────────┤
│ central-bank-differentials (12×5)                   │
└─────────────────────────────────────────────────────┘
```

### 10.4 Nexus

```
┌─────────────────────────────────────────────────────┐
│ nexus (12×12)                                       │
├──────────────────────────┬──────────────────────────┤
│ geo-risk (6×6)           │ ai-reasoning (6×6)       │
└──────────────────────────┴──────────────────────────┘
```

### 10.5 Intelligence

```
┌──────────────────────────┬──────────────────────────┐
│ ai-coach-chat (4×8)      │ news-feed (8×8)          │
├──────────────────────────┼──────────────────────────┤
│ ai-persona-chat (4×8)    │ economic-calendar (8×5)  │
└──────────────────────────┴──────────────────────────┘
```

---

## 11. Error Handling & Edge Cases

### 11.1 Layout Korup

| Kasus | Handling |
|---|---|
| localStorage berisi JSON tidak valid | Fallback ke `DEFAULT_LAYOUTS[tab]`, console.error |
| Layout version beda | Fallback ke default, increment version |
| Widget ID tidak dikenal (registry berubah) | Skip widget yang tidak dikenal, render sisanya |
| Layout items kosong | Render pesan "No widgets. Add one." + tombol Add |

### 11.2 Data Kosong

| Kasus | Handling |
|---|---|
| Semua widget di-hide | Tampilkan tombol "Show Hidden Widgets" |
| Panel existing error | ErrorBoundary existing tetap jalan di dalam body |
| WidgetShell dataStatus error | Header badge merah + body tetap render panel |

### 11.3 Mobile Edge Case

| Kasus | Handling |
|---|---|
| User resize browser ke mobile saat drag | Drag otomatis cancel, widget kembali ke posisi semula |
| Layout desktop terlalu kompleks untuk mobile | Stack semua widget full-width, pertahankan urutan |
| Layar sangat kecil (<360px) | 2-col grid, font tetap terbaca |

### 11.4 Konflik dengan Layout Lain

Widget workspace hanya dipakai di route `/macro-terminal/*`. Layout dashboard utama **tidak terubah**.

---

## 12. Testing Strategy

### 12.1 Unit Test (Vitest)

| Test | File | Kasus |
|---|---|---|
| `validateLayout` | `widgetWorkspace.test.ts` | Valid, korup, empty, version mismatch |
| `WidgetWorkspaceProvider` | `widgetWorkspace.test.ts` | addWidget, removeWidget, toggleHide, resetLayout |
| `WidgetShell` | `WidgetShell.test.ts` | Render, menu actions, status badge |

### 12.2 Integration Test (Playwright)

| Test | Kasus |
|---|---|
| Drag widget | Pindah posisi, layout tersimpan |
| Resize widget | Ukuran berubah, layout tersimpan |
| Reload page | Layout restored dari localStorage |
| Add widget | Muncul di layout, bisa di-drag |
| Remove widget | Hilang dari layout, localStorage update |
| Hide widget | Tidak render, bisa di-restore |
| Reset layout | Kembali ke default |
| Mobile layout | Stacked, tidak bisa drag |

### 12.3 Manual QA Checklist

- [ ] Drag semua widget di Overview
- [ ] Resize semua widget di Overview
- [ ] Reload → layout sama
- [ ] Buka tab lain → layout beda
- [ ] Reset layout → default
- [ ] Add widget → drag → remove
- [ ] Hide widget → show again
- [ ] Mobile 768px → stacked
- [ ] Mobile 360px → 2-col
- [ ] Semua panel existing render dengan benar di dalam WidgetShell
- [ ] Status live/stale/error muncul di header
- [ ] Console error: 0
- [ ] Bundle size: +< 30KB (react-grid-layout + zustand)

---

## 13. Migration Path dari Grid Hardcoded

### 13.1 Langkah Migrasi

| Langkah | Action | File |
|---|---|---|
| 1 | Install deps | `react-grid-layout`, `zustand` |
| 2 | Buat `WidgetWorkspaceContext.tsx` | Baru |
| 3 | Buat `WidgetShell.tsx` | Baru |
| 4 | Buat `WidgetGrid.tsx` | Baru |
| 5 | Buat `widgetRegistry.ts` | Baru |
| 6 | Buat `defaultLayouts.ts` | Baru |
| 7 | Update `layout.tsx` — bungkus children dengan `WidgetWorkspaceProvider` + `WidgetGrid` | Ubah |
| 8 | Update tiap page (`overview`, `cot`, `quant-lab`, `nexus`, `intelligence`) — bungkus panel dengan `WidgetShell` | Ubah |
| 9 | Hapus grid hardcoded dari page (biar WidgetGrid yang render) | Ubah |
| 10 | Test di semua breakpoint | QA |

### 13.2 Rollback Plan

- WidgetShell bisa di-disable via prop `enableWorkspace={false}` di layout.tsx.
- Kalau disable: page fallback ke grid hardcoded (simpan kode lama di comment atau branch).
- Atau: pakai feature flag `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED`.

---

## 14. File yang Akan Dibuat/Diubah

### 14.1 File Baru

| File | Deskripsi |
|---|---|
| `frontend/src/components/macro-terminal/WidgetWorkspaceContext.tsx` | Zustand store + provider |
| `frontend/src/components/macro-terminal/WidgetShell.tsx` | Widget wrapper (header + body) |
| `frontend/src/components/macro-terminal/WidgetGrid.tsx` | react-grid-layout wrapper |
| `frontend/src/components/macro-terminal/widgetRegistry.ts` | Definisi widget yang tersedia |
| `frontend/src/lib/macro/defaultLayouts.ts` | Layout default per tab |
| `frontend/src/components/macro-terminal/WidgetShell.test.tsx` | Unit test WidgetShell |
| `frontend/src/components/macro-terminal/widgetWorkspace.test.ts` | Unit test store |

### 14.2 File yang Diubah

| File | Perubahan |
|---|---|
| `frontend/src/app/(dashboard)/macro-terminal/layout.tsx` | Bungkus children dengan WidgetWorkspaceProvider |
| `frontend/src/app/(dashboard)/macro-terminal/overview/page.tsx` | Bungkus panel dengan WidgetShell |
| `frontend/src/app/(dashboard)/macro-terminal/cot/page.tsx` | Bungkus panel dengan WidgetShell |
| `frontend/src/app/(dashboard)/macro-terminal/quant-lab/page.tsx` | Bungkus panel dengan WidgetShell |
| `frontend/src/app/(dashboard)/macro-terminal/nexus/page.tsx` | Bungkus panel dengan WidgetShell |
| `frontend/src/app/(dashboard)/macro-terminal/intelligence/page.tsx` | Bungkus panel dengan WidgetShell |

### 14.3 File yang Tidak Diubah

- Semua 30+ panel existing di `frontend/src/components/macro-terminal/`
- `MacroTerminalContext.tsx`
- `ErrorBoundary`, `AsyncErrorBoundary`, `Skeleton`
- Backend services

---

## 15. Acceptance Criteria

1. Layout Macro Terminal bisa di-drag, resize, dan **tersimpan** setelah reload.
2. Semua tab (Overview, COT, Quant Lab, Nexus, Intelligence) punya layout default yang benar.
3. Widget bisa di-add, di-remove, di-hide, dan di-restore.
4. Layout default per tab (`DEFAULT_LAYOUTS`) tersedia dan bisa di-reset.
5. Mobile (<768px) menampilkan stacked layout, tidak bisa drag/resize.
6. Keyboard navigation berfungsi (Tab, Alt+Arrow, Escape).
7. ARIA attributes lengkap di semua interactive elements.
8. Semua 30+ panel existing render dengan benar di dalam WidgetShell.
9. Status live/stale/error tampil di header widget.
10. Layout korup → fallback ke default, tidak crash.
11. `npx tsc --noEmit` 0 error.
12. `npx vitest run` semua test hijau.
13. Bundle size tambahan < 30KB.
14. Tidak ada regresi pada panel existing.

---

## 16. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| `react-grid-layout` menambah bundle | Bundle EXE membesar | Dynamic import `WidgetGrid` (lazy load) |
| Layout localStorage korup | User lihat layout kosong | Validasi skema + fallback default |
| Panel existing pakai `className="h-[400px]"` | Tinggi tidak responsif di grid | WidgetShell body pakai `h-full`, grid yang atur tinggi |
| Drag di mobile tidak usable | UX jelek | Disable drag di <768px, tampilkan stacked |
| Zustand persist bentrok dengan SSR | Hydration mismatch | Gunakan `skipHydration` atau load di `useEffect` |
| Tab switch reset layout | User frustrasi | Layout per-tab terpisah di store |
| Banyak widget → perf drop | Lag saat drag | Batasi maks 20 widget per tab, virtualize kalau perlu |

---

## 17. Keputusan yang Dibutuhkan

1. **Library grid**: setuju pakai `react-grid-layout` (seperti referensi) atau alternatif lain (mis. `dnd-kit` + custom grid)?
2. **Mobile strategy**: stacked-only (lebih sederhana) atau tetap bisa drag di mobile (lebih kompleks)?
3. **Add widget UX**: modal picker (seperti Command Palette) atau toolbar dropdown?
4. **Hide vs Remove**: dua-duanya ada, atau cukup Remove saja?
5. **Feature flag**: pakai `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED` untuk safe rollout, atau langsung enable?

---

*Dokumen ini adalah DESAIN/SPEC. Implementasi dimulai setelah keputusan di §17 disetujui.*

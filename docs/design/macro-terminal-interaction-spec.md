# Macro Terminal — Spesifikasi Desain Interaksi

> **Proyek**: Hunter Trades Journal — Macro Terminal
> **Status**: DRAFT (belum diimplementasikan)
> **Tanggal**: 2026-10-13
> **Bahasa**: Indonesia
> **Referensi**:
> - [macro-charting-and-palette-spec.md](./macro-charting-and-palette-spec.md)
> - [macro-widget-workspace-spec.md](./macro-widget-workspace-spec.md)
> - [macro-data-layer-spec.md](./macro-data-layer-spec.md)
> - [MEMORY.md](../.kilo/MEMORY.md) — arsitektur & state saat ini

---

## 1. Tujuan & Scope

### 1.1 Tujuan

Dokumen ini mendefinisikan **kontrak interaksi** untuk Macro Terminal — mencakup kebijakan keyboard shortcut, alur toggle widget, mapping ikon, standar aksesibilitas, dan acceptance criteria untuk 9 temuan audit yang terverifikasi. Tujuannya adalah memastikan semua interaksi konsisten, dapat diakses, dan tidak menimbulkan kebingungan pengguna.

### 1.2 Scope

| In | Out |
|----|-----|
| Kebijakan shortcut global & keybinding | Perubahan struktur provider (widget workspace ↔ command palette) |
| Alur hide/show/remove/reset widget | Penambahan shortcut baru di luar scope spec ini |
| Mapping widgetId → ikon Lucide | Perubahan komponen panel existing |
| Checklist aksesibilitas (a11y) | Perubahan backend data provider |
| Acceptance criteria 9 temuan audit | Perubahan feature flag `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED` |

### 1.3 Non-goal

- **Bukan** implementasi kode — dokumen ini murni desain/kontrak.
- **Bukan** spesifikasi visual/detail CSS — lihat `macro-widget-workspace-spec.md` untuk token & styling.
- **Bukan** perubahan arsitektur provider data — lihat `macro-data-layer-spec.md`.

---

## 2. Latar Belakang: Temuan Audit

Sebelum masuk ke spesifikasi, berikut adalah 9 temuan audit yang terverifikasi menjadi dasar dokumen ini:

| # | Temuan | Akar Masalah | Dampak |
|---|--------|--------------|--------|
| 1 | 7 dari 21 perintah Command Palette NO-OP senyap | `onToggleWidget` (6 perintah "Toggle Widget") dan `onResetLayout` ("Reset Layout") tidak pernah di-pass dari `layout.tsx`. `CommandPaletteProvider` ada di `layout.tsx`, sedangkan `WidgetWorkspaceProvider` ada di dalam masing-masing page → layout tidak punya akses `useWidgetWorkspace()`. | User mengeksekusi perintah toggle widget atau reset layout, tidak terjadi apa-apa. Tidak ada feedback error. |
| 2 | Tombol "Chart" di Macro Screener no-op di tab Intelligence | Chart hanya ada di `overview/page.tsx`, jadi event `macro:open-instrument` tidak punya pendengar di tab lain. | User klik "Chart" di screener pada tab Intelligence/COT/Quant Lab/Nexus, tidak terjadi apa-apa. |
| 3 | Provider RSS menghasilkan 0 berita (terbukti runtime) | Bridge rss2json menolak ketiga feed; nitter.net HTTP 410 (mati permanen); Yahoo 429. | Widget News Feed kosong di semua tab. |
| 4 | Chart tidak ada di branch widget workspace | `DEFAULT_LAYOUTS.overview` hanya 6 widget, tanpa slot `price-chart`. | Bila feature flag `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED` dinyalakan, chart hilang dan wiring Command Palette ikut mati di branch itu. |
| 5 | Shortcut yang ditampilkan UI tidak berfungsi | `commands.ts` menampilkan `Alt+1..Alt+5` (tab) dan `Cmd+R` (refresh), tapi hanya `Ctrl+K` yang terdaftar di listener `useCommandPalette.tsx`. | User menekan shortcut yang dipromosikan di UI, tidak terjadi apa-apa. |
| 6 | Kalender tanpa satuan | `tradingview.provider.ts` membaca `item.unit` yang tidak ada di response TradingView (yang ada: `currency`, `scale`). | Kolom satuan di economic calendar kosong atau menampilkan nilai salah. |
| 7 | `cmd.action()` default = `console.log` | Tidak ada fallback/explisit handler untuk aksi perintah. | Setiap aksi menulis log sampah ke console, tidak ada aksi yang dieksekusi. |
| 8 | `selectedIndex`/`setSelectedIndex` di CommandPaletteContext = state mati | `cmdk` menangani navigasi sendiri, state ini tidak pernah dibaca untuk rendering. | Code smell — state yang tidak digunakan, membingungkan maintainer. |
| 9 | Ikon widget di-override jadi `Eye` untuk semua di `WIDGET_COMMANDS` | `Eye` ditetapkan sebagai ikon untuk semua perintah widget, menimpa ikon spesifik (Calendar, Newspaper, Brain). | Semua perintah widget terlihat identik, tidak ada diferensiasi visual. |

---

## 3. Kebijakan Shortcut Global

### 3.1 Prinsip Umum

| Prinsip | Penjelasan |
|---------|-----------|
| **Konsistensi platform** | Shortcut harus bekerja di Windows (Ctrl) dan macOS (Cmd). |
| **Tidak bentrok** | Shortcut tidak boleh bertabrakan dengan shortcut bawaan OS/Electron. |
| **Discoverable** | Shortcut yang didukung harus ditampilkan di UI (Command Palette). |
| **Prediktabel** | Shortcut harus mengikuti konvensi yang sudah dikenal user. |

### 3.2 Daftar Shortcut Resmi

Berikut adalah shortcut global yang **RESMI** dan didukung oleh Macro Terminal:

| Shortcut | Aksi | Kategori | Keterangan |
|----------|------|----------|-----------|
| `Ctrl+K` (Win/Linux) / `Cmd+K` (macOS) | Buka Command Palette | Global | Toggle — tekan lagi untuk menutup |
| `Esc` | Tutup overlay / menu / palette | Global | Focus kembali ke elemen sebelumnya |
| `Alt+1` | Navigasi ke tab Overview | Tab | |
| `Alt+2` | Navigasi ke tab COT | Tab | |
| `Alt+3` | Navigasi ke tab Quant Lab | Tab | |
| `Alt+4` | Navigasi ke tab Nexus | Tab | |
| `Alt+5` | Navigasi ke tab Intelligence | Tab | |
| `↑` / `↓` | Navigasi item di Command Palette | Palette | Hanya aktif saat palette terbuka |
| `Enter` | Eksekusi perintah terpilih di Command Palette | Palette | Hanya aktif saat palette terbuka |
| `Backspace` | Hapus karakter terakhir di input palette | Palette | Hanya aktif saat palette terbuka |

### 3.3 Shortcut yang TIDAK Didukung (Dilarang)

Berikut adalah shortcut yang **TIDAK BOLEH** dipakai sebagai shortcut aplikasi:

| Shortcut | Alasan Dilarang | Alternatif |
|----------|-----------------|-----------|
| `Ctrl+R` / `Cmd+R` | **Bentrok dengan reload Electron** (F5/Ctrl+R = reload window). | Hapus label shortcut refresh dari UI. Aksi refresh tetap bisa dipanggil via Command Palette (tanpa shortcut) atau tombol di panel. |
| `Ctrl+T` / `Cmd+T` | Bentrok dengan "New Tab" di browser/Electron. | Tidak dipakai. |
| `Ctrl+N` / `Cmd+N` | Bentrok dengan "New Window" di browser/Electron. | Tidak dipakai. |
| `Ctrl+W` / `Cmd+W` | Bentrok dengan "Close Tab/Window" di browser/Electron. | Tidak dipakai. |
| `Ctrl+F` / `Cmd+F` | Bentrok dengan "Find in Page" di browser/Electron. | Tidak dipakai. |
| `F1` – `F12` | Fungsi keys — beberapa dipakai OS (F11 fullscreen, F12 DevTools). | Tidak dipakai. |

> **ATURAN PENTING**: Label shortcut refresh (`Cmd+R`) **HARUS dihapus dari UI** Command Palette. Aksi "Refresh All Data" tetap ada di palette sebagai perintah yang bisa dieksekusi, tetapi **tanpa shortcut**. Shortcut ini tidak akan pernah didukung karena konflik dengan reload Electron.

### 3.4 Perbandingan dengan Shortcut Sebelumnya

| Shortcut | Status Sebelum | Status Sesudah | Perubahan |
|----------|----------------|----------------|-----------|
| `Ctrl+K` / `Cmd+K` | Sudah berfungsi | Tetap | Tidak berubah |
| `Esc` | Tidak konsisten | Resmi | Selalu tutup overlay + focus return |
| `Alt+1` – `Alt+5` | Ditampilkan di UI, tidak terdaftar di listener | Resmi | Listener ditambahkan di `layout.tsx` |
| `↑` / `↓` / `Enter` | Tidak konsisten | Resmi | Hanya aktif saat palette terbuka |
| `Ctrl+R` / `Cmd+R` | Ditampilkan di UI, tidak berfungsi | **Dilarang** | Label dihapus dari UI |

---

## 4. UX Toggle Widget

### 4.1 Arsitektur Provider (Konteks)

Saat ini terdapat hierarki provider yang bermasalah:

```
layout.tsx
└── CommandPaletteProvider          ← di sini
    └── [tab pages]
        └── WidgetWorkspaceProvider ← di sini (di dalam page)
            └── WidgetGrid
                └── WidgetShell × N
```

**Masalah**: `CommandPaletteProvider` di `layout.tsx` tidak bisa mengakses `useWidgetWorkspace()` karena `WidgetWorkspaceProvider` ada di dalam page, bukan di layout.

### 4.2 Solusi: Pindahkan WidgetWorkspaceProvider ke Layout

```
layout.tsx
└── WidgetWorkspaceProvider        ← DIPINDAH ke sini
    └── CommandPaletteProvider
        └── [tab pages]
            └── WidgetGrid
                └── WidgetShell × N
```

Dengan perubahan ini, `CommandPaletteProvider` bisa memanggil `useWidgetWorkspace()` untuk aksi toggle widget dan reset layout.

### 4.3 Alur Hide / Show Widget

```
User action: klik menu ⋮ → Hide (atau shortcut Alt+H)
    ↓
WidgetWorkspaceProvider.toggleHide(widgetId)
    ↓
Widget masuk array `hidden` (tidak dirender, tetap di layout items)
    ↓
WidgetGrid memfilter widget yang ada di `layout.hidden`
    ↓
Widget hilang dari tampilan
    ↓
User action: klik "Show Hidden Widgets" → pilih widget
    ↓
WidgetWorkspaceProvider.toggleHide(widgetId) lagi
    ↓
Widget keluar dari array `hidden`
    ↓
Widget dirender kembali
```

| Aspek | Keterangan |
|-------|-----------|
| **Trigger** | Menu ⋮ di WidgetShell → "Hide", atau shortcut `Alt+H` saat widget fokus |
| **State** | Widget masuk array `hidden`, tidak dirender tapi tetap di layout items |
| **Restore** | Tombol "Show Hidden Widgets" di header halaman → pilih widget |
| **Visual** | Widget yang hidden tidak menempati ruang di grid |
| **Animasi** | Fade-out 150ms saat hide, fade-in 150ms saat show |

### 4.4 Perbedaan Hide vs Remove

| Aspek | Hide | Remove |
|-------|------|--------|
| **Definisi** | Widget disembunyikan dari tampilan, tetap ada di layout | Widget dihapus sepenuhnya dari layout |
| **State** | Masuk array `hidden`, tetap di `items` | Dihapus dari `items` |
| **Bisa restore?** | Ya — klik "Show Hidden Widgets" | Tidak — harus add ulang dari WidgetRegistry |
| **Animasi** | Fade-out 150ms | Fade-out + scale 1.0→0.95, 150ms |
| **Persetujuan** | Tidak perlu | Tidak perlu (bisa di-add ulang) |
| **Kapan dipakai** | User ingin widget tidak mengganggu, tapi tetap butuh nanti | User yakin tidak butuh widget tersebut |

### 4.5 Cara Reset Layout

| Aspek | Keterangan |
|-------|-----------|
| **Trigger** | Menu ⋮ di WidgetShell → "Reset Layout", atau Command Palette → "Reset Layout" |
| **Scope** | Per-tab (reset tab saat ini, bukan semua tab) |
| **Aksi** | `resetLayout(tab)` → ganti layout dengan `DEFAULT_LAYOUTS[tab]` |
| **Persetujuan** | `confirm("Reset layout to default? Your custom layout will be lost.")` |
| **Irreversible** | Ya — layout kustom user hilang (acceptable karena bisa direset lagi) |

### 4.6 Perilaku Saat Feature Flag Workspace OFF

Feature flag `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED` saat ini **OFF**. Bila flag OFF:

| Perintah | Perilaku yang Benar | Perilaku yang Salah (No-op) |
|----------|---------------------|---------------------------|
| "Toggle Widget X" di Command Palette | **Disabled** — perintah ditampilkan dengan status "tidak tersedia" (greyed out + tooltip "Widget workspace tidak aktif") | No-op senyap — klik tidak terjadi apa-apa |
| "Reset Layout" di Command Palette | **Disabled** — perintah ditampilkan dengan status "tidak tersedia" | No-op senyap |
| Menu ⋮ di WidgetShell | Tidak ada menu hide/remove (WidgetShell tidak dirender, grid hardcoded yang dipakai) | — |
| Shortcut `Alt+1` – `Alt+5` | **Fungsi** — navigasi tab tetap bekerja (tidak tergantung widget workspace) | — |

> **PRINSIP**: Perintah yang tidak tersedia **HARUS** ditandai disabled di UI (greyed out, tooltip penjelasan), **BUKAN** no-op senyap. User harus tahu bahwa fitur tersebut ada tetapi tidak aktif, bukan berpikir aplikasi rusak.

### 4.7 Status Widget di Command Palette

Bila workspace OFF, Command Palette menampilkan:

| Kategori | Status | Tampilan |
|----------|--------|----------|
| Navigasi tab | ✅ Aktif | Normal, shortcut Alt+1..5 |
| Instrumen | ✅ Aktif | Normal, bisa pilih instrumen |
| Toggle Widget | ❌ Disabled | Greyed out + tooltip "Widget workspace tidak aktif" |
| Aksi Refresh | ✅ Aktif | Normal, tanpa shortcut |
| Reset Layout | ❌ Disabled | Greyed out + tooltip "Widget workspace tidak aktif" |

---

## 5. Mapping Ikon Widget

### 5.1 Prinsip Umum

| Prinsip | Penjelasan |
|---------|-----------|
| **Identitas visual** | Setiap widget punya ikon unik yang mencerminkan fungsi/widgetnya. |
| **Ikon generik untuk aksi** | Ikon `Eye` / `EyeOff` hanya dipakai untuk aksi toggle/hide, bukan untuk identitas widget. |
| **Konsistensi** | Ikon dipilih dari `lucide-react` (sudah ada di project). |
| **Diferensiasi** | Ikon widget harus berbeda satu sama lain untuk memudahkan user mengenali widget secara visual. |

### 5.2 Tabel Mapping widgetId → Ikon Lucide

| widgetId | Ikon Lucide | Nama Ikon | Alasan |
|----------|-------------|-----------|--------|
| `macro-regime` | `Activity` | Activity | Mencerminkan deteksi rezim yang dinamis dan aktif |
| `heatmap` | `Grid3X3` | Grid3X3 | Mencerminkan layout grid/heatmap yang terstruktur |
| `liquidity-gauge` | `Droplets` | Droplets | Mencerminkan likuiditas (cairan, aliran) |
| `ai-reasoning` | `Brain` | Brain | Mencerminkan kecerdasan buatan / reasoning |
| `economic-calendar` | `Calendar` | Calendar | Mencerminkan kalender ekonomi |
| `news-feed` | `Newspaper` | Newspaper | Mencerminkan berita / koran |
| `price-chart` | `LineChart` | LineChart | Mencerminkan chart harga / grafik garis |
| `macro-screener` | `Table2` | Table2 | Mencerminkan tabel screener |

### 5.3 Ikon untuk Aksi Toggle / Hide

Ikon generik `Eye` / `EyeOff` **HANYA** dipakai untuk aksi:

| Aksi | Ikon | Keterangan |
|------|------|-----------|
| Hide widget | `EyeOff` | Menyembunyikan widget dari tampilan |
| Show widget | `Eye` | Menampilkan kembali widget yang disembunyikan |
| Toggle visibility | `Eye` / `EyeOff` | Tergantung status saat ini |

> **ATURAN**: JANGAN pernah memakai `Eye` atau `EyeOff` sebagai ikon identitas widget. Ikon ini khusus untuk aksi toggle visibility.

### 5.4 Perbandingan dengan Ikon Sebelumnya

| widgetId | Ikon Sebelum | Ikon Sesudah | Perubahan |
|----------|--------------|--------------|-----------|
| `macro-regime` | `Eye` (generik) | `Activity` | ✅ Diperbaiki |
| `heatmap` | `Eye` (generik) | `Grid3X3` | ✅ Diperbaiki |
| `liquidity-gauge` | `Eye` (generik) | `Droplets` | ✅ Diperbaiki |
| `ai-reasoning` | `Eye` (generik) | `Brain` | ✅ Diperbaiki |
| `economic-calendar` | `Eye` (generik) | `Calendar` | ✅ Diperbaiki |
| `news-feed` | `Eye` (generik) | `Newspaper` | ✅ Diperbaiki |
| `price-chart` | `Eye` (generik) | `LineChart` | ✅ Diperbaiki |
| `macro-screener` | `Eye` (generik) | `Table2` | ✅ Diperbaiki |

---

## 6. Accessibility (A11y)

### 6.1 Checklist Keyboard Navigation

| # | Item | Status | Keterangan |
|---|------|--------|-----------|
| K1 | `Ctrl+K` / `Cmd+K` membuka Command Palette | ✅ Wajib | Sudah berfungsi |
| K2 | `Esc` menutup overlay / menu / palette | ✅ Wajib | Focus kembali ke elemen sebelumnya |
| K3 | `↑` / `↓` navigasi item di palette | ✅ Wajib | Hanya aktif saat palette terbuka |
| K4 | `Enter` eksekusi perintah terpilih | ✅ Wajib | Hanya aktif saat palette terbuka |
| K5 | `Alt+1` – `Alt+5` navigasi tab | ✅ Wajib | Listener harus ditambahkan di `layout.tsx` |
| K6 | Tab order logis (header → widget → footer) | ✅ Wajib | |
| K7 | Focus ring visible di semua interactive elements | ✅ Wajib | `focus-visible:ring-2 ring-accent-gold/50` |
| K8 | Skip ke main content link | ✅ Wajib | Untuk screen reader user |

### 6.2 Checklist ARIA Attributes

| # | Elemen | Attribute | Nilai | Status |
|---|--------|-----------|-------|--------|
| A1 | Overlay Command Palette | `role` | `"dialog"` | ✅ Wajib |
| A2 | Overlay Command Palette | `aria-modal` | `"true"` | ✅ Wajib |
| A3 | Input palette | `aria-label` | `"Search commands"` | ✅ Wajib |
| A4 | Item terpilih di palette | `aria-selected` | `"true"` | ✅ Wajib |
| A5 | Item terpilih di palette | `aria-activedescendant` | ID item | ✅ Wajib |
| A6 | WidgetShell root | `role` | `"region"` | ✅ Wajib |
| A7 | WidgetShell root | `aria-label` | `"{title}"` | ✅ Wajib |
| A8 | Header title widget | `role` | `"heading"` | ✅ Wajib |
| A9 | Header title widget | `aria-level` | `"3"` | ✅ Wajib |
| A10 | Status badge | `role` | `"status"` | ✅ Wajib |
| A11 | Status badge | `aria-live` | `"polite"` | ✅ Wajib |
| A12 | Menu trigger (⋮) | `aria-haspopup` | `"true"` | ✅ Wajib |
| A13 | Menu trigger (⋮) | `aria-expanded` | `"true"` / `"false"` | ✅ Wajib |
| A14 | Tombol ikon (hide, remove, dll) | `aria-label` | Deskriptif (mis. "Hide Heatmap Panel") | ✅ Wajib |
| A15 | Grid container | `role` | `"list"` | ✅ Wajib |
| A16 | Widget item di grid | `role` | `"listitem"` | ✅ Wajib |
| A17 | Widget yang hidden | `aria-hidden` | `"true"` | ✅ Wajib |
| A18 | Add Widget modal | `role` | `"dialog"` | ✅ Wajib |
| A19 | Add Widget modal | `aria-modal` | `"true"` | ✅ Wajib |
| A20 | Add Widget modal | `aria-labelledby` | ID judul modal | ✅ Wajib |

### 6.3 Focus Trap & Focus Return

| # | Skenario | Perilaku | Status |
|---|----------|----------|--------|
| F1 | Command Palette terbuka | Focus trap di dalam palette (Tab/Shift+Tab tidak keluar) | ✅ Wajib |
| F2 | Command Palette ditutup (Esc atau pilih perintah) | Focus kembali ke elemen yang sebelumnya fokus (biasanya body atau tombol terakhir) | ✅ Wajib |
| F3 | Widget di-remove | Focus pindah ke widget sebelahnya (atau tombol Add Widget) | ✅ Wajib |
| F4 | Widget di-drag | Focus tetap di header widget (jangan pindah ke body) | ✅ Wajib |
| F5 | Modal Add Widget terbuka | Focus trap di dalam modal | ✅ Wajib |
| F6 | Modal Add Widget ditutup | Focus kembali ke tombol "Add Widget" | ✅ Wajib |

### 6.4 Checklist Tabel & Data

| # | Elemen | Attribute | Keterangan | Status |
|---|--------|-----------|------------|--------|
| T1 | `<th>` | `scope="col"` | Wajib untuk semua header kolom tabel (screener, COT, dll) | ✅ Wajib |
| T2 | `<table>` | `<caption>` | Caption deskriptif untuk tabel, bisa sr-only | ✅ Wajib |
| T3 | Tabel kompleks | `aria-label` atau `<caption>` | Untuk tabel tanpa caption visible | ✅ Wajib |
| T4 | Data kosong | Pesan yang jelas | "No data available" + saran tindakan | ✅ Wajib |
| T5 | Loading state | `aria-busy="true"` pada container | Indikator loading untuk screen reader | ✅ Wajib |

### 6.5 Kontras Warna Status

| Status | Warna Tailwind | Hex | Kontras terhadap background | Status |
|--------|----------------|-----|------------------------------|--------|
| `live` | `text-data-profit` | `#39FF88` | Terang, kontras tinggi | ✅ Wajib |
| `cache` | `text-data-info` (atau biru) | `#38BDF8` | Terang, kontras tinggi | ✅ Wajib |
| `fallback` | `text-data-warning` | `#FBBF24` | Terang, kontras tinggi | ✅ Wajib |
| `stale` | `text-text-muted` | `#64748B` | **Perlu dicek** — mungkin terlalu rendah kontras di background gelap | ⚠️ Review |
| `error` | `text-data-loss` | `#FF3864` | Terang, kontras tinggi | ✅ Wajib |

> **CATATAN**: Warna `stale` (`#64748B`) perlu di-review untuk memastikan kontras mencukupi terhadap background gelap (`#121212`). Bisa dinaikkan ke `#94A3B8` atau ditambah indikator visual lain (icon, border).

---

## 7. Acceptance Criteria per Temuan Audit

### 7.1 Temuan 1: Command Palette — 7 Perintah NO-Op Senyap

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | 7 dari 21 perintah NO-OP senyap. `onToggleWidget` (6 perintah "Toggle Widget") dan `onResetLayout` ("Reset Layout") tidak pernah di-pass dari `layout.tsx`. |
| **Akar** | `CommandPaletteProvider` ada di `layout.tsx`, sedangkan `WidgetWorkspaceProvider` ada di dalam masing-masing page → layout tidak punya akses `useWidgetWorkspace()`. |
| **Perilaku yang benar** | `WidgetWorkspaceProvider` dipindah ke `layout.tsx`, di atas `CommandPaletteProvider`. Perintah toggle widget dan reset layout memanggil `useWidgetWorkspace()` untuk eksekusi. |
| **Cara membuktikan** | 1. Buka Command Palette (`Ctrl+K`). 2. Ketik "Toggle" → pilih perintah toggle widget mana pun. 3. Widget harus hilang/tampil di grid. 4. Ketik "Reset" → pilih "Reset Layout" → layout kembali ke default. |

### 7.2 Temuan 2: Tombol "Chart" di Screener No-Op di Tab Intelligence

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | Tombol "Chart" di Macro Screener no-op di tab Intelligence. |
| **Akar** | Chart hanya ada di `overview/page.tsx`, jadi event `macro:open-instrument` tidak punya pendengar di tab lain. |
| **Perilaku yang benar** | Bila user klik "Chart" di screener pada tab selain Overview: (1) simbol ditulis ke `sessionStorage` (`PENDING_INSTRUMENT_KEY`), (2) `router.push("/macro-terminal/overview")`, (3) chart membacanya sekali saat mount dan menampilkan chart simbol tersebut. |
| **Cara membuktikan** | 1. Buka tab Intelligence. 2. Di Macro Screener, klik tombol "Chart" pada instrumen mana pun. 3. Aplikasi harus navigasi ke tab Overview. 4. Chart harus menampilkan simbol yang dipilih. |

### 7.3 Temuan 3: Provider RSS = 0 Berita

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | Provider RSS menghasilkan 0 berita (terbukti runtime). |
| **Akar** | Bridge rss2json menolak ketiga feed; nitter.net HTTP 410 (mati permanen); Yahoo 429. |
| **Perilaku yang benar** | (1) RSS provider harus punya fallback chain yang bekerja, (2) News Feed harus menampilkan berita dari Finnhub (primary) atau RSS (fallback), (3) Bila semua provider gagal, tampilkan pesan error yang jelas dengan tombol retry. |
| **Cara membuktikan** | 1. Buka tab Overview atau Intelligence. 2. Lihat widget News Feed. 3. Widget harus menampilkan berita (minimal 5 item). 4. Bila provider gagal, pesan error jelas + tombol retry muncul. |

### 7.4 Temuan 4: Chart Tidak Ada di Branch Widget Workspace

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | Chart tidak ada di branch widget workspace. `DEFAULT_LAYOUTS.overview` hanya 6 widget, tanpa slot `price-chart`. |
| **Akar** | `DEFAULT_LAYOUTS.overview` tidak punya entry `price-chart`. |
| **Perilaku yang benar** | (1) Tambahkan entry `price-chart` di `DEFAULT_LAYOUTS.overview`, (2) Geser `y` enam widget lain untuk memberi ruang, (3) `WidgetShell` harus di-`mount` di `WidgetGrid`, (4) Bump `SCHEMA_VERSION` workspace. |
| **Cara membuktikan** | 1. Nyalakan feature flag `NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED`. 2. Buka tab Overview. 3. Widget chart harus terlihat dan berfungsi (bisa pilih instrumen, timeframe, indikator). |

### 7.5 Temuan 5: Shortcut yang Ditampilkan UI Tidak Berfungsi

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | Shortcut yang ditampilkan UI tidak berfungsi. `commands.ts` menampilkan `Alt+1..Alt+5` (tab) dan `Cmd+R` (refresh), tapi hanya `Ctrl+K` yang terdaftar di listener `useCommandPalette.tsx`. |
| **Akar** | Listener keyboard tidak mendaftarkan shortcut tersebut. |
| **Perilaku yang benar** | (1) Daftarkan listener untuk `Alt+1` – `Alt+5` di `layout.tsx`, (2) Hapus label `Cmd+R` dari UI (shortcut tidak didukung), (3) Pastikan semua shortcut yang ditampilkan di UI benar-benar terdaftar di listener. |
| **Cara membuktikan** | 1. Tekan `Alt+1` → harus navigasi ke tab Overview. 2. Tekan `Alt+2` → harus navigasi ke tab COT. 3. Tekan `Alt+3` → harus navigasi ke tab Quant Lab. 4. Tekan `Alt+4` → harus navigasi ke tab Nexus. 5. Tekan `Alt+5` → harus navigasi ke tab Intelligence. 6. Buka Command Palette → "Refresh All Data" TIDAK menampilkan shortcut `Cmd+R`. |

### 7.6 Temuan 6: Kalender Tanpa Satuan

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | Kalender tanpa satuan. `tradingview.provider.ts` membaca `item.unit` yang tidak ada di response TradingView (yang ada: `currency`, `scale`). |
| **Akar** | Field mapping salah — kode membaca field yang tidak ada di API response. |
| **Perilaku yang benar** | (1) Baca field yang benar dari response TradingView (`currency`, `scale`), (2) Tampilkan satuan yang sesuai di UI (mis. "K", "M", "B" untuk scale, atau simbol mata uang). |
| **Cara membuktikan** | 1. Buka widget Economic Calendar. 2. Lihat kolom satuan. 3. Satuan harus terisi dengan nilai yang benar (bukan kosong atau "undefined"). |

### 7.7 Temuan 7: `cmd.action()` Default = `console.log`

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | `cmd.action()` default = `console.log` → tiap aksi menulis log sampah. |
| **Akar** | Tidak ada fallback/explisit handler untuk aksi perintah. |
| **Perilaku yang benar** | (1) Setiap perintah di Command Palette harus punya `action` yang eksplisit dan benar, (2) Tidak ada default `console.log`, (3) Bila aksi tidak tersedia, tampilkan toast error (bukan console.log). |
| **Cara membuktikan** | 1. Buka Command Palette. 2. Eksekusi semua perintah satu per satu. 3. Tidak ada log sampah di console (DevTools). 4. Setiap perintah menghasilkan aksi yang benar (navigasi, toggle, refresh, dll). |

### 7.8 Temuan 8: `selectedIndex`/`setSelectedIndex` = State Mati

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | `selectedIndex`/`setSelectedIndex` di CommandPaletteContext = state mati. `cmdk` menangani navigasi sendiri. |
| **Akar** | State tidak digunakan untuk rendering — `cmdk` sudah handle navigasi internal. |
| **Perilaku yang benar** | (1) Hapus `selectedIndex`/`setSelectedIndex` dari context, (2) Pakai `cmdk` untuk navigasi (sudah bekerja dengan benar), (3) Jangan duplikasi state yang sudah dikelola library. |
| **Cara membuktikan** | 1. Buka Command Palette. 2. Navigasi dengan `↑` / `↓` → harus berfungsi dengan benar. 3. Kode tidak punya `selectedIndex` state yang tidak digunakan. 4. Tidak ada TypeScript warning untuk unused state. |

### 7.9 Temuan 9: Ikon Widget Di-override Jadi `Eye` untuk Semua

| Aspek | Keterangan |
|-------|-----------|
| **Temuan** | Ikon widget di-override jadi `Eye` untuk semua di `WIDGET_COMMANDS`, menimpa ikon spesifik (Calendar, Newspaper, Brain). |
| **Akar** | Semua perintah widget memakai ikon `Eye` yang sama. |
| **Perilaku yang benar** | (1) Setiap perintah widget memakai ikon spesifik sesuai tabel di §5.2, (2) Ikon `Eye` / `EyeOff` hanya untuk aksi toggle visibility, (3) Ikon harus berbeda untuk setiap widget. |
| **Cara membuktikan** | 1. Buka Command Palette. 2. Lihat daftar perintah "Toggle Widget". 3. Setiap perintah harus menampilkan ikon yang berbeda dan relevan (Activity untuk macro-regime, Calendar untuk economic-calendar, Brain untuk ai-reasoning, dst). |

---

## 8. Ringkasan Acceptance Criteria Global

| # | Kriteria | Cara Membuktikan |
|---|----------|------------------|
| 1 | `Ctrl+K` / `Cmd+K` membuka palette | Tekan shortcut → palette muncul |
| 2 | `Esc` menutup overlay + focus return | Tekan Esc → overlay tertutup, focus kembali ke elemen sebelumnya |
| 3 | `Alt+1` – `Alt+5` navigasi tab berfungsi | Tekan shortcut → tab berpindah |
| 4 | Toggle widget dari Command Palette berfungsi | Buka palette → pilih "Toggle Widget X" → widget hilang/tampil |
| 5 | Reset Layout dari Command Palette berfungsi | Buka palette → pilih "Reset Layout" → layout kembali ke default |
| 6 | Tombol "Chart" di screener berfungsi di semua tab | Klik "Chart" di screener → navigasi ke Overview dengan simbol yang dipilih |
| 7 | News Feed menampilkan berita | Buka widget News Feed → ada berita (bukan kosong) |
| 8 | Chart tampil di branch widget workspace | Nyalakan flag → buka Overview → chart terlihat |
| 9 | Label `Cmd+R` tidak ditampilkan di UI | Buka Command Palette → "Refresh All Data" tanpa shortcut |
| 10 | Ikon widget berbeda untuk setiap widget | Buka Command Palette → lihat ikon perintah widget |
| 11 | Focus trap di palette berfungsi | Buka palette → Tab tidak keluar dari palette |
| 12 | `aria-label` pada semua tombol ikon | Inspect DOM → semua tombol ikon punya aria-label |
| 13 | `scope="col"` pada semua `<th>` | Inspect DOM → semua th punya scope="col" |
| 14 | Caption sr-only pada tabel | Inspect DOM → tabel punya caption (bisa sr-only) |
| 15 | Kontras warna status mencukupi | Cek warna live/cache/fallback/stale/error terhadap background |
| 16 | Perintah disabled ditandai di UI (bukan no-op) | Buka palette dengan workspace OFF → perintah toggle widget disabled |
| 17 | Tidak ada log sampah dari `cmd.action()` | Buka palette → eksekusi perintah → console bersih |
| 18 | Tidak ada state mati (`selectedIndex`) | Inspect kode → tidak ada unused state di context |
| 19 | Kalender menampilkan satuan yang benar | Buka Economic Calendar → kolom satuan terisi |
| 20 | Tidak ada regresi pada panel existing | Semua panel existing render dengan benar |

---

## 9. Rekomendasi Implementasi

### 9.1 Prioritas per Temuan

| Prioritas | Temuan | Alasan |
|-----------|--------|--------|
| **P0** | #1, #2, #5, #7 | Memblokir fungsi inti — Command Palette tidak berfungsi, shortcut tidak berfungsi, tombol chart tidak berfungsi |
| **P1** | #3, #4, #9 | Mempengaruhi kualitas UI — berita kosong, chart hilang, ikon generik |
| **P2** | #6, #8 | Code quality — field salah, state mati |

### 9.2 Urutan Implementasi yang Disarankan

| Langkah | Terkait Temuan | Deskripsi |
|---------|-----------------|-----------|
| 1 | #1 | Pindahkan `WidgetWorkspaceProvider` ke `layout.tsx`, di atas `CommandPaletteProvider` |
| 2 | #5 | Tambahkan listener `Alt+1` – `Alt+5` di `layout.tsx` |
| 3 | #7 | Hapus default `console.log` dari `cmd.action()`, tambahkan handler eksplisit |
| 4 | #2 | Pastikan wiring `macro:open-instrument` + `PENDING_INSTRUMENT_KEY` berfungsi di semua tab |
| 5 | #9 | Update ikon di `WIDGET_COMMANDS` sesuai tabel §5.2 |
| 6 | #8 | Hapus `selectedIndex`/`setSelectedIndex` dari context |
| 7 | #3 | Fix RSS provider / fallback chain untuk news |
| 8 | #4 | Tambahkan slot `price-chart` di `DEFAULT_LAYOUTS.overview` |
| 9 | #6 | Fix field mapping di `tradingview.provider.ts` |

### 9.3 Definisi Selesai (Definition of Done)

- [ ] Semua 20 acceptance criteria global terpenuhi.
- [ ] `npx tsc --noEmit` 0 error.
- [ ] `npx vitest run` semua test hijau.
- [ ] Manual QA di semua breakpoint (desktop, tablet, mobile).
- [ ] Tidak ada regresi pada panel existing.
- [ ] Dokumen ini di-update bila ada perubahan desain.

---

## 10. Referensi

- [macro-charting-and-palette-spec.md](./macro-charting-and-palette-spec.md) — Spesifikasi charting engine & command palette
- [macro-widget-workspace-spec.md](./macro-widget-workspace-spec.md) — Spesifikasi widget workspace
- [macro-data-layer-spec.md](./macro-data-layer-spec.md) — Spesifikasi data layer & provider modular
- [MEMORY.md](../.kilo/MEMORY.md) — Arsitektur & state project saat ini
- [LESSONS.md](../.kilo/LESSONS.md) — Pelajaran dari kesalahan sebelumnya
- [RULES.md](../.kilo/RULES.md) — Aturan workflow & standar kode

---

## 11. Riwayat Revisi

| Tanggal | Versi | Perubahan | Author |
|---------|-------|-----------|--------|
| 2026-10-13 | 1.0 | Draft awal — spesifikasi desain interaksi berdasarkan 9 temuan audit | — |

---

*Dokumen ini adalah DESAIN/SPEC. Implementasi dimulai setelah review & persetujuan.*

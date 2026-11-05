# 🎨 UX AUDIT & PRODUCT DESIGN REVIEW — AI TRADING HUD
**Document**: `docs/design/ai-trading-ux-audit.md`  
**Author**: LYRA (UX/Product Designer Agent — *The Empathetic Visionary*)  
**Target Module**: `frontend/src/app/(dashboard)/ai-trading`  
**Tanggal**: 2026-10-28  
**Status**: APPROVED REVIEW & REBUILD BLUEPRINT  

---

## 📌 Executive Summary

Audit ini mengevaluasi pengalaman pengguna (*User Experience*), arsitektur informasi, efisiensi monitoring posisi terbuka, serta hierarki visual peringatan (*alert hierarchy*) pada modul **AI Trading HUD**.

Desain trading interface bukan sekadar masalah estetika gelap bernuansa emas, melainkan instrumen berisiko finansial tinggi di mana setiap milidetik, kejelasan hierarki informasi, dan pencegahan kesalahan klik (*error prevention*) dapat menyelamatkan modal pengguna.

Audit ini merumuskan 3 pilar evaluasi mendalam serta checklist rekomendasi perbaikan komponen antarmuka yang siap dieksekusi oleh tim engineering (NOVA).

---

## 📐 PILAR 1: Layout & Spatial Hierarchy AI Trading Tab

### 1.1 Kondisi Eksisting & Analisis Realita
1. **Struktur Grid Desktop**:
   - Kolom Utama: `md:col-span-2 xl:col-span-3 space-y-4`
   - Kolom Samping: `TradingPanel` + `MethodologyConfluence` di `xl:col-span-1`
2. **Masalah Vertikal Stacking (Cognitive Overload & Scroll Fatigue)**:
   - Ketika pipeline aktif (`pipelineStatus?.running === true`), kolom kiri menumpuk hingga 8 kartu analitik kompleks secara berurutan:
     1. `AccountOverview`
     2. `PositionsTable`
     3. `AgentBreakdown` (Hawk / Dove / Contrarian)
     4. `PipelineLogs`
     5. `PipelinePerformance` + `AITradeHistories` (grid 2 cols)
     6. `TradeHistoryDashboard`
     7. `MemoryInsights`
     8. `PerformanceAnalytics`
   - Total tinggi halaman dapat melebihi 3500px.
   - **Dampak UX**: Saat pengguna menggulir ke bawah untuk menganalisis log atau wawasan memori, tombol aksi utama di `TradingPanel` (Stop Pipeline, Pause, Emergency Status) menghilang dari pandangan karena panel kanan tidak bersifat sticky.
3. **Pengalaman Mobile Drawer**:
   - Tombol floating `Settings2` memicu drawer fullscreen (`fixed inset-0 z-50 bg-black/95`).
   - Penutupan total layar menghilangkan konteks market/posisi yang sedang diamati pengguna saat ingin mengubah konfigurasi risiko.

### 1.2 Rekomendasi Solusi & Perbaikan Komponen
- [ ] **Sticky Control Sidebar**: Terapkan kelas `xl:sticky xl:top-4 xl:self-start` pada container sidebar `TradingPanel` agar kontrol start/pause/stop selalu berada di viewport pengguna.
- [ ] **Tabular/Segmented Sub-views untuk Analitik Sekunder**:
  - Pertahankan `AccountOverview`, `PositionsTable`, dan `AgentBreakdown` di layer utama (Top Folding Area).
  - Kelompokkan komponen di bawahnya ke dalam tab internal terorganisir:
    - Tab 1: `Live Telemetry` (`PipelineLogs` + `MethodologyConfluence`)
    - Tab 2: `Performance & Stats` (`PipelinePerformance`, `AITradeHistories`, `TradeHistoryDashboard`)
    - Tab 3: `Agent Memory` (`MemoryInsights`, `PerformanceAnalytics`)
- [ ] **Mobile Bottom Sheet Half-Expanded**: Ganti fullscreen modal dengan semi-expanded sliding bottom sheet (50% viewport dengan opsi drag ke 90%) agar grafik atau harga terkini tetap terlihat saat tweaking parameter.

---

## 📊 PILAR 2: Kemudahan Monitoring Open Positions (`PositionsTable.tsx`)

### 2.1 Kondisi Eksisting & Analisis Realita
1. **Kepadatan Tabel 13 Kolom**:
   - Kolom: `Symbol`, `Ticket`, `Time`, `Type`, `Volume`, `Open`, `S/L`, `T/P`, `Current`, `Swap`, `Profit`, `Comment`, `Actions`.
   - Menggunakan wrapper `overflow-x-auto`. Pada layar laptop standar (13-14 inch, lebar 1366x768 atau 1920x1080 dengan OS scaling 125%-150%), tabel terpotong horizontal.
   - Kolom `Profit` dan tombol darurat `Close` / `Modify` terletak di ujung kanan dan sering tersembunyi jika pengguna tidak menggeser scrollbar horizontal.
2. **Zero-State Cumulative Layout Shift (CLS)**:
   - Baris kode `if (marketPositions.length === 0 && allPendingOrders.length === 0) return null;` di baris 143 menyebabkan komponen menghilang secara total saat tidak ada trade.
   - Saat trade pertama dieksekusi AI, tabel tiba-tiba muncul dan mendorong seluruh layout ke bawah. Saat trade ditutup, seluruh dashboard melonjak ke atas. Ini melanggar prinsip kestabilan visual (Google Core Web Vitals CLS).
3. **Mekanisme "Close All" & Pencegahan Kesalahan Aksi**:
   - Kode saat ini sudah menggantikan `window.confirm()` dengan state inline:
     ```tsx
     {isConfirmingCloseAll ? (
       <span className="text-xs font-bold">⚠ Click again to confirm</span>
     ) : ...}
     ```
   - **Kelemahan UX**: Tidak ada *auto-dismiss timer*. Jika tombol terkualifikasi "Click again to confirm" karena salah sentuh atau salah klik, status konfirmasi tersebut menetap selamanya sampai diklik lagi atau unmount. Pengguna rentan salah memencet secara tidak sengaja di kemudian waktu.
4. **Interaksi Inline SL/TP**:
   - Menggunakan `<input type="number">` sempit (`w-[72px]`) tanpa stepper pip, tanpa pencegahan invalid spread, dan tanpa visualisasi Risk-to-Reward ratio (RRR).

### 2.2 Rekomendasi Solusi & Perbaikan Komponen
- [ ] **Sticky PnL & Action Columns**: Buat kolom `Symbol` (kiri) dan kolom `Profit` + `Actions` (kanan) bersifat sticky (`sticky right-0 bg-surface/95 backdrop-blur`) saat tabel bergeser secara horizontal.
- [ ] **Permanent Empty State Container**: Hapus `return null;`. Gantikan dengan banner/placeholder minimalis elegan:
  *"Belum ada posisi terbuka. Pipeline AI sedang memindai struktur pasar..."* sehingga tinggi layout stabil.
- [ ] **Auto-Reset Safety Timer pada Close All**:
  - Tambahkan timer auto-revert 4 detik: jika pengguna tidak mengonfirmasi klik kedua dalam 4 detik, kembalikan tombol ke state normal.
  - Tampilkan visual countdown micro-bar tipis di bawah teks tombol.
- [ ] **Floating Quick Summary Header**: Tampilkan ringkasan agregat di header tabel:
  - Total Net Running PnL (dengan glow hijau/merah).
  - Total Volume (Lots) aktif di pasar.
- [ ] **Steppers & Quick Pips Input**: Berikan tombol penyesuaian cepat `[+10]`, `[+25]`, `[BE]` (Break Even) pada mode edit SL/TP.

---

## 🚨 PILAR 3: Hierarki Alert Payment Gate vs Trading Action

### 3.1 Kondisi Eksisting & Analisis Realita (Critical Safety Hazard)
1. **Bahaya Pemblokiran Layar Saat Posisi Aktif**:
   - Di `page.tsx:204-228`:
     ```tsx
     const isPaymentRequired = gateAction === "package" && paymentDismissed;
     if (isPaymentRequired) {
       return (
         <div className="min-h-screen bg-black flex items-center justify-center p-4">
           {/* Fullscreen Access Blocked Modal */}
         </div>
       );
     }
     ```
   - **P0 CRITICAL RISK**: Jika masa aktif langganan habis atau terjadi status payment gate saat pengguna **masih memiliki posisi terbuka di MT5**, seluruh layar diblokir. Pengguna dicegah melihat harga, dilarang menutup posisi, dan tidak dapat melakukan intervensi manual terhadap modal mereka!
2. **Inversi Hierarki Alert**:
   - `PaymentStatusBanner` ditaruh di puncak halaman (`mb-4` tepat di bawah header utama) dengan background emas bercahaya, mendominasi perhatian pengguna bahkan ketika pipeline sedang aktif bertrading.
   - Sebaliknya, alert keamanan kritis (seperti Circuit Breaker trip, Socket MT5 drop, Margin call) berada di bawah banner promosi paket.
3. **Dead Component Warning**:
   - Komponen `TradingDisabledBanner.tsx` (yang menangani notifikasi penting: *"Broker menolak order — Algo Trading tidak aktif di MT5"*) sudah ditulis secara rapi, tetapi **sama sekali tidak di-import atau dirender** di `page.tsx` maupun `TradingPanel.tsx`.

### 3.2 Rekomendasi Solusi & Perbaikan Komponen
- [ ] **Emergency Exit Bypass (Trading Safety Golden Rule)**:
  - Jangan pernah memblokir akses ke `PositionsTable` atau tombol `Close Position` meskipun paket pengguna kedaluwarsa.
  - Alur Gate Pembayaran yang benar:
    - Kunci tombol `Start Pipeline` dan pemesanan order baru.
    - Berikan floating toast atau non-blocking warning bar.
    - Pertahankan akses penuh ke monitoring akun, chart, dan tombol penutupan manual posisi.
- [ ] **Standarisasi 3 Tingkat Hierarki Peringatan (Alert Stack)**:
  1. **Level 1 — Critical Operational Emergency (Warna: Neon Red / High Glow)**:
     - Circuit Breaker Tripped / MT5 Offline / Margin Level < 100%.
     - Penempatan: Baris teratas paling mencolok, sticky, tidak dapat ditutup sebelum pulih.
  2. **Level 2 — Operational Warning (Warna: Amber / Yellow)**:
     - Algo Trading di MT5 mati (aktifkan kembali `TradingDisabledBanner.tsx`).
     - Reconnecting background status.
  3. **Level 3 — Account & Entitlement (Warna: Gold / Muted)**:
     - Status paket langganan dan booster.
     - Penempatan: Pindahkan dari banner layar penuh menjadi badge status kompak di dalam header samping tombol profile atau kartu collapsible.

---

## 📋 Checklist Rekomendasi Perbaikan Komponen UI untuk NOVA

| ID | Komponen | Area | Rekomendasi Tindakan | Prioritas |
|---|---|---|---|---|
| **UX-01** | `page.tsx` | Safety Gate | Hapus fullscreen blocking saat `positions.length > 0`. Izinkan penutupan manual posisi darurat. | **P0 (Critical)** |
| **UX-02** | `page.tsx` | Alert System | Mount `TradingDisabledBanner.tsx` saat MT5 menolak order algo trading. | **P0 (Critical)** |
| **UX-03** | `PositionsTable.tsx` | Usability | Hapus `return null;` pada zero-state. Ganti dengan container empty state berdesain bersih untuk mencegah CLS. | **P1 (High)** |
| **UX-04** | `PositionsTable.tsx` | Safety | Tambahkan auto-reset timer 4 detik pada konfirmasi `Close All` ("Click again to confirm"). | **P1 (High)** |
| **UX-05** | `PositionsTable.tsx` | Responsiveness | Buat kolom `Symbol` dan `Actions` sticky saat scroll horizontal di viewport laptop/mobile. | **P1 (High)** |
| **UX-06** | `page.tsx` & `TradingPanel.tsx` | Layout | Buat sidebar kanan `TradingPanel` menjadi sticky (`xl:sticky xl:top-4`) agar kontrol trading tidak hilang saat scroll. | **P2 (Medium)** |
| **UX-07** | `PaymentStatusBanner.tsx` | Hierarchy | Konversi dari full-width banner invasif menjadi HUD status card yang lebih kompak atau badge di header. | **P2 (Medium)** |
| **UX-08** | `page.tsx` | Organization | Susun analitik sekunder di bawah `AgentBreakdown` ke dalam segmented tabs (`Telemetry`, `Performance`, `Memory`). | **P3 (Polish)** |

---

*Disiapkan secara independen dan tervalidasi berbasis kode sumber riil oleh LYRA.*  
*Bukti implementasi tersimpan di: `docs/design/ai-trading-ux-audit.md`.*

### Perbandingan UI/UX dan Inkonsistensi yang Ditemukan:

Berdasarkan analisis file `dashboard/page.tsx` dan komponen `macro-terminal` (serta `overview/page.tsx`):

**Pola Konsisten di Halaman Dashboard:**

*   **Struktur Kartu/Panel:** Setiap bagian di dashboard (KPI Strip, Equity Curve Chart, Account Summary, Monthly Performance Calendar, Recent Trades, Asset Distribution) dibungkus dalam `div` dengan kelas `glass p-3 sm:p-4 md:p-5` (atau variasi serupa seperti `glass p-3 sm:p-4 md:p-6`) dan `border border-border-subtle rounded-xl overflow-hidden relative`. Ini memberikan tampilan panel yang konsisten.
*   **Header Panel:** Setiap panel memiliki header yang jelas dengan `h4` (atau `h2` di beberapa tempat) untuk judul, seringkali dengan `font-semibold text-text-primary uppercase tracking-wider leading-none text-xs sm:text-sm`. Seringkali ada elemen sekunder di sisi kanan header, seperti tombol filter atau label informasi.
*   **Penggunaan `font-mono`:** Font monospasi digunakan secara konsisten untuk data numerik, stempel waktu, dan beberapa label.
*   **Warna Aksent Gold (`text-accent-gold`):** Digunakan untuk judul utama, ikon penting, dan elemen interaktif.
*   **Warna Teks Sekunder (`text-text-secondary`):** Digunakan untuk deskripsi dan label pendukung.
*   **Responsivitas:** Penggunaan kelas Tailwind responsif seperti `sm:`, `md:`, `lg:` untuk menyesuaikan tata letak pada berbagai ukuran layar.
*   **Efek Interaktif:** Banyak elemen memiliki efek `hover` atau `transition-transform` (`hover:-translate-y-1 transition-transform duration-300`) untuk meningkatkan pengalaman pengguna.

**Inkonsistensi di Halaman Macro Terminal:**

1.  **Header Panel:**
    *   **`MacroRegimePanel.tsx`**: Judul `Macro Regime Matrix` menggunakan `h2` dengan `text-xs font-bold font-mono tracking-widest text-accent-gold uppercase`. Stempel waktu di panel kanan menggunakan `text-[9px]`.
    *   **`LiquidityGaugePanel.tsx`**: Judul `Liquidity Flow` juga menggunakan `h2` dengan `text-xs font-bold font-mono tracking-widest text-accent-gold uppercase`. Stempel waktu di header menggunakan `text-[9px]`.
    *   **`HeatmapPanel.tsx`**: Judul `Macro ETFs Heatmap` menggunakan `h2` dengan `text-xs font-mono font-bold text-accent-gold uppercase tracking-widest`.
    *   **`NewsFeedPanel.tsx`**: Judul `Macro Feed` menggunakan `h2` dengan `text-xs font-mono font-bold text-accent-gold uppercase tracking-widest`. Stempel waktu di header adalah `text-[9px]`.
    *   **`EconomicCalendarPanel.tsx`**: Judul `Economic Calendar` menggunakan `h2` dengan `text-xs font-mono font-bold text-accent-gold uppercase tracking-widest`.

    *Perbaikan yang Diperlukan*: Judul header panel di halaman `macro terminal` cenderung menggunakan `font-mono` dan `tracking-widest` secara berlebihan, dan ukuran font `text-xs` (0.75rem) sedikit lebih kecil dari `text-sm` (0.875rem) yang umum di dashboard untuk judul `h4`. Stempel waktu di header juga tidak konsisten.

2.  **Gaya Kartu/Panel Umum:**
    *   Semua panel `macro-terminal` menggunakan `glass border border-border-subtle rounded-xl overflow-hidden relative` yang konsisten dengan dashboard. Namun, `padding` dan `margin` antar elemen di dalam panel mungkin perlu disesuaikan.

3.  **Teks Deskripsi dan Label Pendukung:**
    *   Ukuran dan warna font untuk teks deskripsi atau label sekunder (`text-text-secondary`, `text-text-muted`) terlihat cukup konsisten, tetapi perlu diperiksa lebih lanjut di setiap komponen. Misalnya, `text-[9px]` dan `text-[10px]` sering digunakan. Dashboard juga menggunakan ini, tetapi kadang dengan `sm:text-xs` untuk responsivitas.

4.  **Elemen Interaktif dan Status:**
    *   Tombol dan label status (`LIVE`, `MOCK FALLBACK`, `ON RRP`) memiliki gaya yang konsisten.
    *   Indikator `LOADING` dan `ERROR` (`Loader2`, `AlertCircle`) terlihat konsisten.

### Rencana Perbaikan UI/UX:

**Tujuan Umum:** Membuat halaman `macro terminal` memiliki tampilan dan nuansa yang serupa dengan halaman `dashboard`, dengan penekanan pada konsistensi judul panel, tipografi, dan spasi.

**Langkah-langkah Implementasi:**

1.  **Standardisasi Header Panel:**
    *   **Untuk semua komponen panel di `frontend/src/components/macro-terminal/` (yaitu `MacroRegimePanel.tsx`, `LiquidityGaugePanel.tsx`, `HeatmapPanel.tsx`, `NewsFeedPanel.tsx`, `EconomicCalendarPanel.tsx`):**
        *   Ubah kelas `h2` judul menjadi lebih menyerupai `h4` di dashboard: `font-semibold text-text-primary uppercase tracking-wider text-xs sm:text-sm`. Hapus `font-mono` dan `tracking-widest` dari judul utama.
        *   Sesuaikan ukuran `gap` jika ikon dan judul tampak terlalu dekat atau terlalu jauh.

2.  **Penyesuaian Tipografi:**
    *   **Stempel Waktu di `LiquidityGaugePanel.tsx`:** Ubah ukuran font stempel waktu di header dari `text-[9px]` menjadi `text-xs` dan tambahkan `sm:text-sm` untuk responsivitas yang lebih baik.
    *   **Stempel Waktu di `NewsFeedPanel.tsx`:** Ubah ukuran font stempel waktu di header dari `text-[9px]` menjadi `text-xs` dan tambahkan `sm:text-sm` untuk responsivitas yang lebih baik.

3.  **Audit dan Penyesuaian Spasi/Padding:**
    *   Secara visual periksa setiap panel di `macro terminal` untuk memastikan `padding` dan `margin` antar elemen (terutama di bagian header dan di sekitar konten utama) konsisten dengan panel di halaman `dashboard`. Ini mungkin memerlukan penyesuaian kelas Tailwind seperti `p-`, `px-`, `py-`, `mb-`, `mt-`.

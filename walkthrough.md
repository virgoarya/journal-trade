# Hunter Trades Journal - Walkthrough Perbaikan Metodologi & Backtest

## Pendahuluan
Dokumen ini menjelaskan perubahan-perubahan yang telah diimplementasikan pada sistem Hunter Trades Journal. Fokus utama perbaikan adalah pada metodologi strategi trading, penanganan hasil backtest agar tidak membebani database, serta perbaikan beberapa error TypeScript yang ada.

## Ringkasan Perubahan Utama

1.  **Perbaikan Logika Metodologi Strategi Trading**
    *   Penyempurnaan logika Killzone di strategi ICT dan pemindahan ke service terpusat (`market-structure.service.ts`).
    *   Penyesuaian confidence secara dinamis di strategi SMC, MSNR, dan CRT.
    *   Perbaikan logika OTE (Optimal Trade Entry) bearish dan formula Fair Value Gap (FVG) di strategi ICT.

2.  **Optimasi Penyimpanan Hasil Backtest**
    *   Implementasi logika overwrite untuk hasil backtest di `BacktestExperience` agar tidak terjadi penumpukan data di database.
    *   Penambahan field `symbols` di model `BacktestExperience` untuk mendukung skenario multi-simbol.

3.  **Resolusi Error TypeScript**
    *   Memperbaiki error build TypeScript yang muncul pada `auto-backtest.cron.ts` dan `trading-pipeline.service.ts` yang merupakan isu pre-existing.

## Detail Perubahan per File

### `server/src/services/strategies/market-structure.service.ts`
*   **Penambahan Konstan & Fungsi Killzone Terpusat**
    *   `export type KillzoneType = "ASIAN" | "LONDON" | "NEW_YORK" | "LONDON_CLOSE" | "NONE";`
    *   `const KILLZONES` (definisi zona waktu EST) ditambahkan.
    *   Fungsi `getKillzoneForTimestamp(timestamp: number): KillzoneType` diimplementasikan untuk mengklasifikasikan waktu ke dalam Killzone yang benar, termasuk penanganan zona ASIAN yang melewati tengah malam.

### `server/src/services/strategies/ict.strategy.ts`
*   **Penggunaan Killzone Terpusat**
    *   Import `KillzoneType` dari `market-structure.service.ts`.
    *   Konstan `EST_OFFSET` dan `KILLZONES` yang sebelumnya ada dihapus.
    *   Fungsi `getCurrentKillzone()` dan `getKillzoneForTimestamp(timestamp: number)` kini memanggil `marketStructureService.getKillzoneForTimestamp()`.
*   **Perbaikan Logika OTE dan FVG**
    *   Logika deteksi OTE bearish pada `detectOTE` diperbaiki untuk perbandingan indeks swing high dan low yang lebih akurat.
    *   Formula `nearGap` di `detectFVGSignals` disederhanakan menjadi `Math.abs(last.close - fvg.bottom) < avgRange * 1.5` untuk menghilangkan bias denominator.

### `server/src/services/strategies/smc.strategy.ts`
*   **Penyesuaian Confidence Dinamis**
    *   Menambahkan fungsi `adjustConfidence()` yang memperhitungkan trend High Timeframe (HTF) dan kondisi `isMacroTime` untuk meningkatkan atau mengurangi nilai confidence sinyal.
    *   Semua sinyal yang dihasilkan oleh metode SMC kini melewati `adjustConfidence()` sebelum dikembalikan.

### `server/src/services/strategies/msnr.strategy.ts`
*   **Penyesuaian Confidence Dinamis & Perbaikan Scoring**
    *   Menambahkan variabel `engulfConfidenceBoost` di `confirmWithEntryTF` untuk nilai boost confidence yang lebih mudah dikelola.
    *   Fungsi `scoreBounce` disesuaikan agar nilai confidence awal lebih realistis (dari 55 ke 60) dan batas maksimal ke 95.
    *   Menambahkan fungsi `adjustConfidence()` yang serupa dengan SMC untuk penyesuaian dinamis berdasarkan trend HTF dan `isMacroTime`.

### `server/src/services/strategies/crt.strategy.ts`
*   **Perbaikan Logika MSB dan Konteks Fractal**
    *   Fungsi `detectMSB` diperbaiki untuk logika bearish yang lebih akurat dan penambahan penyesuaian confidence dinamis.
    *   Signature fungsi `detectMSB` diubah untuk menerima `fractal?: import("./market-structure.service").FractalContext` agar dapat menggunakan informasi trend HTF dan `isMacroTime`.
    *   Panggilan `detectMSB` di fungsi `analyze()` strategi CRT kini meneruskan objek `fractal`.

### `server/src/services/strategies/position-sizing.service.ts` (FILE BARU)
*   **Layanan Ukuran Posisi**
    *   Mendefinisikan `RiskParams` dan `PositionSizeResult`.
    *   Fungsi `calculate()` menghitung ukuran posisi berdasarkan confidence sinyal, entry/stop price, dan parameter risiko akun. Mendukung scaling confidence secara linear dan capping risiko harian.

### `server/src/services/strategies/strategy-config.service.ts` (FILE BARU)
*   **Layanan Konfigurasi Strategi Terpusat**
    *   Mendefinisikan `StrategyConfig` dengan parameter yang dapat di-tune untuk semua metodologi (ICT, SMC, MSNR, CRT, Quarterly, LIT, Confluence, Risk).
    *   Menyediakan fungsi `getConfig()`, `getICTConfig()`, `updateConfig()`, dan `reset()` untuk mengelola konfigurasi secara dinamis.

### `server/src/services/strategies/confluence-engine.ts`
*   **Integrasi Ukuran Posisi & Konfigurasi**
    *   Import `positionSizingService` dan `PositionSizeResult`.
    *   Interface `ConfluenceResult` diperbarui untuk menyertakan `positionSize: PositionSizeResult`.
    *   Fungsi `calculateConfluence` kini menerima `riskParams?: Partial<import("./position-sizing.service").RiskParams>`.
    *   Menghitung `positionSize` menggunakan `positionSizingService.calculate()` dan menambahkannya ke `finalSignal`.

### `server/src/models/BacktestExperience.ts`
*   **Penambahan Field `symbols`**
    *   Menambahkan properti `symbols?: string[];` pada interface `IBacktestExperience`.
    *   Menambahkan definisi schema `symbols: { type: [String], default: undefined }`.

### `server/src/services/backtest.service.ts`
*   **Logika Overwrite Backtest**
    *   Mengubah logika `findOneAndUpdate` pada saat menyimpan `BacktestExperience`:
        *   Jika `merged.sessionId` ada, query berdasarkan `{ userId, sessionId }`.
        *   Jika tidak ada `sessionId`, query berdasarkan `{ userId, symbol: merged.symbols.join(","), timeframe: merged.timeframe }` untuk memastikan overwrite data lama.
    *   Menambahkan opsi `{ upsert: true, new: true, setDefaultsOnInsert: true }` untuk konsistensi.

### `server/src/cron/auto-backtest.cron.ts`
*   **Perbaikan Akses `PipelineStatus`**
    *   Mengubah `currentStatus.state === "RUNNING"` menjadi `currentStatus.running === true && currentStatus.paused === false` agar sesuai dengan definisi `PipelineStatus` yang ada.

### `server/src/services/trading-pipeline.service.ts`
*   **Perbaikan Return `PipelineStatus`**
    *   Mengubah `return pipeline;` pada kondisi `!mt5McpService.isConnected` menjadi mengembalikan objek `PipelineStatus` yang lengkap dengan nilai default/saat ini, bukan objek `pipeline` internal.

### `AGENTS.md`
*   **Pembaruan Konteks Proyek**
    *   Memperbarui informasi tech stack, perintah dasar (install, dev, test), setup environment, arsitektur monorepo, dan quirks toolchain.

## Verifikasi

Untuk memverifikasi semua perubahan, ikuti langkah-langkah berikut:

1.  **Pastikan Kode Terkini**
    ```bash
    cd "D:\Journal Trade"
    git status
    # Pastikan semua perubahan yang dijelaskan di atas sudah di-stage atau belum, dan tidak ada file yang tidak terdeteksi (untracked files) yang penting.
    ```

2.  **Bersihkan dan Build Ulang Server**
    ```bash
    cd "D:\Journal Trade\server"
    Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue # Hapus folder dist jika ada
    npm run build
    # Pastikan tidak ada error TypeScript. Output harus mirip seperti:
    # > server@1.0.0 build
    # > tsc
    # (tidak ada pesan error tambahan)
    ```

3.  **Verifikasi Fungsionalitas Killzone (Manual)**
    *   Jika memungkinkan, jalankan server dan simulasikan skenario trading pada waktu-waktu Killzone yang berbeda (Asian, London, New York) dan pastikan sinyal ICT terdeteksi dengan benar dan `killzone` di objek `ICTSignal` sudah terisi dengan benar.

4.  **Verifikasi Fungsionalitas Overwrite Backtest (Manual/Simulasi)**
    *   **Skenario Tanpa Session ID:**
        1.  Jalankan satu backtest manual untuk `EURUSD` di `M15` melalui endpoint yang memanggil `backtestService.runBacktest` tanpa `sessionId`.
        2.  Periksa database (`backtest_experiences` collection) untuk entri baru.
        3.  Jalankan lagi backtest dengan `EURUSD`, `M15`, dan `dateRange` yang berbeda (tanpa `sessionId`).
        4.  Periksa database lagi. Seharusnya tidak ada entri baru, melainkan entri yang sudah ada diupdate dengan data terbaru (termasuk `dateRange` dan `result`).
    *   **Skenario Dengan Session ID (Cron Job):**
        1.  Simulasikan eksekusi cron job `auto-backtest.cron.ts` untuk satu user.
        2.  Periksa database. Seharusnya ada beberapa entri baru di `backtest_experiences` (sesuai jumlah iterasi optimasi) yang masing-masing memiliki `sessionId` unik. Ini adalah perilaku yang diinginkan.

5.  **Verifikasi Penyesuaian Confidence Dinamis**
    *   Jalankan beberapa backtest dengan kondisi pasar yang berbeda (trending vs. sideways, volatilitas tinggi vs. rendah) dan periksa nilai `confidence` pada sinyal yang dihasilkan oleh strategi SMC, MSNR, dan CRT. Pastikan nilainya berubah secara logis berdasarkan kondisi pasar dan trend HTF.

## Dampak dan Manfaat

Perubahan-perubahan ini secara signifikan meningkatkan stabilitas, efisiensi, dan akurasi sistem Hunter Trades Journal:

*   **Integritas Data Terjaga**: Database backtest tidak akan mengalami bloat, memastikan performa aplikasi tetap optimal dan data relevan mudah ditemukan.
*   **Akurasi Sinyal Lebih Baik**: Logika strategi yang diperbaiki dan confidence yang dinamis menghasilkan sinyal trading yang lebih akurat dan adaptif terhadap kondisi pasar.
*   **Reliabilitas Sistem Tinggi**: Resolusi error TypeScript dan DRY code mengurangi potensi bug di masa depan dan mempermudah maintenance.
*   **Pengalaman Developer Lebih Baik**: Dokumentasi `AGENTS.md` yang lengkap membantu developer baru (atau Kilo) untuk memahami dan berkontribusi pada codebase dengan lebih cepat dan efektif.

---
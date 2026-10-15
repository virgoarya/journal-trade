# 📖 Panduan Pengguna: Macro Terminal

> **Hunter Trades Journal & AI Trading Engine**
> Panduan resmi untuk pengguna akhir Macro Terminal — pusat data makro, chart harga,
> command palette, dan screener instrumen global.

---

## 📋 Daftar Isi

1. [Apa Itu Macro Terminal?](#apa-itu-macro-terminal)
2. [Kelima Tab Macro Terminal](#kelima-tab-macro-terminal)
3. [Macro Price Chart](#macro-price-chart)
4. <KBD>[Command Palette (Ctrl+K)](#command-palette-ctrlk)</KBD>
5. [Macro Screener](#macro-screener)
6. [Widget Workspace (Nonaktif)](#widget-workspace-nonaktif)
7. [Troubleshooting](#troubleshooting)

---

## Apa Itu Macro Terminal?

Macro Terminal adalah **dashboard khusus untuk analisis data makroekonomi** dalam aplikasi
Hunter Trades. Dari sini Anda bisa:

- Melihat **chart harga instrumen makro** (emas, minyak, indeks, mata uang, dll.) dengan
  indikator teknis bawaan.
- Memanggil **semua fitur lewat satu keyboard shortcut** (Command Palette).
- Memantau **8 instrumen makro sekaligus** dalam satu tabel (Screener).
- Melihat **pendapat AI** tentang kondisi makro saat ini.

Macro Terminal terdiri dari **5 tab** yang masing-masing punya fokus berbeda.

---

## Kelima Tab Macro Terminal

### Tabel Ringkasan Tab

| Tab | Nama | Fungsi Utama | Kapan Pakai |
|-----|------|--------------|-------------|
| **1** | **Overview** | Chart harga interaktif + ringkasan pasar | Melihat pergerakan harga satu instrumen secara detail |
| **2** | **COT** | Commitment of Traders — posisi pelaku pasar | Analisis sentimen institusional (bank, hedge fund, retailer) |
| **3** | **Quant Lab** | Eksperimen kuantitatif & statistik | Backtest ide, lihat korelasi antar instrumen, uji hipotesis |
| **4** | **Nexus** | AI multi-agent consensus tentang kondisi makro | Tanya ke AI: "Bagaimana rezim pasar sekarang?" |
| **5** | **Intelligence** | Screener 8 instrumen + berita & kalender | Scan cepat semua instrumen makro dalam satu layar |

### Penjelasan Singkat per Tab

#### 1. Overview

Tab ini menampilkan **Macro Price Chart** — chart candlestick yang bisa dikustomisasi
(timeframe, indikator, simbol). Di bawahnya ada ringkasan data pasar dan status koneksi
ke sumber data. **Ini tab default** saat Macro Terminal dibuka.

#### 2. COT

Menampilkan data **Commitment of Traders** dari CFTC (Commodity Futures Trading
Commission). Data ini menunjukkan **posisi bersih** tiga kelompok pelaku pasar:

- **Commercial** (hedger / industri)
- **Non-Commercial** (hedge fund, spekulan besar)
- **Non-Reportable** (retail kecil)

Gunakan COT untuk mengetahui apakah **smart money** sedang mengakumulasi atau mendistribusi
suatu instrumen.

#### 3. Quant Lab

Ruang eksperimen **kuantitatif**. Anda bisa menjalankan perhitungan statistik pada data
makro — misalnya korelasi antar instrumen, rata-rata bergerak custom, atau uji signifikansi
suatu hipotesis. Hasilnya ditampilkan dalam bentuk tabel dan grafik kecil.

#### 4. Nexus

**AI agent consensus** — beberapa model AI berbeda menganalisis data makro saat ini dan
memberikan voting tentang kondisi pasar (bullish / bearish / neutral), rezim saat ini, dan
rekomendasi tindakan. Setiap model menampilkan reasoning-nya masing-masing.

#### 5. Intelligence

**Screener + News + Calendar** dalam satu tab. Di sini Anda bisa melihat 8 instrumen makro
sekaligus dalam tabel yang bisa diurutkan, dibaca sparkline-nya, lalu klik untuk membuka
chart-nya. Di bawahnya ada kalender ekonomi dan berita terbaru dari sumber global.

---

## Macro Price Chart

Chart harga penuh yang mendukung **8 timeframe** dan **6 indikator teknis**. Ini alat utama
Anda untuk membaca pergerakan harga instrumen makro.

### Cara Ganti Simbol

1. **Kotak dropdown** di pojok kiri chart menampilkan simbol saat ini (misal: `XAUUSD`).
2. **Klik dropdown** → daftar instrumen muncul.
3. **Klik instrumen** yang diinginkan → chart langsung memuat data baru.
4. Data candle di-fetch ulang dan chart otomatis menampilkan histori instrumen tersebut.

> **Tips:** Anda juga bisa membuka chart dari **Command Palette** — ketik simbol
> (misal: `gold`, `oil`, `dxy`), pilih dari daftar, dan chart akan otomatis pindah ke tab
> Overview dengan simbol yang dipilih.

### Pilihan Timeframe

Chart mendukung **8 timeframe** yang bisa dipilih dari dropdown di sebelah simbol:

| Timeframe | Singkatan | Rentang Data |
|-----------|-----------|--------------|
| Daily | `1D` | 1 tahun |
| 5 Day | `5D` | 5 tahun |
| Monthly | `1M` | 20 tahun |
| 3 Monthly | `3M` | 40 tahun |
| 6 Monthly | `6M` | 60 tahun |
| Yearly | `1Y` | 80 tahun |
| 5 Yearly | `5Y` | 100 tahun |
| Max | `MAX` | Semua data tersedia |

> Timeframe **semakin panjang** = candle **semakin besar** (satu candle = periode lebih
> lama). `1D` artinya 1 candle = 1 hari. `1M` artinya 1 candle = 1 bulan.

### Enam Indikator Teknis

Anda bisa menyalakan/mematikan indikator dari **tombol toggle** di atas chart. Setiap
indikator muncul sebagai **pane terpisah** di bawah chart utama (kecuali overlay).

| Indikator | Jenis | Apa Ditampilkan |
|-----------|-------|----------------|
| **SMA** (Simple Moving Average) | Overlay di candle | Rata-rata harga penutupan — garis halus di atas candle |
| **EMA** (Exponential Moving Average) | Overlay di candle | Rata-rata berbobot — lebih responsif terhadap harga terbaru |
| **VWAP** (Volume Weighted Average Price) | Overlay di candle | Harga rata-rata berbasis volume — acuan utama institusional |
| **BB** (Bollinger Bands) | Overlay di candle | Tiga garis: upper band, middle band (SMA 20), lower band — mengukur volatilitas |
| **RSI** (Relative Strength Index) | Pane terpisah | Garis 0–100 — overbought (>70) dan oversold (<30) |
| **MACD** (Moving Average Convergence Divergence) | Pane terpisah | Dua garis + histogram — momentum dan arah tren |

**Cara pakai:**
- Klik tombol indikator untuk **menyalakan/mematikan**.
- Bisa menyalakan **banyak indikator sekaligus**.
- Setiap indikator menampilkan **legenda nilai** saat Anda meng-hover chart.

### Membaca Hover Legend (OHLC + Indikator)

Saat Anda **menggerakkan kursor** di atas chart, sebuah **legend** muncul menampilkan:

| Field | Arti |
|-------|------|
| **O** (Open) | Harga pembukaan candle |
| **H** (High) | Harga tertinggi candle |
| **L** (Low) | Harga terendah candle |
| **C** (Close) | Harga penutupan candle |
| **Vol** | Volume perdagangan (jika tersedia) |
| Nilai indikator | Nilai SMA/EMA/VWAP/BB/RSI/MACD pada posisi kursor |

Legend ini **ikut berpindah** mengikuti kursor, sehingga Anda bisa membaca nilai tepat
pada titik waktu tertentu.

### Zoom dan Geser Chart

| Aksi | Cara |
|------|------|
| **Zoom in** | Scroll mouse **ke atas** di area chart |
| **Zoom out** | Scroll mouse **ke bawah** di area chart |
| **Geser kiri/kanan** | **Click + drag** (tahan tombol kiri mouse, geser) |
| **Reset zoom** | Klik dua kali area chart |

> Chart menggunakan **lightweight-charts v5** — ringan dan responsif.

### Badge Status: LIVE / STALE / CACHE / ERROR

Di sebelah harga terakhir ada **badge status** yang menunjukkan kualitas data:

| Badge | Warna | Arti |
|-------|-------|------|
| **LIVE** | 🟢 Hijau | Data realtime langsung dari sumber — harga update setiap tick |
| **STALE** | 🟡 Kuning | Data dari cache, sudah melewati waktu TTL — akan refresh otomatis |
| **CACHE** | 🔵 Biru | Data diambil dari penyimpanan lokal karena koneksi ke sumber gagal |
| **ERROR** | 🔴 Merah | Gagal mengambil data — cek koneksi internet atau status provider |

**Apa harus khawatir?**
- **LIVE** = terbaik, data segar.
- **STALE** = normal, tunggu beberapa detik — data akan diperbarui otomatis.
- **CACHE** = data lama tapi masih bisa dibaca — tidak error, hanya belum fresh.
- **ERROR** = perlu perhatian — cek koneksi atau provider data.

### Efek Kilat Hijau/Merah pada Harga

Saat harga berubah, angka harga terakhir akan **berkedip (flash)**:

- **Kilat hijau** → harga **naik** dari harga sebelumnya.
- **Kilat merah** → harga **turun** dari harga sebelumnya.
- **Tidak berkedip** → harga tidak berubah sejak refresh terakhir.

Efek ini berlangsung **600ms** lalu kembali normal. Ini membantu Anda **tanpa harus
memandangi chart** — cukup lihat warnanya.

### Tulisan di Footer Chart

Di bagian bawah chart ada **footer** yang menampilkan metadata:

| Informasi | Contoh | Arti |
|-----------|--------|------|
| Simbol | `XAUUSD` | Instrumen yang sedang ditampilkan |
| Timeframe | `1D` | Timeframe yang sedang dipakai |
| Jumlah candle | `365 candle` | Berapa banyak candle yang dimuat |
| Sumber data | `Yahoo Finance` | Dari mana data berasal |
| Waktu update | `15:30:25` | Kapan data terakhir diambil |

---

## Command Palette (Ctrl+K)

**Command Palette** adalah cara tercepat untuk berpindah fitur di Macro Terminal —
seperti VS Code, tapi untuk trading.

### Cara Membuka

| Shortcut | Platform |
|----------|----------|
| <KBD>Ctrl + K</KBD> | Windows / Linux |
| <KBD>Cmd + K</KBD> | macOS |

### Cara Menggunakan

1. **Buka palette** → tekan <KBD>Ctrl + K</KBD>.
2. **Ketik** kata kunci → daftar perintah muncul dan **otomatis difilter**.
3. **Navigasi** → gunakan **panah atas/bawah** untuk memilih.
4. **Pilih** → tekan **<KBD>Enter</KBD>**.
5. **Tutup** → tekan **<KBD>Esc</KBD>** (atau klik di luar palette).

> **Fuzzy search:** Anda tidak harus mengetik persis. Misal ketik `gold` akan
> menemukan "Gold — Buka Chart", ketik `cot` akan menemukan "Buka Tab COT", dst.
> Semakin cocok kata kunci dengan nama perintah, semakin tinggi skornya.

### 4 Kategori Perintah

| Kategori | Jumlah | Contoh Perintah |
|----------|--------|-----------------|
| **NAVIGASI** | 5 | Buka Tab Overview, Buka Tab COT, Buka Tab Quant Lab, Buka Tab Nexus, Buka Tab Intelligence |
| **INSTRUMEN** | 8 | Gold, Silver, Crude Oil, US Dollar Index, S&P 500, NASDAQ, US 10Y Yield, VIX |
| **WIDGET** | 6 | Toggle Screener, Toggle News, Toggle Calendar, Toggle Sparkline, Toggle AI Insight, Reset Layout |
| **AKSI** | 2 | Refresh Data, Clear Cache |

### Contoh Penggunaan: "gold"

1. Tekan <KBD>Ctrl + K</KBD>.
2. Ketik `gold`.
3. Lihat hasil: **"Gold — Buka Chart"** (kategori INSTRUMEN).
4. Tekan **<KBD>Enter</KBD>**.
5. Aplikasi **otomatis pindah ke tab Overview** (jika belum di sana) dan chart
   menampilkan **XAUUSD (Gold)**.

> Inilah cara tercepat membuka chart — tanpa klik dropdown simbol, tanpa scroll,
> cukup <KBD>Ctrl + K</KBD> + ketik + <KBD>Enter</KBD>.

---

## Macro Screener

**Macro Screener** adalah tabel yang menampilkan **8 instrumen makro sekaligus** dalam
satu layar. Ada di tab **Intelligence** (di bawah area berita/kalender).

### 8 Instrumen yang Dipantau

| # | Simbol | Nama |
|---|--------|------|
| 1 | XAUUSD | Gold (Emas) |
| 2 | XAGUSD | Silver (Perak) |
| 3 | CL | Crude Oil (Minyak) |
| 4 | DXY | US Dollar Index |
| 5 | SPX | S&P 500 |
| 6 | NDX | NASDAQ 100 |
| 7 | US10Y | US 10Y Treasury Yield |
| 8 | VIX | Volatility Index |

### Fitur Screener

| Fitur | Cara Pakai |
|-------|-----------|
| **Urutkan kolom** | **Klik header kolom** (misal: harga, change %, volume) → tabel otomatis diurutkan. Klik lagi untuk urutan terbalik. |
| **Cari instrumen** | Ketik di **kotak pencarian** di atas tabel → instrumen yang cocok langsung muncul. |
| **Filter kategori** | Pilih kategori dari dropdown filter (Metals, Energi, Equity Index, Forex, Volatility, Rates). |
| **Baca sparkline** | Setiap baris punya **grafik garis kecil** (sparkline) yang menunjukkan tren harga — naik/turun/samping. |
| **Buka chart** | Klik tombol **Chart** di kolom paling kanan → aplikasi pindah ke tab Overview dan menampilkan chart instrumen tersebut. |

### Auto-Rewaktu

Screener **menyegarkan diri otomatis setiap 60 detik** — harga dan perubahan akan
diperbarui tanpa Anda klik apa pun.

Namun, **polling akan berhenti otomatis** ketika:

- **Tab browser tidak aktif** (Anda pindah ke aplikasi lain).
- **Panel screener di luar viewport** (tidak terlihat di layar).

Ini dilakukan untuk **menghemat resource** dan data. Saat Anda kembali ke tab Hunter Trades
atau scroll ke area screener, **data langsung refresh kembali** tanpa delay.

> **Tips:** Jika Anda ingin data screener yang **selalu segar**, pastikan tab Hunter Trades
> tetap aktif dan panel screener terlihat di layar.

---

## Widget Workspace (Nonaktif)

Di balik layar, Macro Terminal punya **fitur Widget Workspace** — sistem yang memungkinkan
Anda untuk:

- **Drag** widget (chart, screener, berita) ke posisi berbeda.
- **Resize** ubah ukuran setiap widget.
- **Hide/remove** widget yang tidak diperlukan.
- **Reset layout** kembali ke tampilan default.

Fitur ini **saat ini NONAKTIF** — di balik **feature flag** yang sengaja dimatikan.
Artinya, Anda akan melihat **layout legacy (statis)** yang tetap dan tidak bisa diubah.

> Kapan fitur ini diaktifkan? Tim Hunter Trades akan mengumumkan saat widget workspace
> sudah siap untuk dipakai secara luas. Jika Anda melihat **layout legacy** dan tidak bisa
> drag/resize, itu **bukan bug** — memang belum diaktifkan.

---

## Troubleshooting

### Tabel Masalah Umum

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|---------------------|--------|
| Chart tidak realtime / harga tidak update | Polling otomatis pause karena tab browser tidak aktif atau panel chart di luar viewport | Klik kembali ke tab Hunter Trades — data akan langsung refresh |
| Badge status **STALE** | Data dari cache sudah melewati waktu TTL | Tunggu beberapa detik untuk auto-refresh, atau klik tombol **REFRESH** secara manual |
| Badge status **CACHE** | Koneksi ke sumber data gagal, data diambil dari penyimpanan lokal | Cek koneksi internet. Data masih bisa dibaca tapi mungkin tidak segar |
| Badge status **ERROR** | Gagal mengambil data dari semua provider | Cek koneksi internet. Jika masih error setelah 1 menit, cek status provider (Yahoo Finance, dll.) |
| Instrumen di palette tidak terjadi apa-apa setelah dipilih | **Bug** — simbol tidak terdaftar atau sessionStorage tertimpa | Catat sebagai bug: simbol yang dipilih, dari tab mana, dan tulis ke Discord |
| Tidak ada efek kilat pada harga | Tidak ada perubahan harga sejak refresh terakhir | Normal — efek kilat hanya muncul saat harga benar-benar berubah |
| Tombol REFRESH tidak ada | UI sedang dalam kondisi loading atau error | Tunggu loading selesai. Jika tidak ada setelah 10 detik, refresh halaman browser |
| Screener tidak update setelah 60 detik | Tab browser tidak aktif atau screener di luar viewport | Bawa tab ke depan dan pastikan area screener terlihat |
| Chart tidak bisa di-zoom | Fokus mouse tidak tepat di area chart | Klik dulu di area chart, lalu scroll |
| Command Palette tidak muncul saat Ctrl+K | Fokus sedang di input lain atau ada shortcut yang bentrok | Klik dulu di area halaman Macro Terminal, lalu tekan Ctrl+K |

### Cara Lapor Bug

Jika Anda menemukan masalah yang **tidak tercantum di atas**, atau fitur yang seharusnya
jalan tapi tidak:

1. Catat **apa yang Anda lakukan** sebelum masalah muncul.
2. Catat **apa yang terjadi** (pesan error, layar blank, tombol tidak berfungsi, dst.).
3. Catat **versi aplikasi** (terlihat di splash screen atau menu Settings → About).
4. Sertakan **screenshot** jika memungkinkan.
5. Lapor ke **Discord resmi Hunter Trades** di channel `#bug-report`.

> ⚠️ **Jangan pernah mengirimkan API Key, password broker, atau kredensial apa pun**
> saat melapor bug.

---

## 📞 Bantuan Tambahan

Jika Anda masih kesulitan setelah membaca panduan ini:

- **Discord:** Channel `#support` di server Discord resmi Hunter Trades.
- **Dokumentasi lain:** Lihat `docs/` di repository untuk panduan teknis dan installasi.

---

> **Catatan terakhir:** Macro Terminal terus dikembangkan. Fitur yang ditandai
> "segera hadir" atau "nonaktif" akan diaktifkan secara bertahap. Versi dokumentasi ini
> mencerminkan kondisi aplikasi per **September 2026**.

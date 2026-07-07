# 🧪 Panduan Pengujian Aplikasi — AI Trading & Backtest System

> **Akses:** `http://localhost:3000`  
> **Backend API:** `http://localhost:5000/api/v1`  
> **Versi:** 1.0.0 — 2026-07-07

---

## 📋 Prasyarat Pengujian

Sebelum memulai pengujian, pastikan semua service berjalan:

| Service | Cara Menjalankan | Cek |
|---|---|---|
| **MongoDB** | `net start MongoDB` atau via MongoDB Compass | Koneksi port 27017 |
| **Backend Server** | `cd server && npm run dev` | Console: `API running on port 5000` |
| **Frontend** | `cd frontend && npm run dev` | Browser: `http://localhost:3000` |
| **MT5 MCP** | Otomatis via backend startup | Console: `[MT5-MCP] Connected to MT5 MCP server` |
| **FinanceMCP** | Otomatis via backend startup | Console: `Starting FlowLLM MCP Server` |

> **Catatan:** Jika MT5 tidak terhubung, beberapa fitur tetap bisa diuji menggunakan fallback symbols.

---

## 🧩 Skenario Pengujian

### 1. Halaman AI Trading — Tanpa Login MT5

**Tujuan:** Memastikan halaman tetap berfungsi walau MT5 tidak terhubung.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Buka `http://localhost:3000/ai-trading` | Halaman **ConnectionPanel** muncul dengan form login MT5 |
| Perhatikan apakah ada error console | Tidak ada error `ECONNRESET` atau `socket hang up` |
| Klik tab **Backtest** di header | Form backtest muncul dengan simbol-simbol forex (EURUSD, GBPUSD, dll) |
| Cek apakah simbol muncul tanpa login | **Yes** — 11 fallback symbols dari frontend |

### 2. Koneksi MT5

**Tujuan:** Memastikan login, save credential, dan auto-reconnect berfungsi.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Isi form: **Server**, **Login**, **Password** | Field terisi |
| Centang **Save credentials** | Checkbox tercentang |
| Klik **Connect** | Loading → **AccountOverview** muncul dengan balance, equity, margin |
| Cek **PositionsTable** | Tabel kosong atau berisi posisi yang ada |
| Klik **Disconnect MT5** | Kembali ke ConnectionPanel |
| Klik **Connect** lagi (tanpa isi form) | Login otomatis jika credentials tersimpan |

### 3. Trading Panel — Pipeline Configuration

**Tujuan:** Memastikan konfigurasi pipeline berfungsi.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Pilih simbol: **EURUSD**, **XAUUSD** | Muncul sebagai tag |
| Atur **Timeframe: M15** | Terpilih dengan highlight |
| Set **Risk/Trade: 0.5%** | Input terisi |
| Set **Max Positions: 2** | Input terisi |
| Klik tombol **7/7** (Methodology) | Panel metodologi terbuka |
| Uncheck **SMC** dan **ICT** | Metodologi tidak aktif, hitungan berubah |
| Klik **LLM Consensus** toggle | Slider threshold muncul |
| Klik **Start Pipeline** | Loading → status berubah "Pipeline running" |

#### Verifikasi Pipeline Log
| Langkah | Hasil yang Diharapkan |
|---|---|
| Tunggu 1-2 siklus pipeline | Log muncul di **PipelineLogs** |
| Cari log `[REGIME]` | Menampilkan regime pasar (TRENDING_BULL/BEAR/RANGING) |
| Jika ada sinyal trade | Log `CONFLUENCE` dengan methodology breakdown |
| Jika trade dieksekusi | Log `TRADE` muncul |
| Jika ada high-impact news | Log `[NEWS] Skipped EURUSD` muncul |

#### Verifikasi Filters
| Filter | Log yang Diharapkan |
|---|---|
| **Correlation Risk** | `[RISK] Skipped EURUSD: max 2 positions per EUR` |
| **News Impact** | `[NEWS] Skipped EURUSD — high-impact event within 30 min` |
| **Fundamental** | `[NEWS] Skipped EURUSD — against fundamental trend` |
| **HTF Confluence** | `[HTF] EURUSD SELL — 100% HTF confluence` |

### 4. Pipeline Performance — Live Stats

**Tujuan:** Memastikan performance statistik live berfungsi.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Pipeline running | **PipelinePerformance** menampilkan data |
| Cek **Total PnL** | Angka real-time |
| Cek **Methodology Performance** | Per metodologi: trades, WR, PnL dengan bar |
| Cek **Symbol Performance** | Per simbol: trades, WR, PnL |
| Klik **Refresh** | Data terupdate |

### 5. AI Backtest Skill — Auto Scan

**Tujuan:** Memastikan auto-scan dan skill display berfungsi.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Cari **AI Backtest Skill** panel di sidebar | Panel muncul |
| Klik **AI Auto-Scan All Pairs** | Loading → "Scanning..." |
| Tunggu proses selesai (beberapa menit) | Toast sukses |
| Cek **Symbol Rankings** | Peringkat simbol dengan score |
| Cek **Methodology Verdicts** | Status KEEP/ADJUST/DISABLE per metodologi |
| Klik **Apply Skill to Pipeline** | Konfigurasi pipeline terisi otomatis |

### 6. Backtest — Form Configuration

**Tujuan:** Memastikan form backtest lengkap dan berfungsi.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Klik tab **Backtest** | Form muncul |
| Pilih simbol: **EURUSD**, **GBPUSD**, **XAUUSD** | Multi-symbol terpilih |
| Set **Timeframe: M15** | Terpilih |
| Set **From/To Date** | Rentang 60 hari |
| Set **Balance: $10,000** | Terisi |
| Set **Leverage: 1:100** | Terpilih |
| Atur **RSI Oversold: 30**, **Overbought: 70** | Input terisi |
| Atur **SL/TP Multiplier: 1.5/2.0** | Input terisi |
| Centang **Trailing Stop** | Opsi activation & trail muncul |
| Atur **Speed: ⚡ Max** | 0ms |
| Atur **Signal Eval: Every 4th** | Interval optimal |
| Expand **Methodologies** | 7 metodologi, centang semua |
| Klik **Start Backtest** | Streaming view muncul |

### 7. Backtest — Live Streaming

**Tujuan:** Memastikan SSE streaming berfungsi dengan baik.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Streaming berjalan | Progress bar bergerak |
| Cek **Equity Card** | Angka equity berubah real-time |
| Cek **Indicators** | RSI dan ATR bergerak |
| Cek **Expert Advisor Journal** | Log trade muncul: "AI SIGNAL: BUY EURUSD @ 1.xxxxx" |
| Cek **Methodology badge** di log | Tag purple: SMC, ICT, LIT, dll |
| Cek **Symbols panel** | Live symbol stats dengan W/L |
| Cek **Methodologies panel** | Live methodology PnL |
| Tunggu progress 100% | "Simulation Completed" → result muncul |

#### Verifikasi Streaming Quality
| Aspek | Kriteria |
|---|---|
| **Equity Curve** | Mulus, tidak ada lompatan $0 |
| **Floating PnL** | Bergerak natural mengikuti candle |
| **Margin Level** | Berubah saat ada posisi terbuka |
| **Speed** | Cepat di max speed, lambat di slow |

### 8. Backtest — Results

**Tujuan:** Memastikan hasil backtest lengkap dan akurat.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Streaming selesai | **BacktestResult** muncul |
| Cek **Grade** | Nilai A-F dengan warna |
| Cek **Metrics grid** | Total Return, Win Rate, Max DD, Profit Factor, Recovery Factor, Sharpe, Avg Win/Loss |
| Cek **Symbol Performance** table | Per symbol: Trades, Win%, W/L/BE, PnL, label BEST/WORST |
| Cek **Methodology Performance** table | Per metodologi: Trades, Win%, W/L, PnL, Avg Conf |
| Cek **Equity Curve** chart | Grafik area mulus |
| Cek **AI Analysis** | Summary, strengths, weaknesses, methodology recommendations, pair insights |
| Expand **Trade History** | Tabel trade detail dengan kolom Method |

#### Verifikasi AI Analysis
| Komponen | Yang Dicek |
|---|---|
| **Methodology Recommendations** | KEEP/ADJUST/DISABLE per metodologi + alasan |
| **Pair Insights** | PROFITABLE/UNPROFITABLE/MIXED per simbol + saran |
| **Strengths** | Poin positif hasil backtest |
| **Weaknesses** | Poin negatif hasil backtest |
| **Lessons** | Saran perbaikan parameter |

### 9. News Calendar

**Tujuan:** Memastikan economic calendar menampilkan data real.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Cari **Economic Calendar** panel di sidebar | Panel muncul |
| Cek daftar event | Event high-impact dengan currency, nama, countdown timer |
| Jika ada event aktif | **⚠️ Active Warnings** bar merah dengan detail simbol |
| Klik **Refresh** | Data terupdate |

### 10. Methodology Confluence — Live Signal

**Tujuan:** Memastikan breakdown metodologi real-time berfungsi.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Pipeline running dengan sinyal | **MethodologyConfluence** muncul |
| Cek **Final Signal** | Direction, confidence, entry/SL/TP |
| Cek **Methodology dots** | Jumlah metodologi setuju |
| Cek **Individual signals** | Bar per metodologi dengan confidence |

### 11. Mode Auto Backtest (Full Scan)

**Tujuan:** Memastikan auto backtest scan semua pair.

| Langkah | Hasil yang Diharapkan |
|---|---|
| Di **AI Backtest Skill** panel | Tombol **AI Auto-Scan All Pairs** |
| Klik tombol | Loading scanning |
| Biarkan proses berjalan (5-10 menit) | Progress per simbol |
| Setelah selesai | Symbol Rankings terisi lengkap |
| Methodology Verdicts terisi | Status KEEP/ADJUST/DISABLE |

### 12. Skenario Error Handling

#### MT5 Disconnect
| Langkah | Hasil yang Diharapkan |
|---|---|
| Putuskan koneksi MT5 | UI kembali ke ConnectionPanel |
| Coba akses fitur backtest | Symbols tetap muncul (fallback) |

#### Rate Limit
| Langkah | Hasil yang Diharapkan |
|---|---|
| Kirim banyak request berturut-turut | Response `429 Too Many Requests` |
| Pesan error: "Too many AI requests" | Muncul di UI |

#### Validation Error
| Langkah | Hasil yang Diharapkan |
|---|---|
| Submit form dengan data tidak valid | Error message dari backend |
| Contoh: tanpa symbol | "At least one symbol required" |

---

## ✅ Checklist Pengujian

### Navigation
- [ ] Halaman AI Trading loading tanpa error
- [ ] Tab Trading ↔ Backtest berfungsi
- [ ] Sidebar navigation ke halaman lain

### MT5 Connection
- [ ] Connect dengan credentials valid
- [ ] Save credentials checkbox berfungsi
- [ ] Auto-reconnect setelah disconnect
- [ ] Disconnect kembali ke panel

### Pipeline
- [ ] Start pipeline dengan konfigurasi
- [ ] Pipeline log muncul real-time
- [ ] Methodology toggle berfungsi
- [ ] LLM Consensus toggle
- [ ] Correlation Risk filter bekerja
- [ ] News Impact filter bekerja
- [ ] Fundamental filter bekerja  
- [ ] HTF Confluence filter bekerja
- [ ] Pause/resume pipeline
- [ ] Stop pipeline

### Pipeline Performance
- [ ] Total PnL akurat
- [ ] Methodology stats per metode
- [ ] Symbol stats per pair
- [ ] Equity curve chart

### AI Skill
- [ ] Auto-Scan berjalan
- [ ] Symbol Rankings dengan score
- [ ] Methodology Verdicts
- [ ] Apply skill to pipeline

### Backtest
- [ ] Form dengan multi-symbol
- [ ] Streaming progress bar
- [ ] Equity/floating PnL real-time
- [ ] Margin level
- [ ] Methodology badge di trade log
- [ ] Live symbol stats
- [ ] Live method stats
- [ ] Result metrics (semua)
- [ ] Symbol Performance table
- [ ] Methodology Performance table
- [ ] Equity curve chart
- [ ] AI Analysis dengan recommendations
- [ ] Trade History dengan metodologi

### News Calendar
- [ ] Event list muncul
- [ ] High-impact events berwarna merah
- [ ] Active warnings untuk pipeline symbols
- [ ] Timer countdown

---

## 🐛 Pelaporan Bug

Jika menemukan bug, laporkan dengan format:

```
**Deskripsi:** [jelaskan masalah]
**Langkah reproduksi:** 
1. Buka [halaman]
2. Klik [tombol]
3. ...
**Hasil aktual:** [yang terjadi]
**Hasil diharapkan:** [yang seharusnya]
**Console error:** [paste error jika ada]
**Screenshot:** [jika memungkinkan]
```

---

## 📊 Metrik Keberhasilan Pengujian

| Kriteria | Target |
|---|---|
| Semua halaman loading | ✅ Tidak ada error |
| Pipeline start/stop | ✅ Berfungsi |
| Backtest streaming | ✅ Mulus tanpa $0 equity |
| News calendar loading | ✅ Data tampil |
| Auto backtest selesai | ✅ Symbol rankings terisi |
| AI Analysis muncul | ✅ Recommendations valid |
| Filter pipeline berfungsi | ✅ Log filter muncul |
| Fallback symbols | ✅ Muncul tanpa MT5 |

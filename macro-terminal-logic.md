# Macro Terminal — Logika & Alur Data

Ringkasan ini menjelaskan bagaimana setiap card di halaman `/macro-terminal` mengambil data, menghitung nilai, dan memperbarui tampilan. Semua referensi file mengarah ke `frontend/src/components/macro-terminal/` dan `server/src/services/`.

## 1. Macro Regime Matrix

### Fungsi
- Menampilkan 5 quadrant regime makro: **Stagflation**, **Reflation**, **Transition**, **Deflation**, **Goldilocks**.
- Menandai quadrant aktif dengan highlight khusus.

### Rumus & Sumber Data
- Source: `MacroTerminalContext.tsx` melakukan fetch ke `/api/v1/market-data/quotes` (Finnhub).
- Rumus **price-implied** (bukan data fundamental lambat):
  - `growth = SPY(dp) - IEF(dp)` — Selisih pergerakan harian ekuitas vs obligasi.
  - `inflation = (TIP(dp) + GLD(dp)) / 2 - IEF(dp)` — Proksi tekanan inflasi dari TIPS dan Gold vs Bonds.
- Classifier: `lib/macro/classifiers.ts` → `classifyMacroRegime()` menggunakan z-score threshold ±0.15 untuk menentukan quadrant.
- **SSOT (Single Source of Truth)**: Macro Regime Matrix adalah satu-satunya penentu regime makroekonomi di seluruh terminal. Panel lain (Quant Lab, Nexus) tidak boleh mengklaim regime sendiri.

### Update Cycle
- Frontend melakukan polling **setiap 5 menit** (dengan backoff 30 menit jika error).
- Ketika `currentRegime` di context berubah, `MacroRegimePanel` ikut berubah langsung (bukan nunggu polling).

### File Terkait
- `MacroRegimePanel.tsx` — UI grid 2x3 (karena hanya 4 quadrant aktif + 2 placeholder).
- `MacroTerminalContext.tsx` — state `currentRegime`, `lastRegime`, `systemAlert`.

## 2. Liquidity Flow (ON RRP)

### Fungsi
- Menampilkan kondisi likuiditas pasar: **INJECTING** atau **DRAINING**.
- Sumber: Federal Reserve Economic Data (FRED) series `RRPONTSYD`.

### Rumus & Logika
- `change = current - previous`
- Jika `change > 0` → status **DRAINING** (uang mengalir ke Fed, likuiditas pasar berkurang)
- Jika `change < 0` → status **INJECTING** (uang kembali ke pasar, likuiditas bertambah)
- Format nilai: `>= 1000` ditampilkan sebagai Triliun, sisanya Miliar.
- **5-Day Trend**: Backend mengambil 7 hari terakhir dari FRED (`limit=7`), menghitung perubahan harian berturut-turut, lalu kirim array `trend[]` (maks 5 item dengan status `injecting`/`draining`) ke frontend untuk dirender sebagai 5 dot kecil (hijau/merah).

### Update Cycle
- Backend cache 1 jam untuk menghindari spam request ke FRED.
- Jika `FRED_API_KEY` tidak terset, sistem fallback dummy (`value: 2000`).

### File Terkait
- `server/src/services/market-data.service.ts` (`getLiquidity`) — query 7 hari, hitung `trend[]`
- `frontend/src/components/macro-terminal/LiquidityGaugePanel.tsx` — render 5 dot trend under "Current Balance"
- `frontend/src/components/macro-terminal/MacroTerminalContext.tsx` — interface `LiquidityData` menyertakan `trend` field

## 3. Macro ETFs Heatmap

### Fungsi
- Menampilkan 8 aset ETF/indeks dengan warna sesuai pergerakan harian.

### Sumber Data & Rumus
- **Finnhub Quotes API** (`/api/v1/market-data/quotes`) → field `dp` (persentase perubahan).
- Backend mengambil `dp` dari response Finnhub dan meneruskan ke frontend.
- Jika API gagal/timeout, frontend fallback ke **mock ticker jitter** (`±0.8`).

### Warna Heatmap
- `> +2%` → Hijau tua (`bg-data-profit text-white`)
- `> +1%` → Hijau sedang
- `> 0%` → Hijau muda
- `< -2%` → Merah tua
- `< -1%` → Merah sedang
- `< 0%` → Merah muda
- `null` / unavailable → Abu-abu (`DATA UNAVAILABLE`)

### Definiteksi Aset
| Ticker | Nama |
|--------|------|
| SPY | S&P 500 (Equities) |
| QQQ | Nasdaq (Tech) |
| GLD | Gold (Safe Haven) |
| VIXY | VIX (Volatility) |
| IEF | US 10Y (Bonds) |
| UUP | US Dollar (DXY) |
| FXY | Japanese Yen |
| TIP | TIPS (Real Yield) |

### File Terkait
- `HeatmapPanel.tsx` — render grid heatmap, `getColor()` untuk warna, `renderChange()` untuk teks.
- `MacroTerminalContext.tsx` — state `assets`, `isFallback`, fetch quotes tiap 60 detik.

## 4. Macro Feed

### Fungsi
- Menampilkan daftar berita makro dari Finnhub (`/api/v1/market-data/news`).
- Setiap item bisa di-*Analyzer* untuk mendapatkan analisis AI dengan format 6 section.

### Struktur Output Analyzer
AI (Groq/Gemini) dipaksa mengeluarkan JSON dengan 6 field:
1. **Fakta** — Ringkasan fakta dari berita.
2. **Dampak Market** — Dampak langsung ke aset.
3. **Logika** — Penalaran di balik dampak.
4. **Contrarian** — Sudut pandang berlawanan.
5. **Trigger Fundamental Non-Teknikal** — Pemicu non-teknikal (geopolitik, sentimen).
6. **Confidence Score** — Tingkat kepercayaan AI (Rendah / Sedang / Tinggi).

### Flow Analyzer
1. User klik **ANALYZER** pada berita.
2. Frontend kirim POST ke `/api/v1/macro-ai/analyze-macro-feed` dengan `headline` + `targetAsset`.
3. Backend (`macroAiService.analyzeMacroFeed`) membentuk prompt dan minta AI return JSON 6 field.
4. Backend `parseMacroFeedText()` mengekstrak JSON dari teks AI.
5. Frontend `extractFirstJSON()` parsing JSON dan menampilkan 6 section dalam modal.
6. Jika AI gagal, fallback menampilkan raw text.

### Error Handling
- Setiap field yang kosong akan menampilkan "Tidak ada data".
- Jika JSON tidak terbaca, modal menampilkan raw analysis sebagai plain text.

## 5. AI Reasoning (Hunter Desk AI)

### Fungsi
- Menampilkan narasi makro lengkap untuk quadrant aktif.
- Sumber: AI (Groq ⇄ Gemini) memproses `assets`, `currentRegime`, dan `liquidityStatus`.

### Event-Driven Trigger
- `analyzeRegime()` **hanya memanggil backend AI saat regime berubah** (initial load atau transition `previousRegime !== currentRegime`).
- Jika regime tetap sama, narasi diambil dari cache in-memory (`aiReasoningRef`) — **tidak ada API call** ke Groq/Gemini.

### Rumus Narasi
- Backend `macroAiService.analyzeRegime()` menghitung:
  - `growth = spy - ief` (S&P 500 minus US 10Y)
  - `inflation = (tip + gld) / 2 - ief`
  - `sentiment` berdasarkan quadrant + status likuiditas.
- Prompt AI meminta narasi 3 kalimat dengan fokus pada fase makro saat ini.

### Alur
1. `MacroTerminalContext` fetch quotes → hitung regime → fetch AI reasoning.
2. `analyzeRegime()` **hanya dipanggil jika regime berubah** (initial load atau transition). Jika `currentRegime === previousRegime`, gunakan cache `aiReasoningRef` yang sudah ada — tidak tembak API.
3. Hasil disimpan di state `aiReasoning`.
4. Ditampilkan di `HeatmapPanel` di bawah heatmap.

### Fallback
- Jika AI gagal, narasi fallback: `Regime: ${regime}, Liquidity: ${status}`.

## 6. Terminal Chat (Hunter Desk AI)

### Fungsi
- Chat interface untuk query makro langsung ke AI.

### Dual-Engine (Groq ⇄ Gemini)
- Primary: **Groq** (`llama-3.3-70b-versatile`, fallback ke `llama-3.1-8b-instant`).
- Secondary: **Google Gemini** (`gemini-2.5-flash` via `GEMINI_API_KEY`).
- Auto-switch: Jika Groq melempar error **429 (Rate Limit)** atau **5xx (Server Error)**, backend otomatis oper prompt ke Gemini tanpa UI menampilkan error.

### Flow
1. User ketik pesan + tekan Enter / klik Send.
2. `handleSubmit` kirim POST ke `/api/v1/macro-ai/chat` dengan `messages`, `currentRegime`, `assets`, `liquidityStatus`.
3. Backend (`macroAiService.chatStream()`) menggunakan `callDualEngineStream()`:
   - Coba Groq streaming dulu.
   - Jika 429/5xx → fallback ke Gemini streaming (`generateContent` dengan `responseType: "stream"`).
4. Frontend menerima chunk dan update `content` secara real-time.
5. Jika response selesai, stream dihentikan.
6. Pesan disimpan di `localStorage` (`hunterDeskHistory`).

### State Chat
- `thinkingIndexRef` — daftar pesan "Hunter sedang membaca pasar...", berganti setiap **700ms** sampai AI jawab.
- `isLoading` — mencegah submit ganda (rate limit 2 detik).

### Rate Limit
- Chat: **1 request per 2 detik** (`RATE_LIMIT_MS = 2000`).
- AI Reasoning (`analyzeRegime`): **Event-driven** — hanya dipanggil saat regime berubah (initial load atau transition). Jika regime tetap, tidak ada API call — menggunakan cache `aiReasoningRef`.

## 7. Alur Data Keseluruhan

```
Frontend (page.tsx)
  └── MacroTerminalProvider (context)
        ├── fetchLiquidity()          → FRED API (via backend)
        ├── fetchQuotes()             → Finnhub API (via backend)
        │     └── Jika gagal: mock jitter
        ├── analyzeRegime()           → classifier + AI reasoning
        │     ├── classifyMacroRegime()
        │     └── macroAiService.analyzeRegime()
        └── fetchNews()               → Finnhub News API (via backend)
              └── analyzeFeedItem()    → AI 6-section output
                    └── /api/v1/macro-ai/analyze-macro-feed
```

```

Backend Services
  - `marketDataService.getQuotes()`      → Finnhub / Stooq / Yahoo
  - `marketDataService.getLiquidity()`   → FRED (7-day trend)
  - `marketDataService.getNews()`        → Finnhub News
  - `macroAiService.analyzeRegime()`     → Groq primary, Gemini fallback (event-driven)
  - `macroAiService.analyzeMacroFeed()`  → Groq primary, Gemini fallback (JSON 6-field)
  - `macroAiService.chatStream()`        → Groq streaming primary, Gemini streaming fallback
  - `geoRiskService.getScores()`         → FRED (CPI, FedFunds, PMI, ON RRP) + Yahoo Finance (VIX live)
  - `quantService.getSnapshot()`         → FRED (Yield Curve) + Yahoo Finance (VIX live)
```

## 8. Market Session Status (Heatmap)

### Fungsi
- Menampilkan status sesi pasar AS secara real-time di pojok kanan atas Heatmap.
- Membantu user mengetahui apakah data yang diterima adalah live market data atau closing data kemarin.

### Logika Waktu Dinamis (EDT/EST)
- Menggunakan `Intl.DateTimeFormat` dengan `timeZone: "America/New_York"` untuk mendukung penyesuaian dinamis antara EDT dan EST secara otomatis tanpa library eksternal.
- Badge ditentukan berdasarkan jam New York dan hari kerja:
  - **LIVE (US SESSION)** — Senin–Jumat, 09:30–16:00 (New York Time) → badge hijau
  - **PRE-MARKET** — Senin–Jumat, sebelum 09:30 (New York Time) → badge kuning/oranye
  - **AFTER-HOURS** — Senin–Jumat, 16:00–17:00 (New York Time) → badge kuning/oranye
  - **CLOSED** — Pada saat weekend (Sabtu/Minggu), status harus otomatis CLOSED dan data persentase (dp) untuk Heatmap harus mengunci pada data penutupan hari Jumat agar komponen tidak render sebagai DATA UNAVAILABLE.

### File Terkait
- `frontend/src/components/macro-terminal/HeatmapPanel.tsx` — fungsi `getMarketSessionStatus()` + badge render

## 9. Catatan Error Handling

- Setiap card memiliki **retry button** pada state error.
- Backend melakukan **cache** untuk mengurangi rate limit:
  - News: 60 detik
  - Liquidity: 1 jam
  - Quotes: 60 detik per symbol
- Jika API error total, UI menampilkan:
  - `MOCK FALLBACK` (badge) untuk quotes/news.
  - `DATA UNAVAILABLE` untuk heatmap.
  - Pesan error untuk regime matrix.

## 10. Environment Variables Wajib

| Variable | Digunakan Untuk |
|----------|-----------------|
| `FINNHUB_API_KEY` | Quotes + News |
| `FRED_API_KEY` | Liquidity (ON RRP) + Quant Lab (Yields) + Geo-Risk (CPI, FedFunds, PMI) |
| `GROQ_API_KEY` | AI reasoning + chat |
| `GEMINI_API_KEY` | Opsional, AI reasoning fallback |

> **Catatan**: Data VIX di Quant Lab dan Geo-Risk Radar **tidak lagi menggunakan FRED**. VIX diambil secara *live* dari Yahoo Finance REST API (`query1.finance.yahoo.com/v8/finance/chart/^VIX`) untuk menghindari lag data End-of-Day. FRED hanya digunakan sebagai *fallback* jika Yahoo Finance tidak tersedia.

## 11. Quant Lab

### Fungsi
- Tab khusus untuk analisis kuantitatif mendalam (*yield curve* dan *volatility status*).
- Menarik *snapshot* data dari endpoint gabungan `/api/v1/quant/snapshot`.

### Komponen
1. **US Treasury Yield Curve**
   - Menarik imbal hasil obligasi 2Y, 5Y, dan 10Y dari FRED (`DGS2`, `DGS5`, `DGS10`).
   - Menghitung **10Y - 2Y Spread**. Jika bernilai negatif, maka berstatus **INVERTED** (sinyal kuat resesi).
   - Menghitung **Recession Probability** menggunakan model *Estrella & Mishkin* (berbasis distribusi normal probit) berdasarkan spread 10Y-2Y.

2. **Volatility Status (VIX)**
   - Menarik data spot VIX secara **live** dari Yahoo Finance REST API (`query1.finance.yahoo.com/v8/finance/chart/^VIX`). FRED digunakan sebagai *fallback* jika Yahoo tidak tersedia.
   - **PENTING**: Panel ini adalah *Market Fear Gauge* murni, **bukan** *Regime Classifier*. Tidak ada label "Mapped Regime" — sumber kebenaran regime hanya ada di Macro Regime Matrix (tab Overview).
   - Memetakan level VIX ke status volatilitas:
     - `< 15` = **CALM** (Hijau) — Pasar tenang, risk-on environment
     - `15 – 20` = **NORMAL** (Kuning) — Volatilitas wajar, pasar berjalan normal
     - `20 – 30` = **ELEVATED** (Oranye) — Ketakutan meningkat, potensi koreksi
     - `> 30` = **FEAR** (Merah) — Kepanikan ekstrem, potensi crash/kapitulasi
   - Label subtitle: "Market Fear Gauge · VIX {nilai}" (menggantikan label "Mapped Regime" yang sudah dihapus).

### File Terkait
- `server/src/services/quant.service.ts` — fetch VIX dari Yahoo Finance, yield dari FRED
- `server/src/models/YieldCurveSnapshot.ts` — schema MongoDB dengan regime enum: `CALM | NORMAL | ELEVATED | FEAR | UNKNOWN`
- `frontend/src/components/macro-terminal/YieldCurvePanel.tsx`
- `frontend/src/components/macro-terminal/VixRegimePanel.tsx`

## 11.5. Geo-Risk Radar (Intelligence Tab)

### Fungsi
- Radar chart 5 sumbu yang mengukur tingkat risiko makroekonomi dari berbagai dimensi.
- Skor keseluruhan dihitung sebagai rata-rata dari 5 dimensi (0-100).

### Dimensi & Sumber Data
| Dimensi | Sumber Data | Rumus Skor (0–100) |
|---------|-------------|--------------------|
| Inflation Risk | FRED `CPIAUCSL` (CPI YoY) | `min(100, cpiYoy / 9 * 100)` |
| Rate Hike | FRED `FEDFUNDS` | `min(100, fedfunds / 5.5 * 100)` |
| Geopolitics | **Yahoo Finance** `^VIX` (Live) | `min(100, max(10, vix / 45 * 100))` |
| Supply Chain | FRED `NAPM` (ISM PMI) | `(50 - pmi) * 5 + 50` (inverted) |
| Liquidity Drain | FRED `RRPONTSYD` (ON RRP) | `100 - (onRrpB / 2500 * 100)` |

> **Catatan VIX**: Geopolitics VIX sebelumnya menggunakan FRED (`VIXCLS`) yang bersifat End-of-Day (lagging). Sekarang sudah diganti ke Yahoo Finance REST API untuk data real-time. FRED tetap sebagai fallback.

### Cache & Update
- MongoDB cache 12 jam. Auto-refresh frontend setiap 30 menit.
- Tombol Refresh ikon bypass cache untuk force-fetch data terbaru.

### File Terkait
- `server/src/services/geo-risk.service.ts` — fetch data FRED + Yahoo Finance VIX
- `server/src/models/GeoRiskSnapshot.ts` — schema MongoDB
- `frontend/src/components/macro-terminal/GeoRiskRadarPanel.tsx` — UI radar chart + breakdown list

## 12. Nexus Causal Loop

### Fungsi
- Tab visual interaktif (*Causal Loop Diagram*) yang memetakan bagaimana variabel makroekonomi saling mempengaruhi secara langsung (*real-time*).

### Causal Routing Logic (Hukum Makro)
1. **Inflation Proxy ➔ Federal Reserve**: Inflasi (momentum TIP & GLD) mendikte *stance* The Fed (Hawkish/Dovish).
2. **Federal Reserve ➔ Yield Curve**: Kebijakan moneter (suku bunga & QT) membentuk kurva imbal hasil.
3. **Federal Reserve ➔ Liquidity (RRP)**: Operasi QT/QE dan Repo mengontrol ketersediaan likuiditas uang tunai di sistem perbankan.
4. **US Dollar (DXY) ➔ Liquidity**: *Strong Dollar* (Proxy UUP) menyerap likuiditas global karena kredit berbasis USD menjadi sangat mahal (*Wrecking Ball effect*).
5. **Liquidity ➔ Risk Assets**: Likuiditas berlebih mengalir ke aset berisiko tinggi memompa harga S&P 500 (SPY).
6. **Market Fear (VIX) ➔ Risk Assets**: Korelasi terbalik algoritmik; lonjakan volatilitas VIX memicu institusi meruntuhkan ekuitas (Risk-Off).
7. **Yield Curve ➔ Risk Assets**: Kurva terbalik (*Inverted*) menandakan ancaman resesi dan kontraksi margin bank, menekan sentimen risiko.

### Animasi SVG Flowchart (Terminal Noir Engine)
- **Tanpa Library Berat**: Tidak menggunakan `react-flow` atau *canvas engine* untuk menjaga agar beban DOM tetap sangat ringan.
- **Bespoke Responsive SVG**: Diagram dirender menggunakan `<svg viewBox="0 0 100 100" preserveAspectRatio="none">`. Ini memastikan koordinat presisi dan responsif mengikuti `width/height` kontainer, mengkonversi koordinat menjadi persentase secara *native*.
- **Bezier Cable Routing**: Kabel menggunakan kurva Bezier tipe *S-Curve* murni (`M x1 y1 C cx1 cy1, cx2 cy2, x2 y2`).
- **Flowing Energy Animation**: Menggunakan properti `stroke-dashoffset` dari `framer-motion`. Kabel dirender dengan gaya putus-putus (*dashed*) lalu dianimasikan secara linier tanpa henti, menciptakan ilusi aliran listrik/data (warna merah muda untuk kontraksi, hijau neon untuk ekspansi) sesuai nilai elemen *causal* penyebabnya.
  - *Spesifikasi Khusus*: Kabel dari Liquidity ke Risk Assets menggunakan stroke warna merah saat status DRAINING (change > 0), dan warna hijau neon saat status INJECTING (change < 0).
- **Pulsating Alert**: Node yang dalam bahaya (misal: VIX > 20 atau Liquidity Draining) akan menyalakan *glow backdrop* berdenyut layaknya alarm peringatan.

### Institutional Desk AI
- **Fungsi**: AI bertindak sebagai *Head of Institutional Macro Desk* untuk menerjemahkan ke-7 node menjadi narasi aliran dana (capital flow).
- **Trigger**: Tombol manual **"Analyze Flow"** (menghemat kuota AI dan memberi kendali pada user).
- **Endpoint**: Frontend memanggil `POST /api/v1/macro-ai/analyze-nexus` mengirimkan status semua node (label, nilai, dan warna).
- **Animasi UI**: Menggunakan *typewriter effect* di panel terminal bagian bawah diagram untuk mensimulasikan AI sedang mengetik analisis secara real-time.

### File Terkait
- `frontend/src/components/macro-terminal/nexus/MacroNexusDiagram.tsx`
- `frontend/src/components/macro-terminal/nexus/NexusNode.tsx`

## 13. Economic Calendar (Overview Tab)

### Fungsi
- Menampilkan jadwal rilis berita fundamental dan data makroekonomi (CPI, NFP, GDP, FOMC, dll).
- Diletakkan di tab **Overview** untuk memberikan konteks seketika (*at-a-glance*) terhadap pergerakan Heatmap dan Regime tanpa memakan kuota token AI.
- Menampilkan data penting: Waktu (Time), Mata Uang/Negara (Cur), Judul Event (Event), **Actual** (ACT), **Forecast** (FCS), dan **Previous** (PRV).

### Sumber Data
- Menggunakan endpoint publik JSON dari **ForexFactory** (`https://nfs.faireconomy.media/ff_calendar_thisweek.json`).
- Gratis, tidak memerlukan API key, dan di-*cache* oleh backend selama 5 menit.

### Logika UI
- **Filter**: Hanya menampilkan event dengan dampak (Impact) `High` atau `Medium` dan untuk mata uang mayor (USD, EUR, GBP, JPY, CAD, AUD).
- **Indikator Masa Lalu**: Event yang sudah terlewati batas waktunya akan dirender sedikit transparan (`opacity-50`).
- **Warna Angka Aktual**: 
  - Jika `Actual > Forecast`, warna hijau (`text-data-profit`).
  - Jika `Actual < Forecast`, warna merah (`text-data-loss`).
  - *(Catatan: Pembandingan ini bersifat matematis absolut, belum membalikkan logika untuk indikator khusus seperti Klaim Pengangguran/Unemployment).*

### File Terkait
- `server/src/services/market-data.service.ts` — fungsi `getEconomicCalendar()`
- `frontend/src/components/macro-terminal/EconomicCalendarPanel.tsx`

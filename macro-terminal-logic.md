# Macro Terminal — Logika & Alur Data

Ringkasan ini menjelaskan bagaimana setiap card di halaman `/macro-terminal` mengambil data, menghitung nilai, dan memperbarui tampilan. Semua referensi file mengarah ke `frontend/src/components/macro-terminal/` dan `server/src/services/`.

## 1. Macro Regime Matrix

### Fungsi
- Menampilkan 4 quadrant regime makro: **Stagflation**, **Goldilocks**, **Deflation**, **Reflation**.
- Menandai quadrant aktif dengan highlight khusus.

### Rumus & Sumber Data
- Source: `MacroTerminalContext.tsx` melakukan fetch ke `/api/macro`.
- Backend memakai `server/src/app/api/macro/route.ts` → `lib/macro/calculations.ts` (`calculateInflationMomentum`) + `lib/macro/classifiers.ts` (`classifyMacroRegime`).
- `classifyMacroRegime` menerima `inflation`, `growth`, dan `liquidityStatus` untuk menentukan quadrant.
- `inflationMomentum` dihitung dari rata-rata perubahan CPI month-over-month (stored di `cpiMoM`). Jika `cpiMoM.mean() > 0` → momentum naik; sebaliknya turun.

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

### Update Cycle
- Backend cache 1 jam untuk menghindari spam request ke FRED.
- Jika `FRED_API_KEY` tidak terset, sistemFallback dummy (`value: 2000`).

### File Terkait
- `server/src/services/market-data.service.ts` (`getLiquidity`)

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
- Sumber: AI (Groq/Gemini) memproses `assets`, `currentRegime`, dan `liquidityStatus`.

### Rumus Narasi
- Backend `macroAiService.analyzeRegime()` menghitung:
  - `growth = spy - ief` (S&P 500 minus US 10Y)
  - `inflation = (tip + gld) / 2 - ief`
  - `sentiment` berdasarkan quadrant + status likuiditas.
- Prompt AI meminta narasi 3 kalimat dengan fokus pada fase makro saat ini.

### Alur
1. `MacroTerminalContext` fetch quotes → hitung regime → fetch AI reasoning.
2. `analyzeRegime()` dipanggil setiap kali ada update quotes.
3. Hasil disimpan di state `aiReasoning`.
4. Ditampilkan di `HeatmapPanel` di bawah heatmap.

### Fallback
- Jika AI gagal, narasi fallback: `Regime: ${regime}, Liquidity: ${status}`.

## 6. Terminal Chat (Hunter Desk AI)

### Fungsi
- Chat interface untuk query makro langsung ke AI.

### Flow
1. User ketik pesan + tekan Enter / klik Send.
2. `handleSubmit` kirim POST ke `/api/v1/macro-ai/chat` dengan `messages`, `currentRegime`, `assets`, `liquidityStatus`.
3. Backend stream balasan (SSE). Frontend menerima chunk dan update `content` secara real-time.
4. Jika response selesai, stream dihentikan.
5. Pesan disimpan di `localStorage` (`hunterDeskHistory`).

### State Chat
- `thinkingIndexRef` — daftar pesan "Hunter sedang membaca pasar...", berganti setiap **700ms** sampai AI jawab.
- `isLoading` — mencegah submit ganda (rate limit 2 detik).

### Rate Limit
- Chat: **1 request per 2 detik** (`RATE_LIMIT_MS = 2000`).
- Macro Regime: **1 request per 5 menit** (`RATE_LIMIT_MS = 300000`), dengan backoff maks 30 menit jika error.

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
  - `marketDataService.getLiquidity()`   → FRED
  - `marketDataService.getNews()`        → Finnhub News
  - `macroAiService.analyzeRegime()`     → Groq / Gemini
  - `macroAiService.analyzeMacroFeed()`  → Groq (JSON 6-field)
  - `macroAiService.chatStream()`        → Groq streaming
```

## 8. Catatan Error Handling

- Setiap card memiliki **retry button** pada state error.
- Backend melakukan **cache** untuk mengurangi rate limit:
  - News: 60 detik
  - Liquidity: 1 jam
  - Quotes: 60 detik per symbol
- Jika API error total, UI menampilkan:
  - `MOCK FALLBACK` (badge) untuk quotes/news.
  - `DATA UNAVAILABLE` untuk heatmap.
  - Pesan error untuk regime matrix.

## 9. Environment Variables Wajib

| Variable | Digunakan Untuk |
|----------|-----------------|
| `FINNHUB_API_KEY` | Quotes + News |
| `FRED_API_KEY` | Liquidity (ON RRP) |
| `GROQ_API_KEY` | AI reasoning + chat |
| `GEMINI_API_KEY` | Opsional, AI reasoning fallback |

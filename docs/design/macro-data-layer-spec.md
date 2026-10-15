# Data Layer Macro Terminal — Spesifikasi Desain

> **Proyek**: Hunter Trades Journal — Macro Terminal
> **Status**: DRAFT (belum diimplementasikan)
> **Tanggal**: 2026-10-12
> **Referensi**: [MACRO_TERMINAL_DESIGN_PLAN.md §5.4](../MACRO_TERMINAL_DESIGN_PLAN.md)

---

## 1. Tujuan

Memecah `macro-data.service.ts` (18 KB, monolithik) menjadi **provider modular** dengan **fallback chain** dan **stale-while-revalidate** (SWR), sehingga:

- Setiap sumber data (Yahoo, MT5, Stooq, FRED) menjadi modul terpisah yang bisa di-swap.
- Bila provider primary gagal, fallback chain otomatis mengambil alih tanpa blank UI.
- Cache SWR mengurangi latensi dan beban API — data lama ditampilkan sementara refresh di background.
- Status per-sumber tetap mengalir ke `MarketStatusBar` (`live | cache | fallback | stale | error`).

---

## 2. Arsitektur Provider Modular

```
server/src/services/macro/
├── providers/
│   ├── types.ts              # Interface seragam (IQuoteProvider, ISeriesProvider, dll)
│   ├── yahoo.provider.ts     # Primary: quotes, candles
│   ├── mt5.provider.ts       # Fallback 1: quotes (via mt5McpService)
│   ├── stooq.provider.ts     # Fallback 2: quotes, candles
│   ├── fred.provider.ts      # Primary untuk seri FRED: yield curve, ON RRP, CPI
│   ├── tradingview.provider.ts  # Economic calendar
│   ├── finnhub.provider.ts   # News
│   └── rss.provider.ts       # RSS aggregator (Kobeissi, CNBC, Yahoo)
├── cache.ts                  # SWR cache (TTL + stale window)
├── fallback.ts               # Orchestrator fallback chain
├── macro-data.service.ts     # Facade: publik API tetap sama (getQuotes, getNews, dll)
└── index.ts                  # Barrel export
```

### 2.1 Prinsip

| Prinsip | Penjelasan |
|---------|-----------|
| **Single Responsibility** | Satu provider = satu sumber data. Tidak ada logika campur aduk. |
| **Interface Seragam** | Semua provider quotes mengimplementasikan `IQuoteProvider`. Provider series mengimplementasikan `ISeriesProvider`. |
| **Fail-Safe** | Provider tidak throw ke caller. Return `null` + flag `error`. |
| **Stateless** | Provider tidak menyimpan state di luar cache. Cache dikelola terpusat di `cache.ts`. |

---

## 3. Interface Seragam

### 3.1 IQuoteProvider

```typescript
interface IQuoteProvider {
  readonly name: "yahoo" | "mt5" | "stooq";
  
  /**
   * Fetch quotes untuk multiple symbols.
   * Return array MarketQuote. Symbol yang gagal = price: null.
   * Tidak throw — error ditangkap di dalam.
   */
  fetchQuotes(symbols: string[]): Promise<MarketQuote[]>;
}
```

### 3.2 ISeriesProvider

```typescript
interface ISeriesProvider {
  readonly name: "fred";
  
  /**
   * Fetch time series dari FRED.
   * seriesId: "DGS10", "DGS2", "RRPONTSYD", "CPIAUCSL", dll.
   * Return array { date: string, value: number }.
   */
  fetchSeries(seriesId: string, options?: { limit?: number; sortOrder?: "asc" | "desc" }): Promise<FredObservation[]>;
}
```

### 3.3 ICalendarProvider

```typescript
interface ICalendarProvider {
  readonly name: "tradingview";
  
  /**
   * Fetch economic calendar events.
   * from/to: ISO date string.
   * countries: kode negara comma-separated.
   */
  fetchCalendar(from: string, to: string, countries: string): Promise<EconomicEvent[]>;
}
```

### 3.4 INewsProvider

```typescript
interface INewsProvider {
  readonly name: "finnhub" | "rss";
  
  /**
   * Fetch news items.
   * limit: jumlah maksimum item.
   */
  fetchNews(limit: number): Promise<NewsItem[]>;
}
```

### 3.5 ICandleProvider

```typescript
interface ICandleProvider {
  readonly name: "yahoo" | "stooq";
  
  /**
   * Fetch OHLCV candles.
   * symbol: instrument code.
   * timeframe: "1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX".
   */
  fetchCandles(symbol: string, timeframe: string): Promise<CandleData[]>;
}
```

---

## 4. Fallback Chain per Endpoint

### 4.1 Quotes (Indeks, FX, Komoditas)

| Prioritas | Provider | Keterangan |
|-----------|----------|-----------|
| 1 | Yahoo Finance | Primary. Real-time, gratis. |
| 2 | MT5 MCP | Fallback 1. Hanya jika MT5 connected. Per-symbol tick. |
| 3 | Stooq | Fallback 2. Gratis,-delayed 15 menit. |

**Logic**:
```typescript
// Pseudocode — fallback chain untuk quotes
async function getQuotes(symbols: string[]): Promise<QuoteResult> {
  // 1. Coba Yahoo
  const yahooResults = await yahooProvider.fetchQuotes(symbols);
  const failedSymbols = yahooResults.filter(q => q.price === null).map(q => q.symbol);
  
  if (failedSymbols.length === 0) {
    return { data: yahooResults, source: "yahoo", status: "live" };
  }
  
  // 2. Fallback MT5 untuk symbols yang gagal
  if (mt5StreamCache.isConnected()) {
    const mt5Results = await mt5Provider.fetchQuotes(failedSymbols);
    const merged = mergeResults(yahooResults, mt5Results);
    const stillFailed = merged.filter(q => q.price === null).map(q => q.symbol);
    
    if (stillFailed.length === 0) {
      return { data: merged, source: "mt5", status: "fallback" };
    }
    
    // 3. Fallback Stooq untuk yang masih gagal
    const stooqResults = await stooqProvider.fetchQuotes(stillFailed);
    const final = mergeResults(merged, stooqResults);
    return { data: final, source: "stooq", status: "fallback" };
  }
  
  // 2b. Stooq langsung jika MT5 tidak available
  const stooqResults = await stooqProvider.fetchQuotes(failedSymbols);
  const merged = mergeResults(yahooResults, stooqResults);
  return { data: merged, source: "stooq", status: "fallback" };
}
```

### 4.2 Yield Curve & FRED Series

| Prioritas | Provider | Keterangan |
|-----------|----------|-----------|
| 1 | FRED API | Primary. Authoritative source. |
| 2 | (none) | Tidak ada fallback — return `null` + `rateLimited: true`. |

**Catatan**: FRED tidak memerlukan fallback karena sudah jadi sumber resmi. Jika FRED gagal, yield curve akan menampilkan data stale dari cache SWR (jika ada) atau status `error`.

### 4.3 Economic Calendar

| Prioritas | Provider | Keterangan |
|-----------|----------|-----------|
| 1 | TradingView | Primary. |
| 2 | (none) | Tidak ada fallback. Return empty array + `rateLimited: true`. |

### 4.4 News

| Prioritas | Provider | Keterangan |
|-----------|----------|-----------|
| 1 | Finnhub | Primary (jika `FINNHUB_API_KEY` tersedia). |
| 2 | RSS Aggregator | Fallback. Gratis, rate-limited via `RSS_BRIDGE` limiter. |

---

## 5. Stale-While-Revalidate (SWR) Cache

### 5.1 Konsep

```
┌─────────────────────────────────────────────────────────────┐
│                    SWR Cache Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Request ──► Cache Hit?                                     │
│              │                                              │
│              ├── YES ──► Data masih fresh (age < TTL)?      │
│              │          │                                   │
│              │          ├── YES ──► Return cache (live)     │
│              │          │                                   │
│              │          └── NO  ──► Return cache (stale)   │
│              │                    + trigger background      │
│              │                      revalidation           │
│              │                                              │
│              └── NO ───► Fetch dari provider chain         │
│                         + set cache                          │
│                         + return data (live)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 TTL per Jenis Data

| Data | TTL | Stale Window | Keterangan |
|------|-----|--------------|------------|
| Quotes | 120_000 (2 menit) | 60_000 (1 menit) | Stale window = additional TTL setelah expired sebelum dianggap unusable. |
| Yield Curve | 600_000 (10 menit) | 300_000 (5 menit) | FRED data harian. |
| ON RRP (Liquidity) | 600_000 (10 menit) | 300_000 (5 menit) | Update harian. |
| Economic Calendar | 300_000 (5 menit) | 120_000 (2 menit) | Relatively static. |
| News | 60_000 (1 menit) | 30_000 (30 detik) | Fast-changing. |
| Candles (1D+) | 300_000 (5 menit) | 120_000 (2 menit) | Historical candles. |

### 5.3 Cache Entry Structure

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;       // saat data di-set
  ttl: number;            // TTL dalam ms
  staleWindow: number;    // additional TTL setelah expired
  source: string;         // "yahoo" | "mt5" | "fred" | dll
}
```

### 5.4 Helper Functions

```typescript
// cache.ts

const cacheStore = new Map<string, CacheEntry<any>>();

export function getCacheEntry<T>(key: string): CacheEntry<T> | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  
  // Masih dalam stale window? (TTL + staleWindow belum terlampaui)
  if (age > entry.ttl + entry.staleWindow) {
    cacheStore.delete(key);
    return null;
  }
  
  return entry;
}

export function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.timestamp > entry.ttl;
}

export function setCache<T>(
  key: string, 
  data: T, 
  ttl: number, 
  staleWindow: number,
  source: string
): void {
  cacheStore.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
    staleWindow,
    source,
  });
}

export function invalidateCache(key: string): void {
  cacheStore.delete(key);
}
```

### 5.5 Background Revalidation

```typescript
// SWR pattern — return stale data immediately, revalidate in background
async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<{ data: T; source: string }>,
  ttl: number,
  staleWindow: number
): Promise<{ data: T; status: "live" | "stale"; source: string }> {
  const cached = getCacheEntry<T>(key);
  
  if (cached && !isStale(cached)) {
    // Fresh — return immediately
    return { data: cached.data, status: "live", source: cached.source };
  }
  
  if (cached && isStale(cached)) {
    // Stale — return stale data immediately + trigger background revalidation
    (async () => {
      try {
        const result = await fetcher();
        setCache(key, result.data, ttl, staleWindow, result.source);
      } catch (e) {
        silentLogger.warn(`[SWR] Background revalidation failed for ${key}:`, e);
      }
    })();
    
    return { data: cached.data, status: "stale", source: cached.source };
  }
  
  // Cache miss — fetch synchronously
  const result = await fetcher();
  setCache(key, result.data, ttl, staleWindow, result.source);
  return { data: result.data, status: "live", source: result.source };
}
```

---

## 6. Rate Limiting & Backoff

### 6.1 Rate Limiters (existing)

Gunakan `API_LIMITS` dari `server/src/utils/rate-limiter.ts`:

| Limiter | Provider | Limit |
|---------|----------|-------|
| `API_LIMITS.FRED` | FRED | 120 req/menit |
| `API_LIMITS.FINNHUB` | Finnhub | 60 req/menit |
| `API_LIMITS.RSS_BRIDGE` | RSS feeds | Shared pool |

### 6.2 Exponential Backoff

```typescript
// fallback.ts

async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const delay = baseDelayMs * Math.pow(2, attempt);
      silentLogger.warn(`[Backoff] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

### 6.3 Circuit Breaker (Opsional — Fase 2)

```typescript
interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: "closed" | "open" | "half-open";
}

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_TIMEOUT_MS = 60_000; // 1 menit sebelum half-open
```

---

## 7. Environment Variables

> **ATURAN: Jangan pernah mencetak API key / connection string. Gunakan placeholder.**

| Variable | Provider | Required | Keterangan |
|----------|----------|----------|-----------|
| `FRED_API_KEY` | FRED | Ya | Untuk yield curve & ON RRP |
| `FINNHUB_API_KEY` | Finnhub | Opsional | Untuk news (fallback ke RSS jika kosong) |
| `MT5_MCP_URL` | MT5 MCP | Opsional | Default: `http://127.0.0.1:22346/mcp` |
| `MT5_MCP_API_KEY` | MT5 MCP | Opsional | Default: kosong |

**Contoh `.env` (placeholder)**:
```env
# FRED API — https://fred.stlouisfed.org/docs/api/api_key.html
FRED_API_KEY=<your-fred-api-key>

# Finnhub — https://finnhub.io/register
FINNHUB_API_KEY=<your-finnhub-api-key>

# MT5 MCP
MT5_MCP_URL=http://127.0.0.1:22346/mcp
MT5_MCP_API_KEY=<your-mt5-mcp-api-key>
```

---

## 8. Status Mapping ke MarketStatusBar

| Status | Kondisi | Warna (rekomendasi) |
|--------|---------|-------------------|
| `live` | Data fresh dari provider primary, age < TTL | Hijau |
| `cache` | Data dari cache, masih fresh | Biru |
| `fallback` | Data dari provider fallback (bukan primary) | Kuning |
| `stale` | Data melewati TTL, menunggu revalidation | Oranye |
| `error` | Semua provider gagal, tidak ada cache | Merah |

### 8.1 Response Envelope

Semua endpoint macro mengikuti format:

```typescript
interface MacroResponse<T> {
  success: boolean;
  data: T;
  source: string;           // "yahoo" | "mt5" | "stooq" | "fred" | "finnhub" | "rss"
  status: "live" | "cache" | "fallback" | "stale" | "error";
  fromCache: boolean;
  rateLimited: boolean;
  fetchedAt: string;        // ISO timestamp
}
```

---

## 9. Route & Mount Pattern

### 9.1 Prefix

Semua route macro: `/api/v1/macro-*`

| Route | File | Keterangan |
|-------|------|-----------|
| `/api/v1/macro-data/quotes` | `macro-data.routes.ts` | Quotes (dengan fallback chain) |
| `/api/v1/macro-data/yield-curve` | `macro-data.routes.ts` | Yield curve (FRED) |
| `/api/v1/macro-data/calendar` | `macro-data.routes.ts` | Economic calendar |
| `/api/v1/macro-data/news` | `macro-data.routes.ts` | News (Finnhub + RSS) |
| `/api/v1/macro-data/liquidity` | `macro-data.routes.ts` | ON RRP (FRED) |
| `/api/v1/macro-data/candles` | `macro-data.routes.ts` | OHLCV candles |
| `/api/v1/macro-regime/*` | `macro-regime.routes.ts` | Existing (unchanged) |
| `/api/v1/macro-ai/*` | `macro-ai.routes.ts` | Existing (unchanged) |

### 9.2 Mount di index.ts

```typescript
// server/src/routes/index.ts

import macroDataRoutes from "./macro-data.routes";

// ... existing imports ...

router.use("/api/v1/macro-data", macroDataRoutes);
router.use("/api/v1/macro-regime", macroRegimeRoutes);  // existing
router.use("/api/v1/macro-ai", aiLimiter, macroAiRoutes); // existing
```

---

## 10. Migration Plan

### Fase 0 — Fondasi Provider (P0)

| Task | Deliverable | Estimasi |
|------|-------------|----------|
| Buat `providers/types.ts` | Interface seragam | 1 jam |
| Buat `cache.ts` | SWR cache helper | 1 jam |
| Buat `fallback.ts` | Orchestrator + backoff | 2 jam |
| Extract `yahoo.provider.ts` | Quotes + candles dari existing | 2 jam |
| Extract `mt5.provider.ts` | Quotes dari existing | 1 jam |
| Extract `fred.provider.ts` | Yield + liquidity dari existing | 2 jam |

### Fase 1 — Facade & Route (P0)

| Task | Deliverable | Estimasi |
|------|-------------|----------|
| Buat `macro-data.service.ts` facade | Publik API tetap sama | 2 jam |
| Buat `macro-data.routes.ts` | Endpoint baru | 2 jam |
| Update `market-data.service.ts` | Migrasi ke facade baru | 1 jam |

### Fase 2 — Provider Tambahan (P1)

| Task | Deliverable | Estimasi |
|------|-------------|----------|
| Buat `stooq.provider.ts` | Fallback 2 untuk quotes | 2 jam |
| Buat `tradingview.provider.ts` | Economic calendar | 1 jam |
| Buat `finnhub.provider.ts` | News | 1 jam |
| Buat `rss.provider.ts` | RSS aggregator | 2 jam |

### Fase 3 — Candle Endpoint (P1)

| Task | Deliverable | Estimasi |
|------|-------------|----------|
| Implementasi `fetchCandles` | Di Yahoo & Stooq provider | 2 jam |
| Endpoint `GET /api/v1/macro-data/candles` | Route + integrasi | 1 jam |

---

## 11. Compatibility dengan Existing Code

### 11.1 Publik API (Tidak Berubah)

`macroDataService` tetap暴露 method yang sama:

```typescript
// Konsumen existing TIDAK perlu diubah
const { data, fromCache, rateLimited } = await macroDataService.getQuotes(symbols);
const { data } = await macroDataService.getEconomicCalendar();
const { data } = await macroDataService.getNews(10);
const { data } = await macroDataService.getLiquidity();
const { spread10y2y, spread10y3m, spread30y3m } = await macroDataService.getYieldCurve();
```

### 11.2 Konsumen yang Menggunakan macroDataService

| File | Pemakaian |
|------|-----------|
| `market-data.service.ts` | `getQuotes`, `getNews`, `getLiquidity`, `getEconomicCalendar` |
| `macro-ai.service.ts` | `getQuotes` (via dynamic require) |
| `__tests__/macro-data.test.ts` | Unit test untuk `getQuotes` |

---

## 12. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Provider unit tests | Vitest | Mock axios, verify fallback logic |
| Cache unit tests | Vitest | TTL expiry, stale window, background revalidation |
| Integration tests | Supertest | Endpoint `/api/v1/macro-data/*` |
| E2E | Playwright | Macro Terminal UI + status bar |

### 12.1 Test Cases untuk Fallback Chain

1. **Yahoo success** → return Yahoo data, status `live`.
2. **Yahoo partial fail, MT5 success** → merged, status `fallback`.
3. **Yahoo fail, MT5 disconnected, Stooq success** → Stooq data, status `fallback`.
4. **All providers fail** → return stale cache (jika ada), status `stale`.
5. **All providers fail, no cache** → return empty, status `error`.

---

## 13. File Structure Target

```
server/src/services/macro/
├── providers/
│   ├── types.ts
│   ├── yahoo.provider.ts
│   ├── mt5.provider.ts
│   ├── stooq.provider.ts
│   ├── fred.provider.ts
│   ├── tradingview.provider.ts
│   ├── finnhub.provider.ts
│   ├── rss.provider.ts
│   └── index.ts
├── cache.ts
├── fallback.ts
├── macro-data.service.ts
├── macro-data.routes.ts
└── index.ts
```

---

## 14. Keputusan Desain

| # | Keputusan | Alasan |
|---|-----------|--------|
| 1 | SWR dengan stale window terpisah dari TTL | Memungkinkan data stale ditampilkan lebih lama tanpa dianggap unusable. |
| 2 | Fallback chain hanya untuk quotes | Yield curve, calendar, dan news tidak memerlukan fallback chain kompleks — cukup satu provider + cache. |
| 3 | FRED tidak punya fallback | FRED adalah sumber resmi. Jika gagal, tampilkan stale cache atau status error. |
| 4 | Interface terpisah per tipe data | Quotes, series, calendar, news, candles punya struktur berbeda — interface terpisah lebih type-safe. |
| 5 | Facade pattern untuk backward compatibility | Konsumen existing tidak perlu diubah. Hanya perlu ganti import internal. |
| 6 | Background revalidation via fire-and-forget | Tidak blocking request. Cache di-update async. |
| 7 | Circuit breaker ditunda ke Fase 2 | Meningkatkan complexity. Belum diperlukan untuk MVP. |

---

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Provider gratis berubah format response | Parsing gagal | Defensive parsing + fallback ke provider berikutnya. |
| SWR cache terlalu lama stale | Data basi | Stale window dibatasi (max 5 menit). |
| MT5 tidak connected sering | Fallback chain ke Stooq sering aktif | Stooq sebagai fallback 2 sudah cukup untuk quotes. |
| FRED rate limit (120/menit) | Yield curve error | Cache 10 menit + SWR stale window 5 menit. |
| Memory leak dari cache | Server crash | Cache eviction berdasarkan stale window + periodic cleanup. |

---

## 16. Referensi

- [MACRO_TERMINAL_DESIGN_PLAN.md §5.4](../MACRO_TERMINAL_DESIGN_PLAN.md)
- [OpenTerminal Data Resilience](https://github.com/ErTasselli/OpenTerminal)
- [FRED API Documentation](https://fred.stlouisfed.org/docs/api/fred/)
- [Yahoo Finance Chart API](https://query1.finance.yahoo.com/v8/finance/chart/)

---

**End of Spec**

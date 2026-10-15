# Macro Terminal — Charting Engine & Command Palette: Design Specification

> **Dokumen**: Spesifikasi desain untuk Charting Engine dan Command Palette halaman Macro Terminal.
> **Proyek**: Hunter Trades Journal — Macro Terminal
> **Status**: **SPEC — belum ada implementasi.** Wajib direview sebelum coding.
> **Tanggal**: 2026-10-12
> **Referensi**: [MACRO_TERMINAL_DESIGN_PLAN.md](../MACRO_TERMINAL_DESIGN_PLAN.md) §5.2 & §5.3

---

## 1. Tujuan & Scope

### 1.1 Tujuan

Menambahkan **Charting Engine** (visualisasi harga profesional untuk instrumen makro) dan **Command Palette** (navigasi keyboard-first) ke halaman Macro Terminal, mengadopsi pola dari OpenTerminal tanpa menurunkan kedalaman analisis makro yang sudah ada.

### 1.2 Scope

| In | Out |
|----|-----|
| Charting Engine untuk indeks, komoditas, FX, yield | Widget workspace (drag/resize) — sudah di-spec terpisah |
| 8 timeframe, 6 indikator, hover legend | Screener & sparkline — Fase 2 |
| Command Palette dengan `⌘K` | Real-time flash-on-change — Fase 2 |
| Endpoint `GET /api/v1/macro/candles` | Provider modular penuh — Fase 3 |

### 1.3 Non-goal

- **Bukan** replikasi OpenTerminal 1:1. Fokus pada instrumen makro institusional.
- **Bukan** charting untuk saham/ETF/crypto individual (kecuali sebagai proxy likuiditas).
- **Bukan** options chain, crypto board, portfolio tracker.

---

## 2. Arsitektur Keseluruhan

```
┌─────────────────────────────────────────────────────────────────┐
│                     Macro Terminal Layout                        │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐  │
│  │  Tab Bar    │  │         Command Palette (⌘K)            │  │
│  │  (existing) │  │  ┌────────────────────────────────────┐  │  │
│  └─────────────┘  │  │  Search: [symbol | action | tab]   │  │  │
│                    │  │  ───────────────────────────────── │  │  │
│  ┌──────────────┐  │  │  > ^GSPC — S&P 500 Index          │  │  │
│  │ Market Status│  │  │    GC=F — Gold Futures            │  │  │
│  │    Bar       │  │  │    → Go to Overview tab           │  │  │
│  └──────────────┘  │  └────────────────────────────────────┘  │  │
│                    └──────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Widget Workspace                          ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      ││
│  │  │ Regime Panel │  │ MacroPrice   │  │  Liquidity   │      ││
│  │  │  (existing)  │  │   Chart      │  │    Gauge     │      ││
│  │  │              │  │  (NEW)       │  │  (existing)  │      ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘      ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      ││
│  │  │  Yield Curve │  │  VIX Regime  │  │  Heatmap     │      ││
│  │  │  (existing)  │  │  (existing)  │  │  (existing)  │      ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Komponen Baru

| Komponen | Path | Deskripsi |
|----------|------|-----------|
| `MacroPriceChart` | `frontend/src/components/macro-terminal/MacroPriceChart.tsx` | Chart harga utama (lightweight-charts) |
| `ChartToolbar` | `frontend/src/components/macro-terminal/ChartToolbar.tsx` | Timeframe selector + indikator toggle |
| `CommandPalette` | `frontend/src/components/macro-terminal/CommandPalette.tsx` | Overlay palette (cmdk) |
| `useChartData` | `frontend/src/hooks/useChartData.ts` | Hook fetch candles + state |
| `useCommandPalette` | `frontend/src/hooks/useCommandPalette.ts` | Hook state palette + keyboard |
| `indicators.ts` | `frontend/src/lib/indicators.ts` | Fungsi murni kalkulasi indikator |
| `candles.provider.ts` | `server/src/services/macro/providers/candles.provider.ts` | Provider candles (Yahoo → Stooq) |

### 2.2 Komponen Existing yang Tidak Diubah

- `MacroTerminalContext` — state global terminal
- `YieldCurvePanel`, `VixRegimePanel`, `MacroRegimePanel`, dll. — panel analisis
- `MarketStatusBar` — status data indicator
- Tab navigation — struktur tab existing

---

## 3. Charting Engine

### 3.1 Library: `lightweight-charts`

**Alasan pemilihan**:
- Dipakai OpenTerminal (referensi), terbukti untuk use-case charting
- Canvas-based rendering → performa tinggi untuk data time-series
- Ukuran bundle kecil (~45 KB gzipped)
- API declaratif, cocok dengan React
- Mendukung candlestick, line, area, histogram, markers

**Instalasi**:
```bash
cd frontend && npm install lightweight-charts
```

**Versi target**: `lightweight-charts@^5.x` (terbaru stabil)

### 3.2 Komponen `MacroPriceChart`

#### 3.2.1 Props Interface

```typescript
// frontend/src/components/macro-terminal/MacroPriceChart.tsx

export interface MacroPriceChartProps {
  /** Simbol instrumen, mis. "^GSPC", "GC=F", "DX-Y.NYB" */
  symbol: string;
  /** Timeframe chart */
  timeframe: ChartTimeframe;
  /** Daftar indikator yang aktif */
  indicators: ActiveIndicator[];
  /** Tinggi chart dalam pixel (default: 400) */
  height?: number;
  /** Tampilkan volume sub-chart (default: true) */
  showVolume?: boolean;
  /** Warna candle naik (default: token --color-data-profit) */
  upColor?: string;
  /** Warna candle turun (default: token --color-data-loss) */
  downColor?: string;
  /** Callback saat user memilih simbol baru */
  onSymbolChange?: (symbol: string) => void;
  /** Callback saat user memilih timeframe baru */
  onTimeframeChange?: (tf: ChartTimeframe) => void;
}

export type ChartTimeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX";

export interface ActiveIndicator {
  type: IndicatorType;
  params: IndicatorParams;
}

export type IndicatorType = "SMA" | "EMA" | "VWAP" | "BB" | "RSI" | "MACD";

export interface IndicatorParams {
  // SMA/EMA
  period?: number;
  // Bollinger Bands
  bbPeriod?: number;
  bbStdDev?: number;
  // RSI
  rsiPeriod?: number;
  // MACD
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
}
```

#### 3.2.2 State Internal

```typescript
// State di dalam MacroPriceChart (useRef + useState)
interface ChartState {
  chart: IChartApi | null;           // Instance lightweight-charts
  candleSeries: ISeriesApi<"Candlestick"> | null;
  volumeSeries: ISeriesApi<"Histogram"> | null;
  indicatorSeries: Map<string, ISeriesApi<"Line">>;  // key: indicatorId
  rsiSeries: ISeriesApi<"Line"> | null;               // RSI di pane terpisah
  macdSeries: {
    macd: ISeriesApi<"Line"> | null;
    signal: ISeriesApi<"Line"> | null;
    histogram: ISeriesApi<"Histogram"> | null;
  } | null;
  isLoading: boolean;
  error: string | null;
  dataStatus: "live" | "cache" | "fallback" | "stale" | "error";
}
```

#### 3.2.3 Lifecycle

```
1. Mount → init chart (createChart)
2. Fetch candles (useChartData hook)
3. Set data ke candleSeries + volumeSeries
4. Hitung indikator (indicators.ts) → tambah line series
5. Subscribe crosshair move → update hover legend
6. Cleanup on unmount → chart.remove()
```

### 3.3 Timeframe & Resolusi Data

| Timeframe | Label | Resolusi Data | Periode |
|-----------|-------|---------------|---------|
| `1D` | 1 Hari | 1 menit | 1 hari |
| `5D` | 5 Hari | 5 menit | 5 hari |
| `1M` | 1 Bulan | 15 menit | 1 bulan |
| `3M` | 3 Bulan | 1 jam | 3 bulan |
| `6M` | 6 Bulan | 1 jam | 6 bulan |
| `1Y` | 1 Tahun | 1 hari | 1 tahun |
| `5Y` | 5 Tahun | 1 minggu | 5 tahun |
| `MAX` | Maksimal | 1 minggu | Semua data |

**Mapping ke Yahoo Finance API**:
- `1D` → `range=1d&interval=1m`
- `5D` → `range=5d&interval=5m`
- `1M` → `range=1mo&interval=15m`
- `3M` → `range=3mo&interval=1h`
- `6M` → `range=6mo&interval=1h`
- `1Y` → `range=1y&interval=1d`
- `5Y` → `range=5y&interval=1wk`
- `MAX` → `range=max&interval=1wk`

### 3.4 Indikator

Semua indikator dihitung di `frontend/src/lib/indicators.ts` sebagai **fungsi murni** (pure functions) yang menerima array `Candle[]` dan mengembalikan array `IndicatorPoint[]`.

#### 3.4.1 Tipe Data

```typescript
// frontend/src/lib/indicators.ts

export interface Candle {
  time: number;      // Unix timestamp (detik)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}
```

#### 3.4.2 SMA — Simple Moving Average

**Rumus**:
```
SMA(n) = (Σ close[i]) / n, untuk i = 0..n-1
```

**Signature**:
```typescript
export function sma(data: Candle[], period: number): IndicatorPoint[];
```

**Parameter default**: `period = 20`

**Warna chart**: `#D4AF37` (accent-gold)

#### 3.4.3 EMA — Exponential Moving Average

**Rumus**:
```
EMA[0] = close[0]
EMA[i] = close[i] * k + EMA[i-1] * (1 - k)
k = 2 / (period + 1)
```

**Signature**:
```typescript
export function ema(data: Candle[], period: number): IndicatorPoint[];
```

**Parameter default**: `period = 21`

**Warna chart**: `#38BDF8` (biru muda)

#### 3.4.4 VWAP — Volume Weighted Average Price

**Rumus**:
```
VWAP = Σ(typicalPrice * volume) / Σ(volume)
typicalPrice = (high + low + close) / 3
```

**Signature**:
```typescript
export function vwap(data: Candle[]): IndicatorPoint[];
```

**Parameter**: Tidak ada (dihitung dari awal data)

**Warna chart**: `#A78BFA` (ungu)

**Catatan**: VWAP di-reset setiap sesi trading (untuk `1D` dan `5D`) atau setiap hari (untuk timeframe lain).

#### 3.4.5 Bollinger Bands

**Rumus**:
```
Middle = SMA(period)
Upper = Middle + stdDev * k
Lower = Middle - stdDev * k
stdDev = sqrt(Σ(close[i] - Middle)² / n)
```

**Signature**:
```typescript
export function bollingerBands(
  data: Candle[],
  period: number = 20,
  stdDev: number = 2
): BollingerPoint[];
```

**Parameter default**: `period = 20`, `stdDev = 2`

**Warna chart**:
- Upper: `#F87171` (merah muda)
- Middle: `#94A3B8` (abu-abu)
- Lower: `#F87171` (merah muda)

#### 3.4.6 RSI — Relative Strength Index

**Rumus**:
```
RS = avgGain / avgLoss
RSI = 100 - (100 / (1 + RS))
```

**Signature**:
```typescript
export function rsi(data: Candle[], period: number = 14): IndicatorPoint[];
```

**Parameter default**: `period = 14`

**Warna chart**: `#FBBF24` (kuning)

**Pane**: RSI ditampilkan di **sub-pane terpisah** (bukan overlay) dengan range 0-100, garis overbought (70) dan oversold (30).

#### 3.4.7 MACD — Moving Average Convergence Divergence

**Rumus**:
```
MACD = EMA(fast) - EMA(slow)
Signal = EMA(MACD, signalPeriod)
Histogram = MACD - Signal
```

**Signature**:
```typescript
export function macd(
  data: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDPoint[];
```

**Parameter default**: `fast = 12`, `slow = 26`, `signal = 9`

**Warna chart**:
- MACD line: `#38BDF8` (biru)
- Signal line: `#F97316` (oranye)
- Histogram: hijau (positif) / merah (negatif)

**Pane**: MACD ditampilkan di **sub-pane terpisah**.

### 3.5 Hover Legend

Saat user hover di chart, tampil legend berisi:

```
┌─────────────────────────────────────┐
│  O  1.234,56   H  1.240,00         │
│  L  1.230,00   C  1.238,00         │
│  Vol  1.2M                       │
│  ─────────────────────────────────  │
│  SMA(20)   1.235,00               │
│  EMA(21)   1.236,50               │
│  VWAP      1.234,80               │
│  BB(20,2)  U: 1.245  L: 1.225     │
└─────────────────────────────────────┘
```

**Implementasi**: Subscribe ke `chart.subscribeCrosshairMove()` → baca data dari series → tampilkan di div overlay.

### 3.6 Tema & Warna (Design System Terminal Noir)

**Aturan**: JANGAN hardcode hex. Gunakan CSS custom properties / Tailwind tokens.

| Elemen | Token | Nilai |
|--------|-------|-------|
| Background chart | `--color-surface` | `#0D0D0D` |
| Grid lines | `--color-border-subtle` | `#1E293B` |
| Text primary | `--color-text-primary` | `#E2E8F0` |
| Text muted | `--color-text-muted` | `#64748B` |
| Candle up | `--color-data-profit` | `#39FF88` |
| Candle down | `--color-data-loss` | `#FF3864` |
| Accent | `--color-accent-gold` | `#D4AF37` |
| Volume bar up | `--color-data-profit` (30% opacity) | — |
| Volume bar down | `--color-data-loss` (30% opacity) | — |

**Konfigurasi chart**:
```typescript
const chartOptions: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: "transparent" },
    textColor: "var(--color-text-muted)",
    fontFamily: "ui-monospace, monospace",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: "var(--color-border-subtle)" },
    horzLines: { color: "var(--color-border-subtle)" },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: "var(--color-accent-gold)", width: 1, style: LineStyle.Dashed },
    horzLine: { color: "var(--color-accent-gold)", width: 1, style: LineStyle.Dashed },
  },
  rightPriceScale: {
    borderColor: "var(--color-border-subtle)",
  },
  timeScale: {
    borderColor: "var(--color-border-subtle)",
    timeVisible: true,
    secondsVisible: false,
  },
};
```

### 3.7 Instrumen Default

| Simbol | Nama | Kategori |
|--------|------|----------|
| `^GSPC` | S&P 500 Index | Indeks |
| `^NDX` | Nasdaq 100 | Indeks |
| `DX-Y.NYB` | US Dollar Index (DXY) | FX |
| `GC=F` | Gold Futures | Komoditas |
| `CL=F` | WTI Crude Oil | Komoditas |
| `^VIX` | VIX Volatility Index | Volatilitas |
| `^TNX` | 10-Year Treasury Yield | Yield |
| `^FVX` | 5-Year Treasury Yield | Yield |

**Default symbol**: `^GSPC`

### 3.8 Aksesibilitas

- `role="img"` + `aria-label` deskriptif pada chart container
- Keyboard navigation: `←` `→` berpindah candle, `+` `-` zoom
- Fokus visible pada chart container
- Tooltip hover legend juga tersedia sebagai data table untuk screen reader

---

## 4. Command Palette

### 4.1 Library: `cmdk`

**Alasan pemilihan**:
- Library command palette paling populer untuk React
- Ukuran kecil (~15 KB gzipped)
- API sederhana, teruji
- Mendukung keyboard navigation built-in

**Instalasi**:
```bash
cd frontend && npm install cmdk
```

### 4.2 Trigger & Keyboard

| Aksi | Keybinding | Keterangan |
|------|------------|------------|
| Buka palette | `⌘K` (Mac) / `Ctrl+K` (Win/Linux) | Toggle |
| Tutup palette | `Esc` | — |
| Navigasi | `↑` `↓` | Pilih item |
| Eksekusi | `Enter` | Jalankan perintah |
| Bersihkan input | `Backspace` | Hapus query |

### 4.3 Sumber Perintah

Palette menampilkan perintah dari 4 kategori:

#### 4.3.1 Navigasi Tab

```typescript
interface TabCommand {
  id: "tab-overview";
  type: "navigation";
  title: "Go to Overview";
  description: "Macro regime, liquidity, heatmap";
  icon: LayoutDashboard;
  shortcut: ["⌥", "1"];
  action: () => router.push("/macro-terminal/overview");
}
```

**Daftar tab**:
- Overview (`⌥1`)
- COT (`⌥2`)
- Quant Lab (`⌥3`)
- Nexus (`⌥4`)
- Intelligence (`⌥5`)

#### 4.3.2 Instrumen Makro

```typescript
interface InstrumentCommand {
  id: "instrument-^GSPC";
  type: "instrument";
  title: "^GSPC — S&P 500 Index";
  description: "Indeks · US Large Cap";
  icon: TrendingUp;
  action: () => openChart("^GSPC");
}
```

**Daftar instrumen**: Sama dengan instrumen default chart (§3.7).

#### 4.3.3 Toggle Widget

```typescript
interface WidgetCommand {
  id: "widget-toggle-yield";
  type: "widget";
  title: "Toggle Yield Curve Panel";
  description: "Show/hide yield curve widget";
  icon: Eye;
  action: () => toggleWidget("yield-curve");
}
```

**Widget yang bisa di-toggle**:
- Yield Curve Panel
- VIX Regime Panel
- Liquidity Gauge
- Heatmap
- Economic Calendar
- News Feed
- AI Reasoning

#### 4.3.4 Aksi Cepat

```typescript
interface ActionCommand {
  id: "action-refresh";
  type: "action";
  title: "Refresh All Data";
  description: "Force refresh semua data makro";
  icon: RefreshCw;
  shortcut: ["⌘", "R"];
  action: () => refreshAll();
}
```

**Daftar aksi**:
- Refresh All Data (`⌘R`)
- Reset Layout
- Export Data (CSV)
- Toggle Dark/Light Mode (future)

### 4.4 Filter & Pencarian

**Algoritma**: Fuzzy search sederhana (substring match + scoring)

```typescript
function filterCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;
  const q = query.toLowerCase();
  return commands
    .filter(cmd => 
      cmd.title.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords?.some(k => k.includes(q))
    )
    .sort((a, b) => score(b, q) - score(a, q));
}
```

**Scoring**:
- Exact match: 100
- Starts with query: 50
- Contains query: 25
- Fuzzy match: 10

**Prioritas tampilan**:
1. Navigasi tab (selalu di atas)
2. Instrumen yang cocok
3. Widget toggle
4. Aksi cepat

### 4.5 UI/UX

#### 4.5.1 Layout

```
┌─────────────────────────────────────────────┐
│  🔍  Search commands...              Esc    │
├─────────────────────────────────────────────┤
│  NAVIGASI                                   │
│  → Overview                    ⌥1           │
│    COT                        ⌥2           │
│    Quant Lab                   ⌥3           │
│                                             │
│  INSTRUMEN                                  │
│    ^GSPC — S&P 500 Index                    │
│    GC=F — Gold Futures                      │
│    DX-Y.NYB — US Dollar Index               │
│                                             │
│  WIDGET                                     │
│    Toggle Yield Curve Panel                 │
│    Toggle VIX Regime Panel                  │
│                                             │
│  AKSI                                       │
│    Refresh All Data            ⌘R           │
│    Reset Layout                             │
└─────────────────────────────────────────────┘
```

#### 4.5.2 Styling

- Overlay: `fixed inset-0 z-50` dengan backdrop blur
- Container: `max-w-lg mx-auto mt-[20vh]` dengan `glass` class
- Input: `bg-transparent border-none outline-none font-mono`
- Item: `px-4 py-2` dengan hover `bg-white/5`
- Kategori: `text-[10px] uppercase tracking-wider text-text-muted`
- Shortcut: `text-[10px] font-mono text-text-muted` dengan kbd styling

#### 4.5.3 Animasi

- Fade in overlay: 150ms
- Slide up container: 200ms
- Stagger item: 30ms per item

### 4.6 State Management

```typescript
// frontend/src/hooks/useCommandPalette.ts

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  commands: Command[];
  filteredCommands: Command[];
}

interface CommandPaletteContextValue extends CommandPaletteState {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (q: string) => void;
  executeCommand: (cmd: Command) => void;
}
```

**Integrasi**: Tambahkan `CommandPaletteProvider` di dalam `MacroTerminalProvider` atau sebagai sibling.

### 4.7 Aksesibilitas

- `role="dialog"` + `aria-modal="true"` pada overlay
- `aria-label="Command palette"` pada input
- `aria-activedescendant` pada item terpilih
- `aria-selected` pada item terpilih
- Focus trap di dalam palette
- `Esc` menutup palette dan mengembalikan focus ke elemen sebelumnya

---

## 5. Backend — Endpoint Baru

### 5.1 `GET /api/v1/macro/candles`

#### 5.1.1 Request

```
GET /api/v1/macro/candles?symbol=^GSPC&tf=1M&limit=500
```

| Parameter | Type | Required | Default | Keterangan |
|-----------|------|----------|---------|------------|
| `symbol` | string | Ya | — | Simbol instrumen |
| `tf` | string | Ya | — | Timeframe (1D, 5D, 1M, 3M, 6M, 1Y, 5Y, MAX) |
| `limit` | number | Tidak | 500 | Jumlah candle maksimal |

#### 5.1.2 Response

```typescript
interface CandlesResponse {
  success: boolean;
  data: {
    symbol: string;
    timeframe: string;
    candles: Candle[];
    source: "yahoo" | "stooq" | "cache";
    fromCache: boolean;
    fetchedAt: string;
  };
  error?: string;
  rateLimited: boolean;
}

interface Candle {
  time: number;      // Unix timestamp (detik)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

#### 5.1.3 Error Handling

| Status | Kondisi | Response |
|--------|---------|----------|
| 200 | Success | `{ success: true, data: {...} }` |
| 400 | Parameter invalid | `{ success: false, error: "Invalid symbol or timeframe" }` |
| 429 | Rate limited | `{ success: false, error: "Rate limited", rateLimited: true }` |
| 503 | Semua provider gagal | `{ success: false, error: "All providers unavailable", rateLimited: true }` |

### 5.2 Provider Chain

```
Yahoo Finance (primary)
    ↓ (gagal / rate limited)
Stooq (fallback 1)
    ↓ (gagal)
Cache (fallback 2 — stale-while-revalidate)
    ↓ (tidak ada cache)
Error
```

#### 5.2.1 Yahoo Finance Provider

```typescript
// server/src/services/macro/providers/yahoo-candles.provider.ts

export async function fetchYahooCandles(
  symbol: string,
  timeframe: ChartTimeframe,
  limit: number
): Promise<Candle[]> {
  const { range, interval } = mapTimeframe(timeframe);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
  
  const resp = await axios.get(url, { timeout: 5000 });
  const result = resp.data?.chart?.result?.[0];
  
  if (!result) return [];
  
  const timestamps = result.timestamp || [];
  const ohlc = result.indicators?.quote?.[0] || {};
  const volumes = result.indicators?.adjclose?.[0]?.adjclose || ohlc.volume || [];
  
  return timestamps.map((t: number, i: number) => ({
    time: t,
    open: ohlc.open?.[i] ?? 0,
    high: ohlc.high?.[i] ?? 0,
    low: ohlc.low?.[i] ?? 0,
    close: ohlc.close?.[i] ?? 0,
    volume: volumes[i] ?? 0,
  })).filter(c => c.close > 0);
}
```

#### 5.2.2 Stooq Provider

```typescript
// server/src/services/macro/providers/stooq-candles.provider.ts

export async function fetchStooqCandles(
  symbol: string,
  timeframe: ChartTimeframe
): Promise<Candle[]> {
  // Stooq format: s=^spx, d1/d2 range, i=interval (d/w/m)
  const stooqSymbol = mapToStooqSymbol(symbol);
  const interval = mapTimeframeToStooq(timeframe);
  
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=${interval}`;
  const resp = await axios.get(url, { timeout: 5000 });
  
  // Parse CSV
  return parseStooqCSV(resp.data);
}
```

### 5.3 Cache Strategy

**TTL per timeframe**:

| Timeframe | TTL |
|-----------|-----|
| `1D` | 30 detik |
| `5D` | 2 menit |
| `1M` | 5 menit |
| `3M` | 15 menit |
| `6M` | 30 menit |
| `1Y` | 2 jam |
| `5Y` | 6 jam |
| `MAX` | 12 jam |

**Cache key**: `candles:${symbol}:${tf}`

**Stale-while-revalidate**:
1. Cek cache → jika ada & tidak expired → return cache + `fromCache: true`
2. Jika ada & expired → return cache + `stale: true` + trigger background refresh
3. Jika tidak ada → fetch dari provider → simpan cache → return

### 5.4 Route Pattern

Mengikuti pola existing di `macro-regime.routes.ts`:

```typescript
// server/src/routes/macro-candles.routes.ts

import { Router } from "express";
import { macroCandlesService } from "../services/macro-candles.service";
import { silentLogger } from "../utils/silent-logger";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { symbol, tf, limit } = req.query;
    const data = await macroCandlesService.getCandles(
      symbol as string,
      tf as string,
      parseInt(limit as string) || 500
    );
    res.json({
      success: true,
      data,
      fetchedAt: new Date().toISOString(),
      rateLimited: false,
    });
  } catch (error: any) {
    silentLogger.error("[MacroCandles Route] Error:", error.message);
    res.status(503).json({
      success: false,
      error: error.message,
      rateLimited: true,
    });
  }
});

export default router;
```

**Mount di app.ts**:
```typescript
app.use("/api/v1/macro/candles", macroCandlesRoutes);
```

---

## 6. Integrasi dengan Layout Existing

### 6.1 Penempatan Chart

Chart ditampilkan di **Overview tab** sebagai widget utama:

```
┌─────────────────────────────────────────────────────────────┐
│ Overview Tab                                                 │
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ MacroPriceChart (NEW)   │ │ Regime Panel (existing)     │ │
│ │ ┌─────────────────────┐ │ │                             │ │
│ │ │ ChartToolbar        │ │ │                             │ │
│ │ │ [1D][5D][1M]...     │ │ │                             │ │
│ │ └─────────────────────┘ │ │                             │ │
│ │ ┌─────────────────────┐ │ │                             │ │
│ │ │                     │ │ │                             │ │
│ │ │   Candlestick       │ │ │                             │ │
│ │ │   Chart             │ │ │                             │ │
│ │ │                     │ │ │                             │ │
│ │ └─────────────────────┘ │ │                             │ │
│ │ ┌─────────────────────┐ │ │                             │ │
│ │ │ Volume              │ │ │                             │ │
│ │ └─────────────────────┘ │ │                             │ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Liquidity Gauge         │ │ Heatmap                     │ │
│ │ (existing)              │ │ (existing)                  │ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Tab Lain

Chart juga bisa diakses di tab lain melalui Command Palette:
- **COT tab**: Chart positioning (jika ada data COT per-instrumen)
- **Quant Lab tab**: Chart yield (bukan harga)
- **Intelligence tab**: Chart + AI analysis

### 6.3 State Sharing

Chart state (symbol, timeframe, indikator aktif) disimpan di `MacroTerminalContext` agar bisa diakses dari Command Palette dan widget lain:

```typescript
// Tambahan ke MacroTerminalContext
interface MacroTerminalContextValue {
  // ... existing state ...
  
  // Chart state
  chartSymbol: string;
  chartTimeframe: ChartTimeframe;
  chartIndicators: ActiveIndicator[];
  setChartSymbol: (s: string) => void;
  setChartTimeframe: (tf: ChartTimeframe) => void;
  setChartIndicators: (ind: ActiveIndicator[]) => void;
}
```

---

## 7. State Management

### 7.1 Chart Data Hook

```typescript
// frontend/src/hooks/useChartData.ts

interface UseChartDataResult {
  candles: Candle[];
  isLoading: boolean;
  error: string | null;
  dataStatus: "live" | "cache" | "fallback" | "stale" | "error";
  refetch: () => void;
}

export function useChartData(
  symbol: string,
  timeframe: ChartTimeframe
): UseChartDataResult {
  // Implementation: fetch /api/v1/macro/candles
  // Cache di React Query atau SWR (future)
  // Untuk sekarang: useState + useEffect + fetch
}
```

### 7.2 Command Palette Hook

```typescript
// frontend/src/hooks/useCommandPalette.ts

interface UseCommandPaletteResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  query: string;
  setQuery: (q: string) => void;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  filteredCommands: Command[];
  executeCommand: (cmd: Command) => void;
}

export function useCommandPalette(): UseCommandPaletteResult {
  // Implementation: state + keyboard listener + command registry
}
```

### 7.3 Command Registry

```typescript
// frontend/src/lib/commands.ts

export const commandRegistry: Command[] = [
  // Tab navigation
  { id: "tab-overview", type: "navigation", title: "Go to Overview", ... },
  { id: "tab-cot", type: "navigation", title: "Go to COT", ... },
  // ...
  
  // Instruments
  { id: "instrument-^GSPC", type: "instrument", title: "^GSPC — S&P 500", ... },
  // ...
  
  // Widget toggles
  { id: "widget-toggle-yield", type: "widget", title: "Toggle Yield Curve", ... },
  // ...
  
  // Actions
  { id: "action-refresh", type: "action", title: "Refresh All Data", ... },
  // ...
];
```

---

## 8. Error Handling & Edge Cases

### 8.1 Chart Errors

| Kondisi | Handling |
|---------|----------|
| Symbol tidak valid | Tampilkan error state di chart, saran simbol lain |
| Data kosong | Tampilkan empty state dengan pesan "No data available" |
| Network error | Tampilkan retry button, fallback ke cache |
| Rate limited | Tampilkan status "RATE LIMITED", coba lagi dalam 30 detik |
| Timeframe tidak support | Fallback ke timeframe terdekat yang tersedia |

### 8.2 Command Palette Errors

| Kondisi | Handling |
|---------|----------|
| Tidak ada hasil | Tampilkan "No commands found" |
| Aksi gagal | Tampilkan toast error, palette tetap terbuka |
| Keyboard tidak berfungsi | Fallback ke mouse click |

### 8.3 Loading States

- Chart: Skeleton loading (mirip `Skeleton` component existing)
- Palette: Tidak ada loading (data sudah ada di memory)
- Indikator: Loading indicator kecil di chart

---

## 9. Performance

### 9.1 Bundle Impact

| Library | Ukuran (gzipped) | Impact |
|---------|------------------|--------|
| `lightweight-charts` | ~45 KB | Medium |
| `cmdk` | ~15 KB | Low |
| **Total** | ~60 KB | Acceptable |

**Mitigasi**: Dynamic import untuk `MacroPriceChart` (hanya dimuat saat dibutuhkan).

### 9.2 Rendering Performance

- Canvas-based rendering (lightweight-charts) → smooth 60fps
- Indikator dihitung sekali saat data berubah, bukan per-frame
- Volume sub-chart hanya render jika `showVolume: true`
- RSI/MACD sub-pane hanya render jika indikator aktif

### 9.3 Data Fetching

- Debounce perubahan symbol/timeframe (300ms)
- Abort previous request jika ada request baru
- Cache di backend mengurangi request berulang

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Module | Test |
|--------|------|
| `indicators.ts` | SMA, EMA, VWAP, BB, RSI, MACD — verifikasi output terhadap nilai known |
| `commands.ts` | Filter, scoring, sorting |
| `useChartData` | State transitions, error handling |
| `useCommandPalette` | Keyboard navigation, execute |

### 10.2 Integration Tests

| Scenario | Test |
|----------|------|
| Chart render | Mount MacroPriceChart → verify canvas exists |
| Indikator toggle | Toggle SMA → verify line series appears |
| Palette open | Press ⌘K → verify palette visible |
| Command execute | Type "^GSPC" → Enter → verify chart symbol changes |

### 10.3 E2E Tests

| Scenario | Test |
|----------|------|
| Full flow | Open terminal → ⌘K → search "^GSPC" → Enter → chart shows S&P 500 |
| Timeframe change | Click "1M" → chart updates |
| Indikator add | Click "SMA" → line appears on chart |

---

## 11. Acceptance Criteria

### 11.1 Charting Engine

- [ ] Chart menampilkan candlestick untuk minimal 7 instrumen default
- [ ] 8 timeframe berfungsi (1D, 5D, 1M, 3M, 6M, 1Y, 5Y, MAX)
- [ ] 6 indikator berfungsi (SMA, EMA, VWAP, BB, RSI, MACD)
- [ ] Hover legend menampilkan OHLC + volume + nilai indikator
- [ ] Volume sub-chart tampil
- [ ] RSI & MACD tampil di sub-pane terpisah
- [ ] Loading state tampil saat fetch data
- [ ] Error state tampil saat fetch gagal
- [ ] Chart responsive (resize dengan container)
- [ ] Tidak ada console error saat interaksi normal

### 11.2 Command Palette

- [ ] `⌘K` / `Ctrl+K` membuka palette
- [ ] `Esc` menutup palette
- [ ] `↑` `↓` navigasi berfungsi
- [ ] `Enter` eksekusi perintah berfungsi
- [ ] Pencarian instrumen berfungsi (fuzzy)
- [ ] Lompat tab berfungsi
- [ ] Toggle widget berfungsi
- [ ] Aksi cepat (Refresh) berfungsi
- [ ] Keyboard shortcuts (`⌥1`-`⌥5`) berfungsi
- [ ] Focus trap berfungsi
- [ ] `aria-label` & `role` benar

### 11.3 Backend

- [ ] `GET /api/v1/macro/candles` return data valid
- [ ] Parameter validation berfungsi
- [ ] Rate limiting berfungsi
- [ ] Cache berfungsi (TTL per timeframe)
- [ ] Fallback chain berfungsi (Yahoo → Stooq → Cache)
- [ ] Error response konsisten dengan pola existing

### 11.4 Integration

- [ ] Chart tampil di Overview tab
- [ ] State chart tersimpan di context
- [ ] Command Palette bisa mengubah chart symbol
- [ ] Tidak ada regresi pada panel existing
- [ ] `npx tsc --noEmit` 0 error
- [ ] `npx vitest run` hijau

---

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| `lightweight-charts` API berubah | Chart broken | Pin versi, baca changelog |
| Yahoo Finance rate limit | Data kosong | Fallback ke Stooq + cache |
| Bundle size membesar | EXE lebih besar | Dynamic import, tree-shaking |
| Indikator salah hitung | Analisis misleading | Unit test comprehensive |
| Keyboard conflict | Shortcut bentrok | Gunakan `⌥` (Alt) untuk tab, `⌘` untuk palette |
| Performa menurun | Lag saat render | Canvas-based, debounce, virtualize |
| Aksesibilitas buruk | User tidak bisa pakai keyboard | Focus trap, aria, role |

---

## 13. Rencana Implementasi

### Fase 1 — Charting Engine (3-4 hari)

| Task | Deliverable | Owner |
|------|-------------|-------|
| 1.1 Pasang `lightweight-charts` | Dependency terpasang | forge |
| 1.2 `lib/indicators.ts` + unit test | Fungsi murni + test | riku |
| 1.3 `GET /api/v1/macro/candles` | Endpoint + provider | axis |
| 1.4 `useChartData` hook | Hook + state | nova |
| 1.5 `MacroPriceChart` + `ChartToolbar` | Komponen chart | nova |
| 1.6 Integrasi ke Overview tab | Chart tampil | nova |

### Fase 2 — Command Palette (2-3 hari)

| Task | Deliverable | Owner |
|------|-------------|-------|
| 2.1 Pasang `cmdk` | Dependency terpasang | forge |
| 2.2 `lib/commands.ts` | Command registry | nova |
| 2.3 `useCommandPalette` hook | Hook + keyboard | nova |
| 2.4 `CommandPalette` komponen | UI palette | nova |
| 2.5 Integrasi ke layout | Palette tampil | nova |

### Fase 3 — Polish (1-2 hari)

| Task | Deliverable | Owner |
|------|-------------|-------|
| 3.1 A11y audit | Focus, aria, keyboard | lyra |
| 3.2 Performance check | Bundle size, render perf | vera |
| 3.3 E2E test | Full flow test | vera |
| 3.4 Dokumentasi | USER_GUIDE update | sage |

---

## 14. Referensi

- [MACRO_TERMINAL_DESIGN_PLAN.md](../MACRO_TERMINAL_DESIGN_PLAN.md) — Master plan
- [OpenTerminal](https://github.com/ErTasselli/OpenTerminal) — Referensi charting & palette
- [lightweight-charts docs](https://tradingview.github.io/lightweight-charts/) — API reference
- [cmdk docs](https://cmdk.paco.me/) — Command palette library
- [Yahoo Finance API](https://query1.finance.yahoo.com/v8/finance/chart/) — Data source

---

*Dokumen ini adalah SPEC. Implementasi dimulai hanya setelah review & persetujuan.*

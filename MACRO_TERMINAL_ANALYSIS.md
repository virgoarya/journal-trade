# Macro Terminal - Formula & Logic Analysis

Dokumen analisis mendalam tentang rumus, logika, dan pendekatan perhitungan di Macro Terminal.

---

## Daftar Isi

1. [Ringkasan Arsitektur](#1-ringkasan-arsitektur)
2. [Tab Overview](#2-tab-overview)
3. [Tab Quant Lab](#3-tab-quant-lab)
4. [Tab Nexus](#4-tab-nexus)
5. [Tab Intelligence](#5-tab-intelligence)
6. [Macro Regime Matrix](#6-macro-regime-matrix)
7. [Formula & Logika Kunci](#7-formula--logika-kunci)
8. [Rencana Modifikasi](#8-rencana-modifikasi)

---

## 1. Ringkasan Arsitektur

### Struktur Utama

```
Macro Terminal
├── Context (MacroTerminalContext.tsx) - SSOT data & state management
├── Provider - Data fetching & WebSocket integration
├── Layout - Tab navigation & status strips
└── 4 Tabs:
    ├── Overview → HeatmapPanel + MacroRegimePanel
    ├── Quant Lab → YieldCurvePanel + CurveExplainerPanel
    ├── Nexus → Causal Loop Diagram (Nexus.tsx)
    └── Intelligence → AI Chat Interface
```

### Aliran Data

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   External      │     │   Server API     │     │   Frontend       │
│   APIs          │────▶│   (Express)      │────▶│   (React/Next)   │
│                 │     │                  │     │                  │
│ • Yahoo Finance │     │ • macro-regime   │     │ • MacroContext   │
│ • FRED          │     │ • quant          │     │ • useDataFetching│
│ • Finnhub       │     │ • market-data    │     │ • useWebSocket   │
│ • RSS Feeds     │     │ • macro-ai       │     │ • useRegimeAnalysis│
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 2. Tab Overview

### Komponen Utama: `HeatmapPanel.tsx` & `MacroRegimePanel.tsx`

#### 2.1 HeatmapPanel - Logika Heatmap ETF

**Warna Berdasarkan Perubahan Harga:**
```typescript
// Color coding logic
if (change > 2) return "bg-data-profit text-white";        // > +2% = Hijau terang
if (change > 1) return "bg-data-profit/80 text-white";      // +1-2% = Hijau sedang
if (change > 0) return "bg-data-profit/40 text-data-profit"; // 0-1% = Hijau redup
if (change < -2) return "bg-data-loss text-white";        // < -2% = Merah terang
if (change < -1) return "bg-data-loss/80 text-white";      // -1-2% = Merah sedang
if (change < 0) return "bg-data-loss/40 text-data-loss";   // 0-(-1)% = Merah redup
```

**Status Pasar (New York Time):**
```typescript
// Market session classification
if (weekday === "Sat" || weekday === "Sun") return "CLOSED";
if (time >= 4.0 && time < 9.5) return "PRE-MARKET";        // 4:00-9:30 AM
if (time >= 9.5 && time < 16.0) return "LIVE";             // 9:30 AM - 4:00 PM
if (time >= 16.0 && time < 20.0) return "AFTER-HOURS";     // 4:00-8:00 PM
```

#### 2.2 MacroRegimePanel - Klasifikasi Regime

**Pendekatan Dual-EMA + ROC:**
```typescript
// Momentum classification
const CROSS_THRESHOLD = 0.0008;  // 0.08% dead zone
const ROC_THRESHOLD = 0.05;      // 0.05% minimum ROC

// Status determination:
// NEUTRAL: abs(delta) < CROSS_THRESHOLD && abs(roc) < ROC_THRESHOLD
// TURNING: abs(delta) < CROSS_THRESHOLD * 3 && abs(roc) >= ROC_THRESHOLD
// ACCELERATING: delta > CROSS_THRESHOLD
// DECELERATING: delta < -CROSS_THRESHOLD
```

**Klasifikasi Kuadran (4 Regime):**
| Growth | Inflation | Regime | Deskripsi |
|--------|-----------|--------|-----------|
| ACCELERATING | ACCELERATING | Reflation | Pertumbuhan & inflasi naik |
| ACCELERATING | DECELERATING | Goldilocks | Pertumbuhan naik, inflasi turun |
| DECELERATING | ACCELERATING | Stagflation | Pertumbuhan melambat, inflasi naik |
| DECELERATING | DECELERATING | Deflation | Pertumbuhan & inflasi melambat |

**Confidence Score (0-100 poin):**
```typescript
// Conviction (0-40 poin): Distance from neutral
const conviction = Math.min(40, Math.round(avgDelta * 8000));

// Agreement (0-30 poin): Indicator consensus
const directedCount = allStatuses.filter(s => s !== "NEUTRAL").length;
const agreement = Math.round((directedCount / totalIndicators) * 30);

// Persistence (0-30 poin): Consecutive days in regime
const persistence = Math.min(30, Math.round((consecutiveDays / 25) * 30));

const score = conviction + agreement + persistence;
```

---

## 3. Tab Quant Lab

### Komponen: `YieldCurvePanel.tsx` & `ai-quant.service.ts`

#### 3.1 Yield Curve Regime Classification

**Spread Calculation:**
```typescript
// Spreads in basis points (bps)
spread10y3m = (y10 - y3m) * 100;
spread10y2y = (y10 - y2) * 100;
spread30y5y = (y30 - y5) * 100;
inverted = spread10y2y < 0;
```

**Curve Regime Logic:**
```typescript
if (spreadDelta > 0) {
  // Steepening
  if (delta10 > 0) curveRegime = "Bear Steepener";   // Long rates rising
  else curveRegime = "Bull Steepener";               // Short rates falling
} else {
  // Flattening
  if (delta3m > delta10) curveRegime = "Bear Flattener";
  else curveRegime = "Bull Flattener";
}
```

#### 3.2 Recession Probability Model

**Formula logit-based:**
```typescript
// 10Y-2Y spread in decimal
const sp = spread10y2y / 100;

// Base probability (logistic function)
const base = Math.exp(-0.5333 - 0.633 * sp) / (1 + Math.exp(-0.5333 - 0.633 * sp));

// VIX adjustment (stress factor)
const vixAdjustment = vixValue ? Math.max(0, vixValue - 15) * 0.012 : 0;

// Final probability
const recessionProb = Math.round(Math.min(99, (base + vixAdjustment) * 100));
```

#### 3.3 AI Yield Curve Explainer Prompt

Prompt yang digunakan untuk AI mengandung aturan rule-based wajib:

- **Bear Flattener**: Yield pendek naik lebih cepat dari yield panjang
  - *Implikasi*: Fed hawkish, "Higher for Longer"
  - *Rekomendasi*: SHORT-end (T-Bills), Underweight growth/tech, tekan defensif

- **Bear Steepener**: Yield panjang naik lebih cepat dari yield pendek
  - *Implikasi*: Inflasi struktural, fiscal dominance
  - *Rekomendasi*: SANGAT NEGATIF obligasi, tekan valuasi tinggi

- **Bull Steepener**: Yield pendek turun lebih cepat
  - *Implikasi*: Rate cuts expected, early-recovery
  - *Rekomendasi*: Positif growth/tech, emas bisa naik

- **Bull Flattener**: Yield panjang turun lebih cepat
  - *Implikasi*: Flight to safety, resesi anticipated
  - *Rekomendasi*: SANGAT POSITIF long-duration, defensif

---

## 4. Tab Nexus

### Komponen: `Nexus.tsx`

#### 4.1 Causal Loop Diagram - 14 Nodes

**Zone Layout:**
```
Zone 1 (Kolom 1): Liquidity Drivers
├── CRB Commodities (x:12, y:15)
├── Energy/Oil (x:12, y:35)
├── ON RRP (x:12, y:55)
└── TGA (x:12, y:75)

Zone 2 (Kolom 2): Policy Transformers
├── Growth Sentiment (x:30, y:20)
├── Inflation (x:30, y:40)
├── Net Liquidity (x:30, y:65)
├── Federal Reserve (x:50, y:45)
└── DXY (x:50, y:70)

Zone 3 (Kolom 3): Capital Destination
├── Yield Curve (x:68, y:35)
├── Real Yield (x:88, y:20)
├── Risk Assets (SP500) (x:88, y:45)
├── Gold (x:88, y:65)
└── VIX (x:88, y:85)
```

#### 4.2 Edge Routing (51 Edges)

**Custom Routes untuk Minimal Crossing:**
```typescript
// Contoh custom routing
if (from === "crb" && to === "inf") {
  pathD = `M ${startX},${sy1} L 22.5,${sy1} L 22.5,${ty2} L ${endX},${ty2}`;
}
```

#### 4.3 Node Color Logic

**Composite Decision Tree:**
```typescript
// Equity (SPY) color logic:
if (spyDelta > 0 && netLiqDelta > 0) return "#22c55e"; // Liquidity Driven
if (spyDelta > 0 && ryDelta > 0) return "#f59e0b";    // Defying Gravity
if (spyDelta < 0 && ryDelta > 0) return "#ef4444";    // Yield Pressured
if (spyDelta < 0 && netLiqDelta < 0) return "#ef4444"; // Liquidity Drain

// Gold color logic:
if (goldDelta > 0 && ryDelta < 0) return "#22c55e";  // Yield Supported
if (goldDelta < 0 && ryDelta > 0) return "#ef4444";  // Yield Pressured
if (goldDelta > 0 && ryDelta > 0) return "#f59e0b";  // Debasement Fear
```

#### 4.4 Pulsating Logic (Trigger untuk Animasi)

```typescript
const pulseThresholds = {
  crb: Math.abs(commodities.delta) > 2.0,
  oil: Math.abs(crude_oil.delta) > 3.0,
  onrrp: Math.abs(rrp.delta) > 20,
  tga: Math.abs(tga.delta) > 50,
  liq: Math.abs(netLiqDelta) > 50,
  growth: value > 75 || value < 55,
  inf: value > 3.5 || value < 1.5,
  fed: status === "Tightening" || status === "Easing",
  dxy: Math.abs(delta) > 0.5,
  yc: spread > 100 || spread < -50,
  ry: value > 2.0 || value < 0.0,
  eq: Math.abs(spyDelta) > 1.5,
  gold: Math.abs(delta) > 1.5,
  vix: value >= 20,
};
```

#### 4.5 Status Label Generation

```typescript
// Contoh status label kompleks
case "eq":
  if (spyDelta > 0 && netLiqDelta > 0) statusLabel = "Liquidity Driven Rally";
  else if (spyDelta > 0 && ryDelta > 0) statusLabel = "Defying Gravity";
  else if (spyDelta < 0 && ryDelta > 0) statusLabel = "Yield Pressured";
  else if (spyDelta < 0 && netLiqDelta < 0) statusLabel = "Liquidity Drain";
  else statusLabel = spyDelta > 0 ? "Bullish" : "Bearish";
  break;
```

---

## 5. Tab Intelligence

### AI Analysis Endpoints

**analyzeRegime** (`/api/v1/macro-ai/analyze-regime`):
- Menggunakan state dari Macro Regime (growth, inflation, liquidity)
- Menghasilkan narasi 4 kalimat tentang:
  1. Apa yang terjadi
  2. Apa yang akan datang (ROC-5d)
  3. Likuiditas & risiko
  4. Invalidation trigger

**analyzeNexus** (`/api/v1/macro-ai/analyze-nexus`):
- Menganalisis arus kausal dari Nexus diagram
- Memberikan insight tentang:
  - ENGINE: Driver utama
  - SQUEEZE: Bottleneck tekanan
  - FLOW: Arah arus modal
  - TRADE RISK: Risiko positif
  - INVALIDATION TRIGGER

**observePlaybook** (`/api/v1/macro-ai-observer/observe-playbook`):
- Menghasilkan rekomendasi alokasi aset per regime
- Output: JSON dengan asset dan deskripsi

---

## 6. Macro Regime Matrix

### SSOT: `macro-regime.service.ts`

#### 6.1 Composite Ratio Calculation

**Growth Composite (bobot: 40% XLY/XLP, 30% IWM/TLT, 30% XLI/XLU):**
```typescript
const growthComposite = w1 * ratio1 + w2 * ratio2 + w3 * ratio3;
// Fallback: hanya gunakan yang tersedia
```

**Inflation Composite (bobot: 70% TIP/IEF, 30% GLD/UUP, 30% CPI YoY):**
```typescript
const inflationComposite = w1 * ratio1 + w2 * ratio2 + w3 * cpiRatio;
```

#### 6.2 EMA & ROC Calculation

```typescript
// EMA-10 & EMA-50 untuk momentum
function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i-1] * (1 - k));
  }
  return ema;
}

// ROC-5 hari
function calculateROC(data, period = 5) {
  return ((data[i] / data[i-period]) - 1) * 100;
}
```

#### 6.3 Momentum Classification

```typescript
// Threshold parameters
const CROSS_THRESHOLD = 0.0008;  // 0.08%
const ROC_THRESHOLD = 0.05;      // 0.05%

// Classification rules
if (abs(delta) < CROSS_THRESHOLD && abs(roc) < ROC_THRESHOLD) return "NEUTRAL";
if (abs(delta) < CROSS_THRESHOLD * 3 && abs(roc) >= ROC_THRESHOLD) return "TURNING";
if (delta > CROSS_THRESHOLD) return "ACCELERATING";
if (delta < -CROSS_THRESHOLD) return "DECELERATING";
```

---

## 7. Formula & Logika Kunci

### 7.1 Net Liquidity Calculation

```typescript
// Di Nexus.tsx & MacroTerminalContext.tsx
const netLiqValue = walcl.value - tga.value - rrp.value;
const netLiqDelta = walcl.delta - tga.delta - rrp.delta;
```

### 7.2 Inflation Proxy (ETF)

```typescript
// Dari MacroTerminalContext.tsx line 966
const inflationProxy = (tip + gld) / 2;
// TIP = TIPS (Real Yield), GLD = Gold
```

### 7.3 Fed Policy Status Derivation

```typescript
// Dari Nexus.tsx line 876-888
if (Math.abs(delta) < 0.01) {
  fedStatus = rate >= 3.0 ? "Restrictive Hold" : rate <= 1.0 ? "Accommodative" : "Pause";
} else {
  fedStatus = delta > 0 ? "Tightening" : "Easing";
}
```

### 7.4 VIX Regime Classification

```typescript
// Dari MacroTerminalContext.tsx line 183-189
if (vix < 15) return "CALM";
if (vix < 20) return "NORMAL-CAUTIOUS";
if (vix < 30) return "ELEVATED";
return "FEAR";
```

---

## 8. Rencana Modifikasi

### 8.1 Enhancement Proposals

#### A. Yield Curve Panel
- [ ] Tambahkan spread 30Y-5Y dan 30Y-3M
- [ ] Visualisasi forward curve scenarios
- [ ] Tambahkan probability density bands

#### B. Nexus Diagram
- [ ] Animasi aliran panas (heat flow) berdasarkan delta
- [ ] Tambahkan tooltip mendalam per edge
- [ ] Import/export causal model sebagai JSON

#### C. Macro Regime Matrix
- [ ] Tambahkan transition probability matrix
- [ ] Tambahkan scenario analysis (what-if)
- [ ] Export regime playbook ke PDF

#### D. AI Enhancement
- [ ] Multi-language support (EN/ID/VN)
- [ ] Custom persona training
- [ ] Historical backtest narasi

### 8.2 Technical Debt

1. **Duplikasi Tipe Data**
   - `RegimeMetricData` ada di 3 tempat: context, types.ts, macro-regime.service
   - Harus dikonsolidasikan ke single source of truth

2. **Cache Strategy**
   - Server cache menggunakan Map, belum persistent
   - Perlu Redis untuk production

3. **Error Handling**
   - Banyak fallback hardcoded "N/A"
   - Perlu error boundary yang konsisten

### 8.3 Performance Optimization

```
Rekomendasi:
1. Virtualisasi nodes di Nexus untuk 14+ nodes
2. Debounce ws updates (sekarang tiap update langsung render)
3. Prefetch data untuk tab selanjutnya
4. Implement service worker untuk cache lintas-session
```

---

## Appendix A: Node Quality Metrics

| Node | Source | Confidence | Freshness |
|------|--------|------------|-----------|
| VIX | Yahoo/FRED | 76-82 | live/cache |
| Yield Curve | FRED | 82 | live |
| Real Yield | FRED:DFII10 | 78 | live |
| TGA | treasury.gov | 86 | live |
| DXY | Yahoo | 76 | live |
| Fed Funds | FRED | 90 | live |
| CRB | Finnhub | 72 | live |
| Gold | Yahoo | 78 | live |
| Growth | FRED:UMCSENT | 76 | live |

---

*Generated: 2026-06-23*
*Author: Claude Code Analysis*
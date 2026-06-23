# Macro Terminal - Modification Plan

Rencana modifikasi lanjutan untuk Macro Terminal berdasarkan analisis.

---

## Fase 1: Bug Fixes & Stability (Prioritas Tinggi)

### 1.1 Type Consolidation
**Masalah:** Tipe data duplikat di 3 lokasi
- `RegimeMetricData` di `types.ts`, `MacroTerminalContext.tsx`, dan `macro-regime.service.ts`

**Solusi:**
- [ ] Pindahkan definisi tipe ke `types.ts` sebagai single source of truth
- [ ] Export dari `types.ts` ke semua modul
- [ ] Hapus definisi lokal di context dan service

### 1.2 Cache Implementation
**Masalah:** Server cache menggunakan Map di-memory, hilang saat restart

**Solusi:**
- [ ] Integrasikan Redis untuk persistent cache
- [ ] Implement cache warming pada startup
- [ ] Tambahkan cache invalidation strategy

### 1.3 Error Boundary Enhancement
**Masalah:** Error handling tidak konsisten

**Solusi:**
- [ ] Buat error boundary yang konsisten untuk semua tab
- [ ] Tambahkan retry mechanism dengan exponential backoff
- [ ] Implement offline mode dengan data cache

---

## Fase 2: Feature Enhancement (Prioritas Sedang)

### 2.1 Yield Curve Panel Enhancement

**Target:** `YieldCurvePanel.tsx`

#### 2.1.1 Tambahkan Spread Komprehensif
```typescript
// Spread yang akan ditambahkan:
spread30y5y = y30 - y5;   // Medium-term slope
spread30y3m = y30 - y3m;  // Long-short exotic
spread5y2y = y5 - y2;     // Medium-term
spread2y1y = y2 - y1;     // Short-term (jika tersedia)
```

#### 2.1.2 Forward Curve Visualization
- [ ] Tambahkan tab "Forward Curve" dengan simulation
- [ ] Input: expected path rates dari Fed Funds
- [ ] Output: probability scenarios

#### 2.1.3 Recession Probability Enhancement
```typescript
// Model yang akan ditingkatkan:
// 1. Tambahkan term: credit spread proxy
// 2. Tambahkan term: yield curve momentum
// 3. Tambahkan ensemble model dengan Monte Carlo
```

### 2.2 Nexus Diagram Enhancement

**Target:** `Nexus.tsx`

#### 2.2.1 Heat Flow Animation
```typescript
// Implementasi heat flow berdasarkan delta magnitude
const heatIntensity = Math.abs(netLiqDelta) / 100; // normalized
const flowAnimation = {
  strokeDasharray: `${50 + heatIntensity * 50} 20`,
  animationDuration: 2000 + heatIntensity * 3000
};
```

#### 2.2.2 Deep Tooltip
- [ ] Tambahkan histori perubahan (7 hari)
- [ ] Tambahkan correlation matrix
- [ ] Tambahkan ekspektasi pasar (breakeven)

#### 2.2.3 Export/Import Causal Model
```typescript
// Export format:
{
  nodes: [...],
  edges: [...],
  metadata: {
    version: "1.0",
    created: ISODate,
    regime: string
  }
}
```

### 2.3 Macro Regime Matrix Enhancement

**Target:** `MacroRegimePanel.tsx`

#### 2.3.1 Transition Probability Matrix
```typescript
// Markov chain untuk transition probability
const transitionMatrix = {
  Reflation: {
    to: {
      Reflation: 0.6,
      Goldilocks: 0.3,
      Transition: 0.1
    }
  },
  // ... dst
};
```

#### 2.3.2 Scenario Analysis
- [ ] Monte Carlo simulation untuk growth/inflation
- [ ] Tambahkan scenario: "Hard Landing", "Soft Landing", "Mistaken Optimism"
- [ ] Visualisasi scenario dengan probability bands

#### 2.3.3 Playbook Export
- [ ] Export ke PDF dengan formatting profesional
- [ ] Tambahkan timestamp dan signature
- [ ] Tambahkan disclaimer hukum

---

## Fase 3: AI Enhancement (Prioritas Rendah)

### 3.1 Multi-Language Support
- [ ] Implement i18n untuk prompt AI
- [ ] Tambahkan bahasa: English, Vietnamese, Thai
- [ ] Auto-detect language dari browser

### 3.2 Custom Persona Training
```typescript
// Persona yang akan ditambahkan:
const personas = {
  hawk: {
    focus: ["inflation", "liquidity_drain", "yield_curve_inversion"],
    tone: "bearish_leaning"
  },
  dove: {
    focus: ["growth_acceleration", "liquidity_injection", "yield_curve_steepening"],
    tone: "bullish_leaning"
  },
  contrarian: {
    focus: ["market_excess", "narrative_divergence", "anomalies"],
    tone: "skeptical"
  },
  quant: {
    focus: ["statistical_signals", "mean_reversion", "volatility_surface"],
    tone: "data_driven"
  }
};
```

### 3.3 Historical Backtest
- [ ] Simpan narasi AI ke database
- [ ] Compare dengan hasil pasar aktual
- [ ] Hitung accuracy rate per persona

---

## Fase 4: Infrastructure & Performance

### 4.1 WebSocket Optimization
```typescript
// Current: Tiap update langsung broadcast
// Proposed: Batch updates dengan debounce

const batchUpdates = new Map();
const DEBOUNCE_MS = 1000;

function queueUpdate(key, data) {
  batchUpdates.set(key, data);
  debouncedBroadcast();
}

function debouncedBroadcast() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    broadcast('batch_update', Object.fromEntries(batchUpdates));
    batchUpdates.clear();
  }, DEBOUNCE_MS);
}
```

### 4.2 Service Worker Implementation
- [ ] Cache API responses di browser
- [ ] Implement offline-first untuk dashboard
- [ ] Background sync untuk data penting

### 4.3 Monitoring & Alerting
```typescript
// Health check endpoints:
GET /api/health/data-freshness
GET /api/health/ai-response-time
GET /api/health/cache-hit-rate

// Alert rules:
- Data stale > 10 menit
- AI response > 5 detik
- Cache miss > 50%
```

---

## Timeline Perubahan

| Fase | Durasi | Milestone |
|------|--------|-----------|
| Fase 1 | 1-2 minggu | Bug fixes, stability |
| Fase 2 | 2-4 minggu | Feature enhancement |
| Fase 3 | 1-2 minggu | AI improvements |
| Fase 4 | 2-3 minggu | Infrastructure |

---

## Resource Requirements

### Engineering
- 1 Frontend Engineer (React/Next.js)
- 1 Backend Engineer (Node.js/Express)
- 1 DevOps Engineer (Redis, Monitoring)

### AI/ML
- 1 Quant Researcher (prompt engineering)
- 1 Data Scientist (model enhancement)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.5% | Pingdom/Datadog |
| Response Time | < 500ms | API latency |
| AI Accuracy | > 70% | Backtest |
| User Engagement | > 10 menit/session | Analytics |
| Cache Hit Rate | > 80% | Redis metrics |

---

*Terakhir diupdate: 2026-06-23*
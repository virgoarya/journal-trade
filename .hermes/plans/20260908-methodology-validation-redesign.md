# Plan: Signal Validation & Checklist Hierarchy Redesign

**Date:** 2026-09-08
**Status:** Draft — menunggu approval

---

## Problem Statement

Signal kurang akurat karena:
1. SMC/ICT/MSNR berjalan **parallel tanpa urutan** — M5 trigger bisa jalan sebelum HTF bias valid
2. **Candle state tidak dibedakan** — structure (BOS/OB/FVG) bisa pakai candle forming (tick-incomplete)
3. **Tidak ada guardrails** — spread tinggi, sesi offline, news high-impact lolos masuk pipeline
4. **Confluence score transparan tapi tidak terstruktur** — sulit debug kenapa signal pass/fail

---

## Architecture: Sequential HTF→LTF Pipeline

```
[MT5 Tick Data]
       │
       ▼
┌──────────────────────────────────────────┐
│  Phase 1: HTF Bias (H4/D1)              │
│  Cache: 60s | Check: Structure Direction │
│  Output: BULLISH / BEARISH / SIDEWAYS    │
│  Early-exit: SIDEWAYS → reject signal    │
└──────────────────────────────────────────┘
       │ PASS
       ▼
┌──────────────────────────────────────────┐
│  Phase 2: M15 Structure                  │
│  Cache: 2s | Check: BOS/CHOCH/OB/FVG    │
│  CandleState: CLOSED ONLY                │
│  Output: Valid structure + direction      │
│  Early-exit: No valid structure → skip   │
└──────────────────────────────────────────┘
       │ PASS
       ▼
┌──────────────────────────────────────────┐
│  Phase 3: M5 Trigger                     │
│  Cache: none (real-time) | Check: Entry  │
│  CandleState: FORMING allowed            │
│  Output: Entry/SL/TP levels              │
│  Early-exit: No trigger → no signal      │
└──────────────────────────────────────────┘
       │ PASS
       ▼
┌──────────────────────────────────────────┐
│  Phase 4: Methodology Scoring            │
│  SMC: 0-100 | ICT: 0-100 | MSNR: 0-100 │
│  Weighted total ≥ 65 → PASS              │
│  Output: Score + alasan per methodology   │
└──────────────────────────────────────────┘
       │ PASS
       ▼
┌──────────────────────────────────────────┐
│  Phase 5: Guardrails                     │
│  Spread ≤ ATR×0.1 | Session: London/NY   │
│  News: skip high-impact | Daily DD: -3%  │
│  Correlation: no same-direction overlap   │
│  Early-exit: any fail → reject           │
└──────────────────────────────────────────┘
       │ ALL PASS
       ▼
[EXECUTE TRADE]
```

---

## File Changes

### 1. `server/src/services/strategies/confluence-engine.ts`
**Tambah `CandleState` enum + weighted score detail**

```typescript
// Tambah di top file
export enum CandleState { CLOSED = "CLOSED", FORMING = "FORMING" }

// Extend ConfluenceResult
export interface ConfluenceResult {
  // ... existing fields ...
  scores: {
    smc: number;
    ict: number;
    msnr: number;
    total: number;
    passed: boolean;
  };
  htfBias: "BULLISH" | "BEARISH" | "SIDEWAYS";
  m15Structure: {
    valid: boolean;
    direction: "BULL" | "BEAR" | null;
    candleState: CandleState;
  };
  validationSteps: string[];  // log urutan validasi
  guardrailFlags: string[];   // log guardrails yg aktif
}
```

### 2. `server/src/services/trading-pipeline.service.ts`
**Refactor `processSymbol()` jadi sequential pipeline**

```typescript
// Ganti Promise.all([smc, ict, msnr]) jadi sequential
async function validateAndGenerateSignal(symbol: string) {
  const validationSteps: string[] = [];
  const startTime = Date.now();

  // Phase 1: HTF Bias (H4/D1)
  const htf = await this.getHTFBias(symbol);  // reuse aiTradingEngine.analyzeSymbol
  if (htf.direction === "SIDEWAYS") {
    validationSteps.push("FAIL: HTF bias SIDEWAYS");
    return { valid: false, reason: "HTF SIDEWAYS", steps: validationSteps };
  }
  validationSteps.push(`PASS: HTF bias = ${htf.direction}`);

  // Phase 2: M15 Structure (CLOSED candles only)
  const m15 = await this.getM15Structure(symbol);
  if (!m15.valid) {
    validationSteps.push("FAIL: No valid M15 structure");
    return { valid: false, reason: "No M15 structure", steps: validationSteps };
  }
  validationSteps.push(`PASS: M15 ${m15.direction} (${m15.type})`);

  // Phase 3: M5 Trigger (FORMING allowed)
  const m5 = await this.getM5Trigger(symbol, m15.direction);
  if (!m5.valid) {
    validationSteps.push("FAIL: No M5 trigger");
    return { valid: false, reason: "No M5 trigger", steps: validationSteps };
  }
  validationSteps.push(`PASS: M5 trigger = ${m5.type}`);

  // Phase 4: Confluence scoring (parallel OK — data final)
  const confluence = confluenceEngine.calculateConfluence(
    /* ... existing params ... */
  );
  if (!confluence.scores.passed) {
    validationSteps.push(`FAIL: Confluence score ${confluence.scores.total} < 65`);
    return { valid: false, reason: "Low confluence", steps: validationSteps };
  }
  validationSteps.push(`PASS: Confluence score = ${confluence.scores.total}`);

  // Phase 5: Guardrails
  const guardrails = await this.checkGuardrails(symbol, m5);
  if (!guardrails.passed) {
    validationSteps.push(`FAIL: Guardrails [${guardrails.flags.join(", ")}]`);
    return { valid: false, reason: "Guardrail blocked", steps: validationSteps };
  }
  validationSteps.push("PASS: All guardrails OK");

  const latencyMs = Date.now() - startTime;
  validationSteps.push(`TOTAL: ${latencyMs}ms`);

  return {
    valid: true,
    signal: m5.signal,
    confluence,
    latencyMs,
    steps: validationSteps,
  };
}
```

**Tambah guardrails helper:**

```typescript
private async checkGuardrails(symbol: string, m5: M5Trigger) {
  const flags: string[] = [];
  const sym = await mt5McpService.getSymbolInfo(symbol);
  const atr = await this.getATR(symbol, "M5");
  const spreadVal = sym.spread * sym.point;

  // 1. Max spread
  if (atr > 0 && spreadVal > atr * 0.1) {
    flags.push(`SPREAD ${spreadVal.toFixed(5)} > ATR×0.1 ${(atr * 0.1).toFixed(5)}`);
  }

  // 2. Trading session (London/NY overlap preferred)
  const now = new Date();
  const hour = now.getUTCHours();
  const isSession = (hour >= 7 && hour <= 16); // London 07-16 UTC
  if (!isSession) {
    flags.push(`OFF-SESSION (UTC ${hour}:00)`);
  }

  // 3. Daily drawdown
  const account = await mt5McpService.getAccountInfo();
  const todayPL = await this.getTodayPL(account.login);
  const dailyDD = todayPL / account.balance;
  if (dailyDD < -0.03) {
    flags.push(`DAILY DD ${dailyDD.toFixed(2)}% < -3%`);
  }

  // 4. Max open positions
  const positions = await mt5McpService.getPositions();
  const aiPositions = positions.filter(p => p.comment?.startsWith("AI-"));
  if (aiPositions.length >= this.config.maxOpenPositions) {
    flags.push(`MAX POSITIONS ${aiPositions.length}/${this.config.maxOpenPositions}`);
  }

  return { passed: flags.length === 0, flags };
}
```

### 3. `server/src/services/trading-pipeline.service.ts`
**Tambah `getHTFBias`, `getM15Structure`, `getM5Trigger`**

```typescript
private async getHTFBias(symbol: string) {
  // Reuse existing aiTradingEngine.analyzeSymbol — H4/D1 data
  const analysis = await aiTradingEngine.analyzeSymbol(symbol, ["H4", "D1"]);
  const mkt = analysis.confluence.marketStructure;
  return {
    direction: mkt?.direction ?? "SIDEWAYS",
    strength: mkt?.strength ?? 0,
  };
}

private async getM15Structure(symbol: string) {
  // Fetch M15 CLOSED candles only
  const candles = await mt5McpService.getRates(symbol, "M15", 50);
  if (!candles || candles.length < 10) return { valid: false, direction: null, type: null };

  // Check last 3 M15 candles (all closed)
  const closed = candles.slice(-3);
  const hasBOS = this.detectBOS(closed);
  const hasOB = this.detectOB(closed);

  if (!hasBOS && !hasOB) return { valid: false, direction: null, type: null };

  const direction = hasBOS ? (hasBOS.direction) : (hasOB?.direction ?? null);
  return { valid: true, direction, type: hasBOS ? "BOS" : "OB" };
}

private async getM5Trigger(symbol: string, expectedDirection: "BULL" | "BEAR") {
  // Fetch M5 real-time (FORMING allowed)
  const candles = await mt5McpService.getRates(symbol, "M5", 20);
  if (!candles || candles.length < 5) return { valid: false, signal: null };

  // Check OTE/FVG/Entry in last 2 M5 candles
  const trigger = this.detectM5Trigger(candles, expectedDirection);
  return trigger ?? { valid: false, signal: null };
}
```

### 4. `server/src/services/trading-pipeline.service.ts`
**Extend `pendingOrders.set` dengan `signalTime` & `validationSteps`**

```typescript
// Baris ~1468, tambah field:
pipeline.pendingOrders.set(finalTicket, {
  // ... existing ...
  latencyMs: analysis.latencyMs,       // NEW
  validationSteps: analysis.steps,     // NEW
  htfBias: analysis.confluence.htfBias, // NEW
});
```

### 5. `frontend/src/services/ai-trading.service.ts`
**Extend `SignalLog` type untuk observability**

```typescript
export interface SignalLog {
  signalId: string;
  symbol: string;
  htfBias: "BULLISH" | "BEARISH" | "SIDEWAYS";
  m15Structure: { valid: boolean; direction: string; type: string };
  m5Trigger: { type: string; entry: number; sl: number; tp: number };
  scores: { smc: number; ict: number; msnr: number; total: number; passed: boolean };
  guardrails: string[];
  validationSteps: string[];
  latencyMs: number;
  timestamp: string;
}
```

### 6. `frontend/src/app/(dashboard)/ai-trading/components/SignalLogPanel.tsx` (NEW)
**Render 50 signal terakhir dengan filter pass/fail**

- Tabel 1 baris per signal
- Kolom: Symbol | HTF | M15 | Score | Guardrails | Latency | Status
- Color: green (PASS) / red (FAIL) / yellow (GUARDRAIL)
- Click bar → expand `validationSteps[]` detail

---

## Implementation Order

| # | Task | File | Estimasi |
|---|------|------|----------|
| 1 | Tambah `CandleState` + `scores` ke `ConfluenceResult` | `confluence-engine.ts` | 15m |
| 2 | Refactor `processSymbol` → sequential `validateAndGenerateSignal` | `trading-pipeline.service.ts` | 30m |
| 3 | Tambah `getHTFBias` / `getM15Structure` / `getM5Trigger` | `trading-pipeline.service.ts` | 20m |
| 4 | Tambah `checkGuardrails` + extend `pendingOrders.set` | `trading-pipeline.service.ts` | 15m |
| 5 | Tambah `SignalLog` type + extend pipeline logging | `ai-trading.service.ts` | 10m |
| 6 | Buat `SignalLogPanel.tsx` + integrate ke dashboard | frontend | 20m |
| 7 | TypeScript compile check + test | terminal | 10m |
| **Total** | | | **~2 jam** |

---

## Success Criteria

- [ ] HTF bias SIDEWAYS → signal langsung reject (tidak sampai M5)
- [ ] M15 structure HANYA pakai closed candle (log `CandleState: CLOSED`)
- [ ] Guardrails (spread, session, DD) block trade saat kondisi tidak ideal
- [ ] Log setiap signal menampilkan `validationSteps[]` lengkap (apa yang pass/fail)
- [ ] Frontend panel menampilkan 50 signal terakhir dengan expand detail
- [ ] TypeScript compile clean (0 errors)
- [ ] Backtest hasilkan 1000+ candle tanpa error

---

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| Sequential pipeline lebih lambat | HTF/M15 sudah di-cache (60s/2s); early-exit hemat CPU |
| `detectBOS`/`detectOB`/`detectM5Trigger` perlu ditulis | Bisa reuse logic dari `smc.strategy.ts` / `ict.strategy.ts` |
| Guardrails false-positive block trade | Bisa config per-symbol; default conservative |
| Frontend panel tambah kompleks | Minimal 1 file baru; extend `SignalLogPanel` only |

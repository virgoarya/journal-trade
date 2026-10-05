# Test Plan: Swing Detection ATR-Based Noise Filter

## Context
- **File**: `server/src/services/strategies/market-structure.service.ts`
- **Methods**: `findSwingHighs` (line 388-399), `findSwingLows` (line 447-458)
- **Filter Logic**: Swing valid jika `|price - lastSwingPrice| >= 0.5 × ATR(14)`
- **Existing Coverage**: 1 test case (monotonic naik, harusnya < 5 swing)

## Gap Analysis
Existing test hanya cover scenario monotonic naik. Edge case yang belum di-test:

| # | Scenario | Risk | Priority |
|---|----------|------|----------|
| 1 | Flat market (ATR rendah) | Filter terlalu agresif → swing valid hilang | High |
| 2 | Spike volatility (ATR tinggi) | Noise swing lolos filter | High |
| 3 | Boundary condition (jarak = 0.5×ATR) | Off-by-one di `>=` vs `>` | Medium |
| 4 | Swing lows (mirror logic) | Bug di `findSwingLows` tidak ke-detect | High |
| 5 | Mixed scenario (naik-turun + noise) | Kombinasi real-world | Medium |

---

## Test Cases

### TC-01: Flat Market — ATR Rendah
**Objective**: Verifikasi filter tidak terlalu agresif saat ATR rendah (flat market).

**Setup**:
- 20 candles dengan range sangat kecil (high-low = 0.5)
- Harga naik gradual: 100 → 101 → 102 → ... → 110
- ATR(14) ≈ 0.5, minGap = 0.25

**Expected**:
- Swing highs tetap terdeteksi (minimal 1-2 swing)
- Filter tidak menghapus SEMUA swing

**Assertion**:
```typescript
const highs = marketStructureService.findSwingHighs(candles);
expect(highs.length).toBeGreaterThanOrEqual(1);
expect(highs.length).toBeLessThan(5); // tidak terlalu banyak
```

---

### TC-02: Spike Volatility — ATR Tinggi
**Objective**: Verifikasi noise swing tidak lolos saat ATR tinggi.

**Setup**:
- 20 candles dengan range besar (high-low = 10)
- Harga naik-turun drastic: 100 → 110 → 95 → 115 → 90 → 120
- ATR(14) ≈ 10, minGap = 5

**Expected**:
- Hanya swing signifikan yang terdeteksi
- Noise swing (jarak < 5) di-filter

**Assertion**:
```typescript
const highs = marketStructureService.findSwingHighs(candles);
// Swing signifikan: 110, 115, 120 (jarak > 5)
// Noise swing (jarak < 5) harus di-filter
for (let i = 1; i < highs.length; i++) {
  expect(Math.abs(highs[i].price - highs[i-1].price)).toBeGreaterThanOrEqual(5);
}
```

---

### TC-03: Boundary Condition — Jarak Tepat 0.5×ATR
**Objective**: Verifikasi off-by-one di `>=` vs `>`.

**Setup**:
- Candles dengan ATR = 2 (range = 2)
- Swing highs di harga 100 dan 101 (jarak = 1 = 0.5 × ATR)

**Expected**:
- Swing di 101 harus di-INCLUDE (karena `>= minGap`)

**Assertion**:
```typescript
const highs = marketStructureService.findSwingHighs(candles);
// Cek apakah swing boundary di-include
const prices = highs.map(h => h.price);
expect(prices).toContain(100);
expect(prices).toContain(101); // boundary: jarak = minGap, harusnya included
```

---

### TC-04: Swing Lows — Mirror Logic
**Objective**: Verifikasi `findSwingLows` punya filter yang sama dengan `findSwingHighs`.

**Setup**:
- 20 candles dengan noise swing lows
- Harga turun gradual dengan noise kecil

**Expected**:
- Swing lows terdeteksi dengan benar
- Noise swing lows di-filter

**Assertion**:
```typescript
const lows = marketStructureService.findSwingLows(candles);
expect(lows.length).toBeGreaterThanOrEqual(1);
expect(lows.length).toBeLessThan(5);
// Verifikasi jarak antar swing lows >= minGap
for (let i = 1; i < lows.length; i++) {
  expect(Math.abs(lows[i].price - lows[i-1].price)).toBeGreaterThanOrEqual(minGap);
}
```

---

### TC-05: Mixed Scenario — Naik-Turun + Noise
**Objective**: Verifikasi filter bekerja di scenario real-world.

**Setup**:
- 30 candles: naik 10 candle, turun 10 candle, naik 10 candle
- Noise swing di setiap fase (jarak < 0.5×ATR)

**Expected**:
- Swing highs terdeteksi di puncak utama
- Swing lows terdeteksi di lembah utama
- Noise swing di-filter

**Assertion**:
```typescript
const highs = marketStructureService.findSwingHighs(candles);
const lows = marketStructureService.findSwingLows(candles);
// Harus ada swing highs dan lows
expect(highs.length).toBeGreaterThanOrEqual(1);
expect(lows.length).toBeGreaterThanOrEqual(1);
// Noise swing tidak boleh lolos
// (verifikasi jarak antar swing >= minGap)
```

---

## Implementation Notes

### Helper Function
```typescript
function makeCandlesWithNoise(
  basePrices: number[],
  noiseRange: number
): Candle[] {
  return basePrices.map((price, i) => ({
    time: 1000 + i * 60,
    open: price - noiseRange / 2,
    high: price + noiseRange,
    low: price - noiseRange,
    close: price + noiseRange / 2,
  }));
}
```

### ATR Calculation
```typescript
// ATR(14) dihitung dari average true range 14 candle terakhir
// True Range = max(high-low, |high-prevClose|, |low-prevClose|)
```

---

## Acceptance Criteria
- [ ] Semua 5 test case pass
- [ ] Coverage untuk `findSwingHighs` dan `findSwingLows` >= 80%
- [ ] Boundary condition (jarak = 0.5×ATR) ter-verifikasi
- [ ] Tidak ada regression di existing test (129/129 tetap pass)

---

## Estimated Effort
- Test implementation: 30 menit
- Debug + fix (if needed): 15 menit
- Total: ~45 menit

---

*Created by VERA — QA Agent*
*Date: 2026-10-06*

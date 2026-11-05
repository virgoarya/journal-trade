import { describe, it, expect } from "vitest";
import {
  sma,
  ema,
  vwap,
  bollingerBands,
  rsi,
  macd,
  computeIndicator,
  indicatorLabel,
  type Candle,
} from "../indicators";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Bangun candle dari daftar close; high/low/volume dibuat deterministik. */
function fromCloses(closes: number[], volume = 1): Candle[] {
  return closes.map((c, i) => ({
    time: 1_700_000_000 + i * 3600,
    open: c,
    high: c,
    low: c,
    close: c,
    volume,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SMA
// ─────────────────────────────────────────────────────────────────────────────

describe("sma", () => {
  it("menghitung rata-rata bergerak dengan benar", () => {
    const candles = fromCloses([1, 2, 3, 4, 5]);
    const out = sma(candles, 3);

    // warm-up 2 titik dilewati -> hanya 3 titik
    expect(out).toHaveLength(3);
    expect(out[0].value).toBeCloseTo(2, 10); // (1+2+3)/3
    expect(out[1].value).toBeCloseTo(3, 10); // (2+3+4)/3
    expect(out[2].value).toBeCloseTo(4, 10); // (3+4+5)/3
  });

  it("mempertahankan timestamp candle yang sesuai", () => {
    const candles = fromCloses([1, 2, 3, 4, 5]);
    const out = sma(candles, 3);
    expect(out[0].time).toBe(candles[2].time);
    expect(out[2].time).toBe(candles[4].time);
  });

  it("mengembalikan array kosong bila data kurang dari period", () => {
    expect(sma(fromCloses([1, 2]), 5)).toEqual([]);
  });

  it("mengembalikan array kosong untuk input kosong", () => {
    expect(sma([], 3)).toEqual([]);
  });

  it("mengabaikan candle dengan harga non-finite", () => {
    const candles = fromCloses([1, 2, 3, 4]);
    candles[1].close = NaN;
    const out = sma(candles, 2);
    // tersisa 3 candle valid -> 2 titik
    expect(out).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMA
// ─────────────────────────────────────────────────────────────────────────────

describe("ema", () => {
  it("seed = SMA(period), lalu rekursif dengan k = 2/(n+1)", () => {
    const candles = fromCloses([1, 2, 3, 4, 5]);
    const out = ema(candles, 3);

    expect(out).toHaveLength(3);
    // seed pada indeks 2 = (1+2+3)/3 = 2
    expect(out[0].value).toBeCloseTo(2, 10);
    // k = 2/4 = 0.5 -> EMA[3] = 4*0.5 + 2*0.5 = 3
    expect(out[1].value).toBeCloseTo(3, 10);
    // EMA[4] = 5*0.5 + 3*0.5 = 4
    expect(out[2].value).toBeCloseTo(4, 10);
  });

  it("bereaksi lebih cepat daripada SMA pada tren naik", () => {
    const candles = fromCloses([10, 10, 10, 10, 20]);
    const e = ema(candles, 4);
    const s = sma(candles, 4);
    // titik terakhir: EMA harus lebih dekat ke harga terbaru (20)
    expect(e[e.length - 1].value).toBeGreaterThan(s[s.length - 1].value);
  });

  it("mengembalikan array kosong bila data kurang dari period", () => {
    expect(ema(fromCloses([1, 2]), 5)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VWAP
// ─────────────────────────────────────────────────────────────────────────────

describe("vwap", () => {
  it("menghitung rata-rata berbobot volume secara kumulatif", () => {
    const candles: Candle[] = [
      { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 1 },
      { time: 2, open: 20, high: 20, low: 20, close: 20, volume: 3 },
    ];
    const out = vwap(candles);

    expect(out).toHaveLength(2);
    expect(out[0].value).toBeCloseTo(10, 10); // 10*1 / 1
    expect(out[1].value).toBeCloseTo(17.5, 10); // (10*1 + 20*3) / 4
  });

  it("memakai typical price (H+L+C)/3", () => {
    const candles: Candle[] = [
      { time: 1, open: 5, high: 12, low: 6, close: 9, volume: 2 },
    ];
    const out = vwap(candles);
    // typical = (12+6+9)/3 = 9
    expect(out[0].value).toBeCloseTo(9, 10);
  });

  it("melewati titik saat volume kumulatif masih nol", () => {
    const candles: Candle[] = [
      { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 0 },
      { time: 2, open: 20, high: 20, low: 20, close: 20, volume: 2 },
    ];
    const out = vwap(candles);
    expect(out).toHaveLength(1);
    expect(out[0].time).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOLLINGER BANDS
// ─────────────────────────────────────────────────────────────────────────────

describe("bollingerBands", () => {
  it("middle = SMA, upper/lower simetris sejauh stdDev * σ", () => {
    const candles = fromCloses([1, 2, 3, 4, 5]);
    const out = bollingerBands(candles, 3, 2);

    expect(out).toHaveLength(3);
    // window [1,2,3]: mean 2, σ = sqrt(2/3) ≈ 0.8165
    const sd = Math.sqrt(2 / 3);
    expect(out[0].middle).toBeCloseTo(2, 10);
    expect(out[0].upper).toBeCloseTo(2 + 2 * sd, 10);
    expect(out[0].lower).toBeCloseTo(2 - 2 * sd, 10);
  });

  it("upper selalu > middle > lower", () => {
    const out = bollingerBands(fromCloses([5, 7, 6, 9, 8, 11, 10]), 3, 2);
    for (const p of out) {
      expect(p.upper).toBeGreaterThan(p.middle);
      expect(p.middle).toBeGreaterThan(p.lower);
    }
  });

  it("σ = 0 saat semua close identik -> upper = middle = lower", () => {
    const out = bollingerBands(fromCloses([7, 7, 7, 7]), 3, 2);
    expect(out[0].upper).toBeCloseTo(7, 10);
    expect(out[0].middle).toBeCloseTo(7, 10);
    expect(out[0].lower).toBeCloseTo(7, 10);
  });

  it("mengembalikan array kosong bila data kurang dari period", () => {
    expect(bollingerBands(fromCloses([1, 2]), 5, 2)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RSI
// ─────────────────────────────────────────────────────────────────────────────

describe("rsi", () => {
  it("memberi 100 saat semua pergerakan naik (avgLoss = 0)", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const out = rsi(fromCloses(closes), 14);
    expect(out.length).toBeGreaterThan(0);
    expect(out[out.length - 1].value).toBeCloseTo(100, 6);
  });

  it("memberi 0 saat semua pergerakan turun (avgGain = 0)", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    const out = rsi(fromCloses(closes), 14);
    expect(out.length).toBeGreaterThan(0);
    expect(out[out.length - 1].value).toBeCloseTo(0, 6);
  });

  it("selalu berada dalam rentang 0..100", () => {
    const closes = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42,
                    45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46, 46.03,
                    46.41, 46.22, 45.64];
    const out = rsi(fromCloses(closes), 14);
    for (const p of out) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });

  it("warm-up tepat satu titik untuk data = period + 1", () => {
    const closes = Array.from({ length: 15 }, (_, i) => 100 + i); // period 14 -> 15 candle
    const out = rsi(fromCloses(closes), 14);
    expect(out).toHaveLength(1);
  });

  it("mengembalikan array kosong bila data <= period", () => {
    expect(rsi(fromCloses([1, 2, 3]), 14)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MACD
// ─────────────────────────────────────────────────────────────────────────────

describe("macd", () => {
  it("histogram = macd - signal pada setiap titik", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const out = macd(fromCloses(closes), 12, 26, 9);

    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(p.histogram).toBeCloseTo(p.macd - p.signal, 10);
    }
  });

  it("macd positif pada tren naik kuat", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i * 2);
    const out = macd(fromCloses(closes), 12, 26, 9);
    expect(out[out.length - 1].macd).toBeGreaterThan(0);
  });

  it("macd negatif pada tren turun kuat", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 300 - i * 2);
    const out = macd(fromCloses(closes), 12, 26, 9);
    expect(out[out.length - 1].macd).toBeLessThan(0);
  });

  it("mengembalikan array kosong bila fast >= slow", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i);
    expect(macd(fromCloses(closes), 26, 12, 9)).toEqual([]);
  });

  it("mengembalikan array kosong bila data kurang dari slow", () => {
    expect(macd(fromCloses([1, 2, 3]), 12, 26, 9)).toEqual([]);
  });

  it("timestamp hasil ada di dalam rentang timestamp candle", () => {
    const candles = fromCloses(Array.from({ length: 60 }, (_, i) => 100 + i));
    const out = macd(candles, 12, 26, 9);
    const first = candles[0].time;
    const last = candles[candles.length - 1].time;
    for (const p of out) {
      expect(p.time).toBeGreaterThanOrEqual(first);
      expect(p.time).toBeLessThanOrEqual(last);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCHER + LABEL
// ─────────────────────────────────────────────────────────────────────────────

describe("computeIndicator", () => {
  const candles = fromCloses(Array.from({ length: 60 }, (_, i) => 100 + i));

  it("mengembalikan bentuk yang benar per tipe", () => {
    const smaOut = computeIndicator("SMA", candles, { period: 5 });
    expect(smaOut.length).toBeGreaterThan(0);
    expect(smaOut[0]).toHaveProperty("value");

    const bbOut = computeIndicator("BB", candles, { bbPeriod: 5, bbStdDev: 2 });
    expect(bbOut[0]).toHaveProperty("upper");
    expect(bbOut[0]).toHaveProperty("lower");

    const macdOut = computeIndicator("MACD", candles);
    expect(macdOut[0]).toHaveProperty("histogram");
  });

  it("menghormati params yang diberikan", () => {
    const p5 = computeIndicator("SMA", candles, { period: 5 });
    const p20 = computeIndicator("SMA", candles, { period: 20 });
    expect(p5.length).toBeGreaterThan(p20.length);
  });
});

describe("indicatorLabel", () => {
  it("memformat label sesuai tipe dan params", () => {
    expect(indicatorLabel("SMA", { period: 20 })).toBe("SMA(20)");
    expect(indicatorLabel("EMA", { period: 21 })).toBe("EMA(21)");
    expect(indicatorLabel("VWAP")).toBe("VWAP");
    expect(indicatorLabel("BB", { bbPeriod: 20, bbStdDev: 2 })).toBe("BB(20,2)");
    expect(indicatorLabel("RSI", { rsiPeriod: 14 })).toBe("RSI(14)");
    expect(indicatorLabel("MACD", { macdFast: 12, macdSlow: 26, macdSignal: 9 })).toBe("MACD(12,26,9)");
  });
});

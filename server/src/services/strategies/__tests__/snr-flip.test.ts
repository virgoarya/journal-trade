import { describe, it, expect } from "vitest";
import { marketStructureService } from "../market-structure.service";
import type { Candle, MalaysianSNR } from "../market-structure.service";
import { NINE_ROUTER_MODELS } from "../../../config/llm-models.config";

// ─── Helper: buat candle sederhana ─────────────────────────────────
function makeCandles(prices: Array<{ open: number; high: number; low: number; close: number; time?: number }>): Candle[] {
  return prices.map((p, i) => ({
    time: p.time ?? 1000 + i * 60,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
  }));
}

describe("detectSNRFlip — RBS/SBR correctness", () => {
  it("RBS: resistance lama di-break ke ATAS → type RBS", () => {
    // Resistance di 110. Candle berikutnya close di atas 110 → RBS
    const candles = makeCandles([
      { open: 108, high: 112, low: 107, close: 110, time: 1000 },   // candle SNR terbentuk (level 110)
      { open: 110, high: 114, low: 109, close: 113, time: 1060 },   // break ke atas (close 113 > 110)
    ]);
    const snrs: MalaysianSNR[] = [{
      price: 110,
      type: "RESISTANCE",
      originalType: "RESISTANCE",
      time: 1000,
      index: 0,
      isFresh: false,
      touchedByWick: false,
      brokenByBody: true,
      missed: false,
      flipTime: 1060,
      flipDir: "UP",
    }];

    const flips = marketStructureService.detectSNRFlip(candles, [], [], snrs);
    expect(flips.length).toBe(1);
    expect(flips[0].type).toBe("RBS");
    expect(flips[0].level).toBe(110);
  });

  it("SBR: support lama di-break ke BAWAH → type SBR", () => {
    // Support di 100. Candle berikutnya close di bawah 100 → SBR
    const candles = makeCandles([
      { open: 102, high: 103, low: 99, close: 100, time: 1000 },    // candle SNR terbentuk (level 100)
      { open: 100, high: 101, low: 96, close: 97, time: 1060 },     // break ke bawah (close 97 < 100)
    ]);
    const snrs: MalaysianSNR[] = [{
      price: 100,
      type: "SUPPORT",
      originalType: "SUPPORT",
      time: 1000,
      index: 0,
      isFresh: false,
      touchedByWick: false,
      brokenByBody: true,
      missed: false,
      flipTime: 1060,
      flipDir: "DOWN",
    }];

    const flips = marketStructureService.detectSNRFlip(candles, [], [], snrs);
    expect(flips.length).toBe(1);
    expect(flips[0].type).toBe("SBR");
    expect(flips[0].level).toBe(100);
  });

  it("Re-flip: level flip berkali-kali hanya emit flip terakhir yang valid", () => {
    // Level 110: break UP (jadi SUPPORT/RBS) lalu break DOWN (jagi RESISTANCE/SBR)
    // Hanya flip terakhir (SBR) yang harus di-emit
    const candles = makeCandles([
      { open: 108, high: 112, low: 107, close: 110, time: 1000 },   // SNR formed
      { open: 110, high: 116, low: 109, close: 113, time: 1060 },   // break UP → RBS
      { open: 113, high: 114, low: 99, close: 100, time: 1120 },    // break DOWN → SBR (re-flip)
    ]);
    const snrs: MalaysianSNR[] = [{
      price: 110,
      type: "RESISTANCE", // sudah re-flip ke RESISTANCE
      originalType: "RESISTANCE",
      time: 1000,
      index: 0,
      isFresh: false,
      touchedByWick: false,
      brokenByBody: true,
      missed: false,
      flipTime: 1120,
      flipDir: "DOWN", // arah break terakhir = DOWN → SBR
    }];

    const flips = marketStructureService.detectSNRFlip(candles, [], [], snrs);
    expect(flips.length).toBe(1);
    expect(flips[0].type).toBe("SBR");
    expect(flips[0].level).toBe(110);
  });

  it("Tidak ada flip jika level belum di-break", () => {
    const candles = makeCandles([
      { open: 108, high: 112, low: 107, close: 110, time: 1000 },
      { open: 110, high: 111, low: 108, close: 109, time: 1060 },   // close 109 < 110 (belum break ke atas)
    ]);
    const snrs: MalaysianSNR[] = [{
      price: 110,
      type: "RESISTANCE",
      originalType: "RESISTANCE",
      time: 1000,
      index: 0,
      isFresh: true,
      touchedByWick: false,
      brokenByBody: false,
      missed: false,
    }];

    const flips = marketStructureService.detectSNRFlip(candles, [], [], snrs);
    expect(flips.length).toBe(0);
  });
});

describe("detectOrderBlocks — wick-inclusive boundary", () => {
  it("Body-only (default): OB boundary = body candle", () => {
    // Candle bearish: open 105, close 100, high 108, low 98
    // Body-only: top=105, bottom=100
    const candles = makeCandles([
      { open: 100, high: 102, low: 98, close: 101, time: 1000 },
      { open: 101, high: 103, low: 99, close: 102, time: 1060 },
      { open: 102, high: 104, low: 100, close: 103, time: 1120 },
      { open: 103, high: 105, low: 101, close: 104, time: 1180 },
      { open: 104, high: 106, low: 102, close: 105, time: 1240 },
      { open: 105, high: 107, low: 103, close: 106, time: 1300 },
      { open: 106, high: 108, low: 104, close: 107, time: 1360 },
      { open: 107, high: 109, low: 105, close: 108, time: 1420 },
      { open: 108, high: 110, low: 106, close: 109, time: 1480 },
      { open: 109, high: 111, low: 107, close: 110, time: 1540 },
      { open: 110, high: 112, low: 108, close: 111, time: 1600 },
      { open: 111, high: 113, low: 109, close: 112, time: 1660 },
      { open: 112, high: 114, low: 110, close: 113, time: 1720 },
      { open: 113, high: 115, low: 111, close: 114, time: 1780 },
      { open: 114, high: 116, low: 112, close: 115, time: 1840 },
      { open: 115, high: 118, low: 108, close: 110, time: 1900 }, // bearish OB candle (body 115→110, wick 118/108)
      { open: 110, high: 125, low: 109, close: 122, time: 1960 }, // impulsive bullish (range 15)
    ]);
    const obs = marketStructureService.detectOrderBlocks(candles, [], [], false);
    expect(obs.length).toBeGreaterThan(0);
    const ob = obs[0];
    expect(ob.type).toBe("BULLISH");
    expect(ob.top).toBe(115); // body top
    expect(ob.bottom).toBe(110); // body bottom
  });

  it("Wick-inclusive: OB boundary = high/low candle", () => {
    // Candle bearish: open 115, close 110, high 118, low 108
    // Wick-inclusive: top=118, bottom=108
    const candles = makeCandles([
      { open: 100, high: 102, low: 98, close: 101, time: 1000 },
      { open: 101, high: 103, low: 99, close: 102, time: 1060 },
      { open: 102, high: 104, low: 100, close: 103, time: 1120 },
      { open: 103, high: 105, low: 101, close: 104, time: 1180 },
      { open: 104, high: 106, low: 102, close: 105, time: 1240 },
      { open: 105, high: 107, low: 103, close: 106, time: 1300 },
      { open: 106, high: 108, low: 104, close: 107, time: 1360 },
      { open: 107, high: 109, low: 105, close: 108, time: 1420 },
      { open: 108, high: 110, low: 106, close: 109, time: 1480 },
      { open: 109, high: 111, low: 107, close: 110, time: 1540 },
      { open: 110, high: 112, low: 108, close: 111, time: 1600 },
      { open: 111, high: 113, low: 109, close: 112, time: 1660 },
      { open: 112, high: 114, low: 110, close: 113, time: 1720 },
      { open: 113, high: 115, low: 111, close: 114, time: 1780 },
      { open: 114, high: 116, low: 112, close: 115, time: 1840 },
      { open: 115, high: 118, low: 108, close: 110, time: 1900 }, // bearish OB candle (body 115→110, wick 118/108)
      { open: 110, high: 125, low: 109, close: 122, time: 1960 }, // impulsive bullish (range 15)
    ]);
    const obs = marketStructureService.detectOrderBlocks(candles, [], [], true);
    expect(obs.length).toBeGreaterThan(0);
    const ob = obs[0];
    expect(ob.type).toBe("BULLISH");
    expect(ob.top).toBe(118); // wick high
    expect(ob.bottom).toBe(108); // wick low
  });
});

describe("findSwingHighs / findSwingLows — ATR noise filter", () => {
  it("Swing noise filter: harga naik turun kecil dalam 1 candle tidak membuat swing ganda", () => {
    // ATR ~2 (range candle). Noise swing dalam 0.5*ATR = 1 harus difilter.
    const candles = makeCandles([
      { open: 100, high: 103, low: 99, close: 102 },
      { open: 102, high: 105, low: 101, close: 104 },
      { open: 104, high: 107, low: 103, close: 106 },
      { open: 106, high: 109, low: 105, close: 108 },
      { open: 108, high: 111, low: 107, close: 110 },
    ]);
    const highs = marketStructureService.findSwingHighs(candles);
    // Tidak ada swing ganda berdekatan: harga monoton naik, harusnya < 5 swing
    expect(highs.length).toBeLessThan(5);
  });

  // ─── TC-01: Flat Market — ATR Rendah ───────────────────────────────
  it("TC-01: Flat market (ATR rendah) — filter tidak terlalu agresif", () => {
    // 20 candles dengan range kecil (high-low = 1.0)
    // Pola: naik gradual, spike turun, naik gradual, spike turun...
    // ATR(14) ≈ 1.0, minGap = 0.5
    const candles = makeCandles([
      { open: 99.5, high: 100.5, low: 99.5, close: 100 },
      { open: 100.5, high: 101.5, low: 100.5, close: 101 },
      { open: 101.5, high: 102.5, low: 101.5, close: 102 },
      { open: 102.5, high: 103.5, low: 102.5, close: 103 },
      { open: 109.5, high: 110.5, low: 109.5, close: 110 }, // spike (swing high)
      { open: 102.5, high: 103.5, low: 102.5, close: 103 },
      { open: 101.5, high: 102.5, low: 101.5, close: 102 },
      { open: 100.5, high: 101.5, low: 100.5, close: 101 },
      { open: 102.5, high: 103.5, low: 102.5, close: 103 },
      { open: 110.5, high: 111.5, low: 110.5, close: 111 }, // spike (swing high)
      { open: 103.5, high: 104.5, low: 103.5, close: 104 },
      { open: 102.5, high: 103.5, low: 102.5, close: 103 },
      { open: 101.5, high: 102.5, low: 101.5, close: 102 },
      { open: 103.5, high: 104.5, low: 103.5, close: 104 },
      { open: 111.5, high: 112.5, low: 111.5, close: 112 }, // spike (swing high)
      { open: 104.5, high: 105.5, low: 104.5, close: 105 },
      { open: 103.5, high: 104.5, low: 103.5, close: 104 },
      { open: 102.5, high: 103.5, low: 102.5, close: 103 },
      { open: 101.5, high: 102.5, low: 101.5, close: 102 },
      { open: 100.5, high: 101.5, low: 100.5, close: 101 },
    ]);
    const highs = marketStructureService.findSwingHighs(candles);
    // Swing highs tetap terdeteksi (minimal 1-2 swing)
    expect(highs.length).toBeGreaterThanOrEqual(1);
    expect(highs.length).toBeLessThan(5); // tidak terlalu banyak
  });

  // ─── TC-02: Spike Volatility — ATR Tinggi ───────────────────────────
  it("TC-02: Spike volatility (ATR tinggi) — noise swing difilter", () => {
    // 20 candles dengan range besar (high-low = 10)
    // Harga naik-turun drastic: 100 → 110 → 95 → 115 → 90 → 120
    // ATR(14) ≈ 10, minGap = 5
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 105 },
      { open: 105, high: 115, low: 95, close: 110 },
      { open: 110, high: 120, low: 100, close: 115 },
      { open: 115, high: 125, low: 105, close: 120 },
      { open: 120, high: 130, low: 110, close: 125 },
      { open: 125, high: 135, low: 115, close: 130 },
      { open: 130, high: 140, low: 120, close: 135 },
      { open: 135, high: 145, low: 125, close: 140 },
      { open: 140, high: 150, low: 130, close: 145 },
      { open: 145, high: 155, low: 135, close: 150 },
      { open: 150, high: 160, low: 140, close: 155 },
      { open: 155, high: 165, low: 145, close: 160 },
      { open: 160, high: 170, low: 150, close: 165 },
      { open: 165, high: 175, low: 155, close: 170 },
      { open: 170, high: 180, low: 160, close: 175 },
      { open: 175, high: 185, low: 165, close: 180 },
      { open: 180, high: 190, low: 170, close: 185 },
      { open: 185, high: 195, low: 175, close: 190 },
      { open: 190, high: 200, low: 180, close: 195 },
      { open: 195, high: 205, low: 185, close: 200 },
    ]);
    const highs = marketStructureService.findSwingHighs(candles);
    // Hanya swing signifikan yang terdeteksi
    // Noise swing (jarak < 5) harus di-filter
    for (let i = 1; i < highs.length; i++) {
      expect(Math.abs(highs[i].price - highs[i - 1].price)).toBeGreaterThanOrEqual(5);
    }
  });

  // ─── TC-03: Boundary Condition — Jarak Tepat 0.5×ATR ─────────────
  it("TC-03: Boundary condition (jarak = 0.5×ATR) — off-by-one check", () => {
    // Setup: 2 swing highs dengan jarak tepat 0.5 × ATR
    // Pola: naik 3 candle, puncak, turun 2 candle, naik 3 candle, puncak, turun 2 candle
    // ATR(14) dihitung dari range candle
    const candles = makeCandles([
      { open: 98, high: 100, low: 97, close: 99 },    // naik
      { open: 99, high: 101, low: 98, close: 100 },   // naik
      { open: 100, high: 102, low: 99, close: 101 },  // naik
      { open: 101, high: 103, low: 100, close: 102 }, // puncak (swing high)
      { open: 102, high: 102, low: 99, close: 100 },  // turun
      { open: 100, high: 101, low: 98, close: 99 },   // turun
      { open: 99, high: 101, low: 98, close: 100 },   // naik
      { open: 100, high: 102, low: 99, close: 101 },  // naik
      { open: 101, high: 103, low: 100, close: 102 }, // naik
      { open: 102, high: 104, low: 101, close: 103 }, // puncak (swing high, jarak = 1)
      { open: 103, high: 103, low: 100, close: 101 }, // turun
      { open: 101, high: 102, low: 99, close: 100 },  // turun
    ]);
    const highs = marketStructureService.findSwingHighs(candles);
    // Verifikasi bahwa swing highs terdeteksi
    expect(highs.length).toBeGreaterThanOrEqual(1);
    // Verifikasi jarak antar swing highs >= minGap (0.5 × ATR)
    for (let i = 1; i < highs.length; i++) {
      expect(Math.abs(highs[i].price - highs[i - 1].price)).toBeGreaterThanOrEqual(0.5);
    }
  });

  // ─── TC-04: Swing Lows — Mirror Logic ──────────────────────────────
  it("TC-04: Swing lows — mirror logic dari findSwingHighs", () => {
    // 20 candles dengan noise swing lows
    // Pola mirror dari TC-01: turun gradual, spike naik, turun gradual, spike naik...
    const candles = makeCandles([
      { open: 100.5, high: 100.5, low: 99.5, close: 100 },
      { open: 99.5, high: 99.5, low: 98.5, close: 99 },
      { open: 98.5, high: 98.5, low: 97.5, close: 98 },
      { open: 97.5, high: 97.5, low: 96.5, close: 97 },
      { open: 90.5, high: 90.5, low: 89.5, close: 90 }, // spike (swing low)
      { open: 97.5, high: 97.5, low: 96.5, close: 97 },
      { open: 98.5, high: 98.5, low: 97.5, close: 98 },
      { open: 99.5, high: 99.5, low: 98.5, close: 99 },
      { open: 97.5, high: 97.5, low: 96.5, close: 97 },
      { open: 89.5, high: 89.5, low: 88.5, close: 89 }, // spike (swing low)
      { open: 96.5, high: 96.5, low: 95.5, close: 96 },
      { open: 97.5, high: 97.5, low: 96.5, close: 97 },
      { open: 98.5, high: 98.5, low: 97.5, close: 98 },
      { open: 96.5, high: 96.5, low: 95.5, close: 96 },
      { open: 88.5, high: 88.5, low: 87.5, close: 88 }, // spike (swing low)
      { open: 95.5, high: 95.5, low: 94.5, close: 95 },
      { open: 96.5, high: 96.5, low: 95.5, close: 96 },
      { open: 97.5, high: 97.5, low: 96.5, close: 97 },
      { open: 98.5, high: 98.5, low: 97.5, close: 98 },
      { open: 99.5, high: 99.5, low: 98.5, close: 99 },
    ]);
    const lows = marketStructureService.findSwingLows(candles);
    expect(lows.length).toBeGreaterThanOrEqual(1);
    expect(lows.length).toBeLessThan(5);
    // Verifikasi jarak antar swing lows >= minGap
    for (let i = 1; i < lows.length; i++) {
      expect(Math.abs(lows[i].price - lows[i - 1].price)).toBeGreaterThanOrEqual(0.25);
    }
  });

  // ─── TC-05: Mixed Scenario — Naik-Turun + Noise ────────────────────
  it("TC-05: Mixed scenario (naik-turun + noise) — real-world combo", () => {
    // 30 candles: naik 10 candle, turun 10 candle, naik 10 candle
    // Noise swing di setiap fase (jarak < 0.5×ATR)
    const candles: Candle[] = [];
    // Phase 1: naik 10 candle (100 → 110)
    for (let i = 0; i < 10; i++) {
      const price = 100 + i;
      candles.push({
        time: 1000 + i * 60,
        open: price - 0.2,
        high: price + 0.5,
        low: price - 0.5,
        close: price + 0.2,
      });
    }
    // Phase 2: turun 10 candle (110 → 100)
    for (let i = 0; i < 10; i++) {
      const price = 110 - i;
      candles.push({
        time: 1000 + (10 + i) * 60,
        open: price + 0.2,
        high: price + 0.5,
        low: price - 0.5,
        close: price - 0.2,
      });
    }
    // Phase 3: naik 10 candle (100 → 110)
    for (let i = 0; i < 10; i++) {
      const price = 100 + i;
      candles.push({
        time: 1000 + (20 + i) * 60,
        open: price - 0.2,
        high: price + 0.5,
        low: price - 0.5,
        close: price + 0.2,
      });
    }
    const highs = marketStructureService.findSwingHighs(candles);
    const lows = marketStructureService.findSwingLows(candles);
    // Harus ada swing highs dan lows
    expect(highs.length).toBeGreaterThanOrEqual(1);
    expect(lows.length).toBeGreaterThanOrEqual(1);
    // Noise swing tidak boleh lolos
    for (let i = 1; i < highs.length; i++) {
      expect(Math.abs(highs[i].price - highs[i - 1].price)).toBeGreaterThanOrEqual(0.5);
    }
    for (let i = 1; i < lows.length; i++) {
      expect(Math.abs(lows[i].price - lows[i - 1].price)).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe("fallback model config (llm-models.config)", () => {
  it("NINE_ROUTER_MODELS memiliki fallbackModel untuk semua 6 provider", () => {
    const providers = (NINE_ROUTER_MODELS as Array<{ name: string; model: string; fallbackModel?: string }>);
    expect(providers.length).toBe(6);
    for (const p of providers) {
      expect(p.fallbackModel, `provider ${p.name} harus punya fallbackModel`).toBeTruthy();
      expect(p.fallbackModel, `fallback ${p.name} tidak boleh sama dengan model utama`).not.toBe(p.model);
    }
  });
});

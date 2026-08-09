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
    }];

    const flips = marketStructureService.detectSNRFlip(candles, [], [], snrs);
    expect(flips.length).toBe(1);
    expect(flips[0].type).toBe("SBR");
    expect(flips[0].level).toBe(100);
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

import { describe, it, expect } from "vitest";
import {
  isValidTimeframe,
  mapTimeframeToYahoo,
  mapTimeframeToStooqInterval,
  ttlForTimeframe,
  mapToStooqSymbol,
  parseYahooChart,
  parseStooqCsv,
  CHART_TIMEFRAMES,
} from "../providers/candles.provider";

// ─────────────────────────────────────────────────────────────────────────────
// TIMEFRAME MAPPING
// ─────────────────────────────────────────────────────────────────────────────

describe("isValidTimeframe", () => {
  it("menerima 8 timeframe yang didukung", () => {
    for (const tf of CHART_TIMEFRAMES) expect(isValidTimeframe(tf)).toBe(true);
    expect(CHART_TIMEFRAMES).toHaveLength(8);
  });

  it("menolak timeframe tak dikenal", () => {
    expect(isValidTimeframe("2D")).toBe(false);
    expect(isValidTimeframe("")).toBe(false);
    expect(isValidTimeframe("1d")).toBe(false); // case-sensitive
  });
});

describe("mapTimeframeToYahoo", () => {
  it("memetakan setiap timeframe ke range+interval Yahoo yang benar", () => {
    expect(mapTimeframeToYahoo("1D")).toEqual({ range: "1d", interval: "1m" });
    expect(mapTimeframeToYahoo("5D")).toEqual({ range: "5d", interval: "5m" });
    expect(mapTimeframeToYahoo("1M")).toEqual({ range: "1mo", interval: "15m" });
    expect(mapTimeframeToYahoo("3M")).toEqual({ range: "3mo", interval: "1h" });
    expect(mapTimeframeToYahoo("6M")).toEqual({ range: "6mo", interval: "1h" });
    expect(mapTimeframeToYahoo("1Y")).toEqual({ range: "1y", interval: "1d" });
    expect(mapTimeframeToYahoo("5Y")).toEqual({ range: "5y", interval: "1wk" });
    expect(mapTimeframeToYahoo("MAX")).toEqual({ range: "max", interval: "1wk" });
  });
});

describe("mapTimeframeToStooqInterval", () => {
  it("memetakan timeframe ke interval Stooq", () => {
    expect(mapTimeframeToStooqInterval("1D")).toBe("d");
    expect(mapTimeframeToStooqInterval("1Y")).toBe("d");
    expect(mapTimeframeToStooqInterval("5Y")).toBe("w");
    expect(mapTimeframeToStooqInterval("MAX")).toBe("m");
  });
});

describe("ttlForTimeframe", () => {
  it("TTL naik monoton seiring panjang timeframe", () => {
    const ttls = CHART_TIMEFRAMES.map(ttlForTimeframe);
    for (let i = 1; i < ttls.length; i++) {
      expect(ttls[i]).toBeGreaterThan(ttls[i - 1]);
    }
  });

  it("1D = 30 detik, MAX = 12 jam", () => {
    expect(ttlForTimeframe("1D")).toBe(30_000);
    expect(ttlForTimeframe("MAX")).toBe(12 * 60 * 60_000);
  });
});

describe("mapToStooqSymbol", () => {
  it("memetakan simbol yang dikenal", () => {
    expect(mapToStooqSymbol("^GSPC")).toBe("^spx");
    expect(mapToStooqSymbol("^VIX")).toBe("^vix");
    expect(mapToStooqSymbol("GC=F")).toBe("gc.f");
  });

  it("mengembalikan null untuk simbol tanpa padanan", () => {
    expect(mapToStooqSymbol("DX-Y.NYB")).toBeNull();
    expect(mapToStooqSymbol("TIDAK-ADA")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARSER — YAHOO
// ─────────────────────────────────────────────────────────────────────────────

describe("parseYahooChart", () => {
  const payload = {
    chart: {
      result: [
        {
          timestamp: [1700000000, 1700003600, 1700007200],
          indicators: {
            quote: [
              {
                open: [100, 101, null],
                high: [105, 106, 107],
                low: [99, 100, 101],
                close: [104, 103, null],
                volume: [1000, 2000, 3000],
              },
            ],
          },
        },
      ],
    },
  };

  it("memetakan payload valid menjadi CandleData[]", () => {
    const out = parseYahooChart(payload);
    expect(out).toHaveLength(2); // baris ke-3 dibuang (null)
    expect(out[0]).toEqual({
      time: 1700000000, open: 100, high: 105, low: 99, close: 104, volume: 1000,
    });
  });

  it("membuang baris dengan close null/0 (bar belum selesai)", () => {
    const out = parseYahooChart(payload);
    expect(out.every((c) => c.close > 0)).toBe(true);
  });

  it("default volume 0 bila volume hilang", () => {
    const noVol = {
      chart: {
        result: [
          {
            timestamp: [1700000000],
            indicators: { quote: [{ open: [10], high: [12], low: [9], close: [11] }] },
          },
        ],
      },
    };
    const out = parseYahooChart(noVol);
    expect(out).toHaveLength(1);
    expect(out[0].volume).toBe(0);
  });

  it("mengembalikan array kosong untuk payload tak terduga", () => {
    expect(parseYahooChart(null)).toEqual([]);
    expect(parseYahooChart({})).toEqual([]);
    expect(parseYahooChart({ chart: { result: [] } })).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARSER — STOOQ
// ─────────────────────────────────────────────────────────────────────────────

describe("parseStooqCsv", () => {
  it("mem-parse CSV valid menjadi CandleData[]", () => {
    const csv = [
      "Date,Open,High,Low,Close,Volume",
      "2026-10-08,6600.5,6650.0,6590.0,6640.0,1800000000",
      "2026-10-09,6640.0,6690.0,6630.0,6680.5,1900000000",
    ].join("\n");

    const out = parseStooqCsv(csv);
    expect(out).toHaveLength(2);
    expect(out[0].open).toBeCloseTo(6600.5, 6);
    expect(out[0].close).toBeCloseTo(6640.0, 6);
    expect(out[0].volume).toBe(1800000000);
    expect(out[0].time).toBeGreaterThan(0);
    // urutan waktu naik
    expect(out[1].time).toBeGreaterThan(out[0].time);
  });

  it("menolak respons yang bukan CSV data (mis. halaman error HTML)", () => {
    expect(parseStooqCsv("<html>Exceeded the daily hits limit</html>")).toEqual([]);
    expect(parseStooqCsv("No data")).toEqual([]);
  });

  it("mengembalikan array kosong untuk input kosong / header saja", () => {
    expect(parseStooqCsv("")).toEqual([]);
    expect(parseStooqCsv("Date,Open,High,Low,Close,Volume")).toEqual([]);
  });

  it("melewati baris rusak tanpa menggagalkan seluruh parse", () => {
    const csv = [
      "Date,Open,High,Low,Close,Volume",
      "2026-10-08,6600,6650,6590,6640,1000",
      "BROKEN,ROW",
      "2026-10-10,6640,6690,6630,0,1200", // close 0 -> dibuang
      "2026-10-11,6640,6690,6630,6700,1300",
    ].join("\n");

    const out = parseStooqCsv(csv);
    expect(out).toHaveLength(2);
    expect(out[0].close).toBeCloseTo(6640, 6);
    expect(out[1].close).toBeCloseTo(6700, 6);
  });

  it("volume hilang menjadi 0", () => {
    const csv = ["Date,Open,High,Low,Close", "2026-10-08,10,12,9,11"].join("\n");
    const out = parseStooqCsv(csv);
    expect(out).toHaveLength(1);
    expect(out[0].volume).toBe(0);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import React from "react";
import { MacroPriceChart } from "../MacroPriceChart";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: lightweight-charts
//   Chart asli butuh canvas — di jsdom kita ganti dengan spy supaya bisa
//   memverifikasi DATA yang benar-benar dikirim ke tiap series.
// ─────────────────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  series: [] as any[],
  charts: [] as any[],
  crosshairHandler: null as null | ((p: any) => void),
}));

vi.mock("lightweight-charts", () => {
  const makeSeries = (def: any, opts: any, pane?: number) => {
    const s: any = { __def: def, __opts: opts, __pane: pane, setData: vi.fn(), applyOptions: vi.fn() };
    h.series.push(s);
    return s;
  };

  return {
    createChart: vi.fn((_el: any, opts: any) => {
      const chart: any = {
        __opts: opts,
        addSeries: vi.fn((def: any, opts2: any, pane?: number) => makeSeries(def, opts2, pane)),
        removeSeries: vi.fn(),
        removePane: vi.fn(),
        panes: vi.fn(() => [
          { setHeight: vi.fn() },
          { setHeight: vi.fn() },
          { setHeight: vi.fn() },
        ]),
        priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
        timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
        subscribeCrosshairMove: vi.fn((fn: any) => { h.crosshairHandler = fn; }),
        unsubscribeCrosshairMove: vi.fn(),
        remove: vi.fn(),
      };
      h.charts.push(chart);
      return chart;
    }),
    CandlestickSeries: "CandlestickSeries",
    HistogramSeries: "HistogramSeries",
    LineSeries: "LineSeries",
    ColorType: { Solid: "solid" },
    CrosshairMode: { Normal: 0 },
    LineStyle: { Solid: 0, Dashed: 2 },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

/** Candle sengaja TIDAK urut + ada duplikat timestamp, untuk uji normalisasi. */
const RAW_CANDLES = [
  { time: 1700007200, open: 103, high: 108, low: 102, close: 107, volume: 3000 },
  { time: 1700000000, open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  { time: 1700003600, open: 101, high: 106, low: 100, close: 102, volume: 2000 },
  { time: 1700003600, open: 101, high: 106, low: 100, close: 103, volume: 2500 }, // duplikat
];

const CANDLES_OK = {
  success: true,
  data: {
    symbol: "^GSPC",
    timeframe: "6M",
    candles: RAW_CANDLES,
    source: "yahoo",
    fromCache: false,
    stale: false,
    fetchedAt: "2026-10-12T09:00:00.000Z",
  },
};

const INSTRUMENTS_OK = {
  success: true,
  data: [
    { symbol: "^GSPC", name: "S&P 500 Index", category: "Indeks" },
    { symbol: "GC=F", name: "Gold Futures", category: "Komoditas" },
  ],
};

function mockFetch(impl?: (url: string) => any) {
  const fn = vi.fn(async (url: string) => {
    if (impl) {
      const custom = impl(url);
      if (custom) return custom;
    }
    if (url.includes("/instruments")) return { ok: true, json: async () => INSTRUMENTS_OK };
    return { ok: true, json: async () => CANDLES_OK };
  });
  (global as any).fetch = fn;
  return fn;
}

/** Series yang dibuat, dikelompokkan berdasarkan definisi. */
const candlesSeries = () => h.series.filter((s) => s.__def === "CandlestickSeries");
const volumeSeries = () => h.series.filter((s) => s.__def === "HistogramSeries");
const lineSeries = () => h.series.filter((s) => s.__def === "LineSeries");

/**
 * Tunggu sampai data candle BENAR-BENAR terkirim ke series.
 * Penting: setData([]) sudah terpanggil saat mount, jadi `toHaveBeenCalled()`
 * saja tidak cukup — harus menunggu call terakhir berisi data penuh.
 */
async function waitForCandles(n = 3) {
  await waitFor(() => {
    const calls = candlesSeries()[0]?.setData?.mock?.calls ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.at(-1)[0]).toHaveLength(n);
  });
}

beforeEach(() => {
  h.series.length = 0;
  h.charts.length = 0;
  h.crosshairHandler = null;
  mockFetch();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("MacroPriceChart — render dasar", () => {
  it("menampilkan header, toolbar lengkap, dan footer", async () => {
    render(<MacroPriceChart />);

    expect(screen.getByText(/Macro Price Chart/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Timeframe")).toBeInTheDocument();
    expect(screen.getByLabelText("Indikator")).toBeInTheDocument();

    // 8 timeframe
    for (const tf of ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX"]) {
      expect(screen.getByRole("button", { name: tf })).toBeInTheDocument();
    }
    // 6 indikator
    for (const ind of ["SMA", "EMA", "VWAP", "BB", "RSI", "MACD"]) {
      expect(screen.getByRole("button", { name: ind })).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(screen.getByText(/CANDLES/i)).toBeInTheDocument();
    });
  });

  it("membuat chart sekali dan memasang series candlestick + volume", async () => {
    render(<MacroPriceChart />);

    await waitFor(() => {
      expect(candlesSeries()).toHaveLength(1);
    });

    expect(h.charts).toHaveLength(1);
    expect(candlesSeries()).toHaveLength(1);
    expect(volumeSeries()).toHaveLength(1);
    // volume ditaruh di pane 1
    expect(volumeSeries()[0].__pane).toBe(1);
  });
});

describe("MacroPriceChart — data pipeline", () => {
  it("mengurutkan candle naik & membuang timestamp duplikat", async () => {
    render(<MacroPriceChart />);

    await waitForCandles();

    const sent = candlesSeries()[0].setData.mock.calls.at(-1)[0];
    // 4 candle mentah -> 3 setelah dedupe
    expect(sent).toHaveLength(3);
    // urut naik
    expect(sent.map((c: any) => c.time)).toEqual([1700000000, 1700003600, 1700007200]);
    // duplikat yang menang adalah nilai terakhir (close 103)
    expect(sent[1].close).toBe(103);
    // bentuk OHLC sesuai kontrak lightweight-charts
    expect(Object.keys(sent[0]).sort()).toEqual(["close", "high", "low", "open", "time"]);
  });

  it("mengirim volume dengan warna sesuai arah candle", async () => {
    render(<MacroPriceChart />);

    await waitForCandles();

    const sent = volumeSeries()[0].setData.mock.calls.at(-1)[0];
    expect(sent).toHaveLength(3);
    expect(sent[0].value).toBe(1000);
    // candle naik (close >= open) -> hijau
    expect(sent[0].color).toContain("57,255,136");
  });

  it("memanggil endpoint candles dengan simbol + timeframe default", async () => {
    const fetchMock = mockFetch();
    render(<MacroPriceChart />);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c: any) => String(c[0]).includes("/api/v1/macro/candles"))).toBe(true);
    });

    const call = fetchMock.mock.calls.find((c: any) => String(c[0]).includes("/api/v1/macro/candles"))!;
    expect(String(call[0])).toContain("symbol=%5EGSPC");
    expect(String(call[0])).toContain("tf=6M");
  });

  it("menampilkan LIVE saat cache masih segar (bukan hanya dari provider)", async () => {
    mockFetch((url) =>
      url.includes("/candles")
        ? { ok: true, json: async () => ({ success: true, data: { ...CANDLES_OK.data, source: "cache", fromCache: true, stale: false } }) }
        : null
    );

    render(<MacroPriceChart />);
    await waitForCandles();

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.queryByText("CACHE")).not.toBeInTheDocument();
  });

  it("menampilkan STALE saat cache basi", async () => {
    mockFetch((url) =>
      url.includes("/candles")
        ? { ok: true, json: async () => ({ success: true, data: { ...CANDLES_OK.data, source: "cache", fromCache: true, stale: true } }) }
        : null
    );

    render(<MacroPriceChart />);
    await waitForCandles();

    expect(screen.getByText("STALE")).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });

  it("badge LIVE menyala default-nya (provider segar)", async () => {
    render(<MacroPriceChart />);
    await waitForCandles();

    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("memuat daftar instrumen dari endpoint /instruments", async () => {
    render(<MacroPriceChart />);

    await waitFor(() => {
      expect(screen.getByText("S&P 500 Index")).toBeInTheDocument();
    });
  });
});

describe("MacroPriceChart — indikator", () => {
  it("SMA + BB aktif secara default (BB = 3 garis: U/M/L)", async () => {
    render(<MacroPriceChart />);

    await waitFor(() => {
      expect(lineSeries().length).toBeGreaterThanOrEqual(4); // SMA(1) + BB(3)
    });

    // semua di pane 0 (overlay), bukan pane oscillator
    for (const s of lineSeries()) expect(s.__pane ?? 0).toBe(0);
  });

  it("mematikan SMA membuang series-nya", async () => {
    const { chart } = (() => {
      render(<MacroPriceChart />);
      return { chart: h.charts[0] };
    })();

    await waitFor(() => expect(lineSeries().length).toBeGreaterThanOrEqual(4));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "SMA" }));
    });

    await waitFor(() => {
      expect(chart.removeSeries).toHaveBeenCalled();
    });
  });

  it("mengaktifkan RSI menambah series di pane oscillator (2)", async () => {
    render(<MacroPriceChart />);
    await waitForCandles();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "RSI" }));
    });

    await waitFor(() => {
      const osc = lineSeries().filter((s) => s.__pane === 2);
      expect(osc.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("RSI dan MACD saling eksklusif (satu pane, satu indikator)", async () => {
    render(<MacroPriceChart />);
    await waitForCandles();

    const chart = h.charts[0];

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "RSI" }));
    });
    await waitFor(() => {
      expect(lineSeries().some((s) => s.__pane === 2 && s.__opts?.color === "#38BDF8")).toBe(true);
    });
    const rsiSeries = lineSeries().find((s) => s.__opts?.color === "#38BDF8")!;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "MACD" }));
    });

    // MACD masuk pane 2
    await waitFor(() => {
      expect(lineSeries().some((s) => s.__pane === 2 && s.__opts?.color === "#F472B6")).toBe(true);
    });

    // RSI dibuang lewat removeSeries (mock tidak benar-benar menghapus dari array,
    // jadi kita verifikasi lewat pemanggilan removeSeries)
    expect(chart.removeSeries).toHaveBeenCalledWith(rsiSeries);

    // status tombol mencerminkan eksklusivitas
    expect(screen.getByRole("button", { name: "RSI" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "MACD" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("MacroPriceChart — interaksi", () => {
  it("klik timeframe memicu refetch dengan tf baru", async () => {
    const fetchMock = mockFetch();
    render(<MacroPriceChart />);

    await waitFor(() => expect(candlesSeries()).toHaveLength(1));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "1Y" }));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c: any) => String(c[0]));
      expect(calls.some((u: string) => u.includes("tf=1Y"))).toBe(true);
    });
  });

  it("ganti simbol lewat dropdown memicu refetch simbol baru", async () => {
    const fetchMock = mockFetch();
    render(<MacroPriceChart />);
    await waitFor(() => expect(candlesSeries()).toHaveLength(1));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /GSPC/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: /GC=F/ }));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c: any) => String(c[0]));
      expect(calls.some((u: string) => u.includes("GC%3DF") || u.includes("GC=F"))).toBe(true);
    });
  });

  it("hover (crosshair) menampilkan legend OHLC + volume", async () => {
    render(<MacroPriceChart />);
    await waitForCandles();

    await act(async () => {
      h.crosshairHandler?.({ time: 1700003600 });
    });

    await waitFor(() => {
      expect(screen.getByText("103.00")).toBeInTheDocument(); // close candle itu
      expect(screen.getByText("2.50K")).toBeInTheDocument();  // volume 2500
    });
  });
});

describe("MacroPriceChart — error state", () => {
  it("menampilkan pesan error + tombol coba lagi saat API gagal", async () => {
    mockFetch((url) =>
      url.includes("/candles")
        ? { ok: false, status: 503, json: async () => ({ success: false, error: "All providers unavailable" }) }
        : null
    );

    render(<MacroPriceChart />);

    await waitFor(() => {
      expect(screen.getByText(/All providers unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /COBA LAGI/i })).toBeInTheDocument();
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  it("menampilkan error saat candle kosong", async () => {
    mockFetch((url) =>
      url.includes("/candles")
        ? { ok: true, json: async () => ({ success: true, data: { symbol: "^GSPC", timeframe: "6M", candles: [], source: "yahoo", fromCache: false, stale: false, fetchedAt: "" } }) }
        : null
    );

    render(<MacroPriceChart />);

    await waitFor(() => {
      expect(screen.getByText(/Tidak ada data candle/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND PALETTE — pemilihan instrumen
// ─────────────────────────────────────────────────────────────────────────────

describe("MacroPriceChart — Command Palette", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  /** Simbol apa saja yang pernah diminta ke endpoint candles. */
  const requestedSymbols = () =>
    (global as any).fetch.mock.calls
      .map((c: any[]) => String(c[0]))
      .filter((u: string) => u.includes("/candles"))
      .map((u: string) => decodeURIComponent(/symbol=([^&]+)/.exec(u)?.[1] ?? ""));

  it("memakai simbol dari sessionStorage saat mount (pindah tab dari palette)", async () => {
    // Layout Macro Terminal menulis ini sebelum berpindah ke Overview.
    sessionStorage.setItem("macro:pending-instrument", "GC=F");

    render(<MacroPriceChart />);
    await waitForCandles();

    expect(requestedSymbols()).toContain("GC=F");
    // sekali pakai — langsung dibersihkan supaya tidak bocor ke kunjungan berikutnya
    expect(sessionStorage.getItem("macro:pending-instrument")).toBeNull();
  });

  it("tidak melakukan fetch ganda saat ada pending (langsung simbol tujuan)", async () => {
    sessionStorage.setItem("macro:pending-instrument", "CL=F");

    render(<MacroPriceChart />);
    await waitForCandles();

    // Simbol default tidak boleh pernah diminta
    expect(requestedSymbols()).not.toContain("^GSPC");
    expect(requestedSymbols()).toContain("CL=F");
  });

  it("memakai simbol default bila tidak ada pending", async () => {
    render(<MacroPriceChart />);
    await waitForCandles();

    expect(requestedSymbols()).toContain("^GSPC");
  });

  it("ganti simbol lewat event macro:open-instrument (sudah di Overview)", async () => {
    render(<MacroPriceChart />);
    await waitForCandles();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("macro:open-instrument", { detail: { symbol: "GC=F" } })
      );
    });

    await waitFor(() => {
      expect(requestedSymbols()).toContain("GC=F");
    });
  });

  it("mengabaikan event tanpa simbol", async () => {
    render(<MacroPriceChart />);
    await waitForCandles();
    const before = requestedSymbols().length;

    await act(async () => {
      window.dispatchEvent(new CustomEvent("macro:open-instrument", { detail: {} }));
    });

    expect(requestedSymbols()).toHaveLength(before);
  });
});

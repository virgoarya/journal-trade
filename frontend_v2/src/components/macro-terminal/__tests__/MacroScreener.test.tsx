/**
 * Test MacroScreener — Fase 2 & Fase 2.3 Realtime Hardening.
 *
 * Memverifikasi: render dasar, pemuatan 8 instrumen, harga + perubahan,
 * sparkline, filter pencarian, filter kategori, sorting, aksi buka chart,
 * dan flash harga saat refresh mengubah nilai.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { MacroScreener } from "../MacroScreener";
import { DEFAULT_INSTRUMENTS } from "@/services/macro-candles.service";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: next/navigation — MacroScreener sekarang pakai usePathname + useRouter
// ─────────────────────────────────────────────────────────────────────────────

const navMock = vi.hoisted(() => ({
  pathname: "/macro-terminal/overview",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navMock.pathname,
  useRouter: () => ({ push: navMock.push }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES — harga deterministik per simbol supaya sorting bisa diuji
// ─────────────────────────────────────────────────────────────────────────────

const PRICE_BY_SYMBOL: Record<string, number> = {
  "^GSPC": 5000,
  "^NDX": 18000,
  "DX-Y.NYB": 105,
  "GC=F": 2650,
  "CL=F": 72,
  "^VIX": 18,
  "^TNX": 4.2,
  "^FVX": 3.9,
};

/** Harga yang dipakai mock saat ini — diubah di test flash. */
let priceOverride: Record<string, number> = {};

function candlesFor(symbol: string) {
  const price = priceOverride[symbol] ?? PRICE_BY_SYMBOL[symbol] ?? 100;
  const prev = price / 1.02; // selalu +2.00%
  return {
    success: true,
    data: {
      symbol,
      timeframe: "1M",
      candles: [
        { time: 1, open: prev, high: prev, low: prev, close: prev, volume: 1 },
        { time: 2, open: price, high: price, low: price, close: price, volume: 1 },
      ],
      source: "yahoo",
      fromCache: false,
      stale: false,
      fetchedAt: "2026-10-13T00:00:00.000Z",
    },
  };
}

function mockFetch(failSymbols: string[] = []) {
  const fn = vi.fn(async (url: string) => {
    const m = /symbol=([^&]+)/.exec(url);
    const symbol = m ? decodeURIComponent(m[1]) : "";

    if (failSymbols.includes(symbol)) {
      return { ok: false, status: 500, json: async () => ({ success: false, error: "boom" }) };
    }
    return { ok: true, status: 200, json: async () => candlesFor(symbol) };
  });
  (global as any).fetch = fn;
  return fn;
}

beforeEach(() => {
  priceOverride = {};
  mockFetch();
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Tunggu sampai semua baris selesai memuat (harga tampil). */
async function waitForRows() {
  await waitFor(() => {
    expect(screen.getByText("5,000.00")).toBeInTheDocument();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("MacroScreener — render dasar", () => {
  it("menampilkan header, kotak cari, filter kategori, dan footer", async () => {
    render(<MacroScreener />);

    expect(screen.getByText(/Macro Screener/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Cari instrumen")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter kategori")).toBeInTheDocument();
    expect(screen.getByLabelText("Muat ulang data screener")).toBeInTheDocument();

    // Filter kategori: ALL + 5 kategori unik
    for (const cat of ["ALL", "Indeks", "FX", "Komoditas", "Volatilitas", "Yield"]) {
      expect(screen.getByRole("button", { name: cat })).toBeInTheDocument();
    }

    await waitForRows();

    expect(screen.getByText(/AUTO-REFRESH 60s/)).toBeInTheDocument();
  });

  it("mengambil candle 1M limit 30 untuk SETIAP instrumen", async () => {
    render(<MacroScreener />);
    await waitForRows();

    const calls = (global as any).fetch.mock.calls.map((c: any[]) => String(c[0]));
    const candleCalls = calls.filter((u: string) => u.includes("/api/v1/macro/candles"));

    expect(candleCalls).toHaveLength(DEFAULT_INSTRUMENTS.length);
    for (const u of candleCalls) {
      expect(u).toContain("tf=1M");
      expect(u).toContain("limit=30");
    }
  });

  it("menampilkan 8 baris data + 1 baris header", async () => {
    render(<MacroScreener />);
    await waitForRows();

    // header + 8 instrumen
    expect(screen.getAllByRole("row")).toHaveLength(DEFAULT_INSTRUMENTS.length + 1);
  });

  it("menampilkan harga dan perubahan persen tiap instrumen", async () => {
    render(<MacroScreener />);
    await waitForRows();

    expect(screen.getByText("5,000.00")).toBeInTheDocument();
    expect(screen.getByText("18,000.00")).toBeInTheDocument();
    expect(screen.getByText("4.20")).toBeInTheDocument();

    // +2.00% untuk semua baris
    expect(screen.getAllByText("+2.00%")).toHaveLength(DEFAULT_INSTRUMENTS.length);
  });

  it("merender sparkline SVG setelah data termuat", async () => {
    const { container } = render(<MacroScreener />);
    await waitForRows();

    // Satu sparkline per baris
    const polylines = container.querySelectorAll("polyline");
    expect(polylines.length).toBe(DEFAULT_INSTRUMENTS.length);
  });
});

describe("MacroScreener — filter & sorting", () => {
  it("menyaring baris berdasarkan pencarian nama", async () => {
    render(<MacroScreener />);
    await waitForRows();

    fireEvent.change(screen.getByLabelText("Cari instrumen"), {
      target: { value: "gold" },
    });

    expect(screen.getByText("GC=F")).toBeInTheDocument();
    expect(screen.queryByText("^GSPC")).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + 1
  });

  it("menyaring baris berdasarkan kategori", async () => {
    render(<MacroScreener />);
    await waitForRows();

    fireEvent.click(screen.getByRole("button", { name: "Yield" }));

    expect(screen.getByText("^TNX")).toBeInTheDocument();
    expect(screen.getByText("^FVX")).toBeInTheDocument();
    expect(screen.queryByText("^GSPC")).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
  });

  it("menampilkan pesan kosong saat tidak ada yang cocok", async () => {
    render(<MacroScreener />);
    await waitForRows();

    fireEvent.change(screen.getByLabelText("Cari instrumen"), {
      target: { value: "zzzz-tidak-ada" },
    });

    expect(screen.getByText(/Tidak ada instrumen yang cocok/)).toBeInTheDocument();
  });

  it("mengurutkan naik lalu turun saat header Harga diklik", async () => {
    render(<MacroScreener />);
    await waitForRows();

    const headerHarga = screen.getByText("Harga").closest("th")!;

    // asc → ^FVX (3.90) paling murah
    fireEvent.click(headerHarga);
    let first = screen.getAllByRole("row")[1];
    expect(first).toHaveTextContent("^FVX");

    // desc → ^NDX (18,000) paling mahal
    fireEvent.click(headerHarga);
    first = screen.getAllByRole("row")[1];
    expect(first).toHaveTextContent("^NDX");
  });

  it("default mengurutkan berdasarkan simbol (asc)", async () => {
    render(<MacroScreener />);
    await waitForRows();

    // localeCompare: "^CL=F" < "^DX-Y.NYB" < "^FVX" < "^GC=F" < "^GSPC" ...
    const rows = screen.getAllByRole("row").slice(1);
    const symbols = rows.map((r) => r.querySelector("td")?.textContent);
    expect(symbols).toEqual([...symbols].sort((a, b) => (a ?? "").localeCompare(b ?? "")));
  });
});

describe("MacroScreener — interaksi & realtime", () => {
  beforeEach(() => {
    // Default: Chart mengirim event langsung (sudah di overview)
    navMock.pathname = "/macro-terminal/overview";
    sessionStorage.clear();
  });

  afterEach(() => {
    navMock.push.mockClear();
  });

  it("mengirim event macro:open-instrument saat tombol Chart diklik", async () => {
    const handler = vi.fn();
    window.addEventListener("macro:open-instrument", handler);

    render(<MacroScreener />);
    await waitForRows();

    fireEvent.click(screen.getByLabelText("Buka ^GSPC di chart"));

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0] as CustomEvent<{ symbol: string }>;
    expect(evt.detail.symbol).toBe("^GSPC");

    // Sudah di Overview -> chart ada di halaman ini, jadi TIDAK perlu navigasi
    // dan TIDAK boleh menulis sessionStorage (itu jalur untuk lintas-tab saja).
    expect(navMock.push).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("macro:pending-instrument")).toBeNull();

    window.removeEventListener("macro:open-instrument", handler);
  });

  it("menyimpan ke sessionStorage + navigasi ke overview saat Chart diklik dari tab lain", async () => {
    // Simulasi user sedang di tab selain Overview
    navMock.pathname = "/macro-terminal/cot";

    const handler = vi.fn();
    window.addEventListener("macro:open-instrument", handler);

    render(<MacroScreener />);
    await waitForRows();

    fireEvent.click(screen.getByLabelText("Buka ^GSPC di chart"));

    // Tidak ada event yang dikirim (chart tidak ada di tab COT)
    expect(handler).not.toHaveBeenCalled();
    // Simbol disimpan ke sessionStorage untuk dibaca chart saat mount
    expect(sessionStorage.getItem("macro:pending-instrument")).toBe("^GSPC");
    // Navigasi ke overview
    expect(navMock.push).toHaveBeenCalledWith("/macro-terminal/overview");

    window.removeEventListener("macro:open-instrument", handler);
  });

  it("memberi kelas flash-up pada harga yang naik saat refresh", async () => {
    render(<MacroScreener />);
    await waitForRows();

    expect(screen.getByText("5,000.00")).toBeInTheDocument();

    // Harga ^GSPC naik → refresh manual
    priceOverride = { "^GSPC": 5050 };
    fireEvent.click(screen.getByLabelText("Muat ulang data screener"));

    // Harga DAN kelas flash diperiksa dalam SATU waitFor. Kelas flash hanya
    // bertahan 600ms (useFlashOnChange), jadi memisahkannya jadi dua langkah
    // menciptakan race yang membuat test flaky.
    await waitFor(() => {
      expect(screen.getByText("5,050.00")).toHaveClass("flash-up");
    });
  });

  it("memberi kelas flash-down pada harga yang turun saat refresh", async () => {
    render(<MacroScreener />);
    await waitForRows();

    priceOverride = { "^GSPC": 4950 };
    fireEvent.click(screen.getByLabelText("Muat ulang data screener"));

    await waitFor(() => {
      expect(screen.getByText("4,950.00")).toHaveClass("flash-down");
    });
  });

  it("mempertahankan data lama saat refresh gagal (tidak mengosongkan tabel)", async () => {
    render(<MacroScreener />);
    await waitForRows();

    // Semua request gagal → baris lama harus tetap tampil
    mockFetch(DEFAULT_INSTRUMENTS.map((i) => i.symbol));
    fireEvent.click(screen.getByLabelText("Muat ulang data screener"));

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalled();
    });

    expect(screen.getByText("5,000.00")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(DEFAULT_INSTRUMENTS.length + 1);
  });

  it("menampilkan '...' selama pemuatan awal", () => {
    // fetch yang tidak pernah resolve → baris tetap loading
    (global as any).fetch = vi.fn(() => new Promise(() => {}));

    render(<MacroScreener />);

    // 2 kolom per baris menampilkan "..." (Harga + Chg 1M)
    expect(screen.getAllByText("...").length).toBe(DEFAULT_INSTRUMENTS.length * 2);
    expect(screen.getAllByText("loading...").length).toBe(DEFAULT_INSTRUMENTS.length);
  });
});

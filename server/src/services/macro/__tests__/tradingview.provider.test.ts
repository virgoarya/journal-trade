import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { tradingviewCalendarProvider } from "../providers/tradingview.provider";

// Mock axios di level modul (hoisted oleh vitest) — TIDAK ada request jaringan nyata.
vi.mock("axios", () => ({ default: { get: vi.fn() } }));
const mockedGet: any = axios.get;

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES — JSON calendar inline (tidak bergantung jaringan)
// ─────────────────────────────────────────────────────────────────────────────

const CALENDAR_RESPONSE = {
  result: [
    {
      title: "CPI m/m",
      country: "US",
      date: "2026-10-13T12:30:00Z",
      importance: 1,
      forecast: 0.3,
      previous: 0.2,
      actual: null,
      currency: "USD",
      scale: 1,
    },
    {
      // "CPI" TANPA MoM/YoY = INDEKS HARGA (level), bukan persen.
      // Nilai 336.65 berarti 336,65 poin — menempelkan "%" akan SALAH.
      // Ini kasus nyata yang muncul di feed produksi.
      title: "CPI",
      country: "US",
      date: "2026-10-13T12:30:00Z",
      importance: 1,
      forecast: 336.65,
      previous: 335.2,
      actual: null,
      currency: "USD",
      scale: 1,
    },
    {
      title: "GDP q/q",
      country: "US",
      date: "2026-10-14T12:30:00Z",
      importance: 1,
      forecast: 2.5,
      previous: 2.1,
      actual: 2.3,
      currency: "USD",
      scale: 1,
    },
    {
      title: "Non-Farm Payrolls",
      country: "US",
      date: "2026-10-15T12:30:00Z",
      importance: 1,
      forecast: 180,
      previous: 150,
      actual: 200,
      currency: "USD",
      scale: 1000,
    },
    {
      title: "Unemployment Rate",
      country: "US",
      date: "2026-10-16T12:30:00Z",
      importance: 0,
      forecast: 3.9,
      previous: 3.8,
      actual: 3.7,
      currency: "USD",
      scale: 1,
    },
    {
      title: "Retail Sales m/m",
      country: "US",
      date: "2026-10-17T12:30:00Z",
      importance: 0,
      forecast: null,
      previous: null,
      actual: null,
      currency: "USD",
      scale: 1,
    },
    {
      title: "Interest Rate Decision",
      country: "US",
      date: "2026-10-18T12:30:00Z",
      importance: -1, // importance negatif -> harus di-skip
      forecast: 5.5,
      previous: 5.5,
      actual: 5.5,
      currency: "USD",
      scale: 1,
    },
    {
      title: "Trade Balance",
      country: "US",
      date: "2026-10-19T12:30:00Z",
      importance: 0,
      forecast: -65,
      previous: -60,
      actual: -62,
      currency: "USD",
      scale: 1000000000, // miliar
    },
    {
      // Kasus NYATA dari data produksi: event persen di zona Euro.
      // Nilai 0.8 = 0,8 PERSEN. Kalau satuan diambil dari `currency`,
      // hasilnya "0.8 EUR" yang SALAH secara faktual.
      title: "Retail Sales YoY",
      country: "EU",
      date: "2026-10-06T12:15:00Z",
      importance: 0,
      forecast: null,
      previous: 0.2,
      actual: 0.8,
      currency: "EUR",
      scale: undefined,
    },
    {
      // Nilai absolut TANPA scale dan TANPA kata kunci persen ->
      // harus dibiarkan polos, bukan ditempeli mata uang.
      title: "ADP Employment Change Weekly",
      country: "US",
      date: "2026-10-06T12:15:00Z",
      importance: 0,
      forecast: null,
      previous: null,
      actual: 23.75,
      currency: "USD",
      scale: undefined,
    },
  ],
};

const EMPTY_RESPONSE = { result: [] };

// Helper: panggil fetchCalendar dengan rentang default.
async function fetchFixture() {
  return tradingviewCalendarProvider.fetchCalendar("2026-10-13", "2026-10-20", "US");
}

// ─────────────────────────────────────────────────────────────────────────────
// tradingviewCalendarProvider.fetchCalendar
// ─────────────────────────────────────────────────────────────────────────────

describe("tradingviewCalendarProvider.fetchCalendar", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("mem-fetch dan mem-parse calendar dengan benar", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    expect(events.length).toBeGreaterThan(0);
    const cpi = events.find((e) => e.title === "CPI m/m");
    expect(cpi).toBeDefined();
    expect(cpi!.country).toBe("US");
    expect(cpi!.impact).toBe("High");
  });

  it("menampilkan persen untuk event berjudul persen (satuan dari JUDUL, bukan currency)", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    const cpi = events.find((e) => e.title === "CPI m/m");
    expect(cpi!.forecast).toBe("0.3%");
    expect(cpi!.previous).toBe("0.2%");
    expect(cpi!.actual).toBe(""); // actual null -> string kosong

    const gdp = events.find((e) => e.title === "GDP q/q");
    expect(gdp!.forecast).toBe("2.5%");
    expect(gdp!.previous).toBe("2.1%");
    expect(gdp!.actual).toBe("2.3%");

    const unemp = events.find((e) => e.title === "Unemployment Rate");
    expect(unemp!.forecast).toBe("3.9%");
  });

  it("memakai scale sebagai suffix MAGNITUDE (K/M/B) tanpa kode mata uang", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    const nfp = events.find((e) => e.title === "Non-Farm Payrolls");
    expect(nfp!.forecast).toBe("180K");
    expect(nfp!.previous).toBe("150K");
    expect(nfp!.actual).toBe("200K");
  });

  it("menampilkan suffix miliar (B) untuk nilai besar, tanpa kode mata uang", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    const trade = events.find((e) => e.title === "Trade Balance");
    expect(trade!.forecast).toBe("-65B");
    expect(trade!.forecast).not.toContain("USD");
  });

  it("TIDAK menempelkan kode mata uang pada nilai persen (regresi '0.8 EUR')", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    const retailEu = events.find((e) => e.title === "Retail Sales YoY");

    // Nilai 0.8 adalah 0,8 persen, bukan 0,8 EUR.
    expect(retailEu!.actual).toBe("0.8%");
    expect(retailEu!.actual).not.toContain("EUR");
    expect(retailEu!.previous).toBe("0.2%");
  });

  it("membiarkan nilai tanpa satuan yang bisa dipercaya tetap polos", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    const adp = events.find((e) => e.title === "ADP Employment Change Weekly");

    // Tidak ada scale, judul tidak menandakan persen -> jangan mengarang satuan.
    expect(adp!.actual).toBe("23.75");
    expect(adp!.actual).not.toContain("USD");
    expect(adp!.actual).not.toContain("%");
  });

  it("TIDAK menempelkan persen pada indeks harga 'CPI' (level, bukan persen)", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    const cpiLevel = events.find((e) => e.title === "CPI");

    // 336.65 adalah level indeks, bukan 336,65 persen.
    expect(cpiLevel!.forecast).toBe("336.65");
    expect(cpiLevel!.forecast).not.toContain("%");
    expect(cpiLevel!.previous).toBe("335.2");

    // Sedangkan "CPI m/m" TETAP persen.
    const cpiMoM = events.find((e) => e.title === "CPI m/m");
    expect(cpiMoM!.forecast).toBe("0.3%");
  });

  it("menangani null forecast/previous/actual dengan benar", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    const retail = events.find((e) => e.title === "Retail Sales m/m");
    expect(retail!.forecast).toBe("");
    expect(retail!.previous).toBe("");
    expect(retail!.actual).toBe("");
  });

  it("skip event dengan importance < 0", async () => {
    mockedGet.mockResolvedValueOnce({ data: CALENDAR_RESPONSE });

    const events = await fetchFixture();
    const rate = events.find((e) => e.title === "Interest Rate Decision");
    expect(rate).toBeUndefined();
  });

  it("mengembalikan array kosong untuk response kosong", async () => {
    mockedGet.mockResolvedValueOnce({ data: EMPTY_RESPONSE });
    expect(await fetchFixture()).toEqual([]);
  });

  it("mengembalikan array kosong saat axios throw", async () => {
    mockedGet.mockRejectedValueOnce(new Error("network error"));
    expect(await fetchFixture()).toEqual([]);
  });

  it("dedupe event berdasarkan title+country+date", async () => {
    const dupResponse = {
      result: [
        { title: "CPI m/m", country: "US", date: "2026-10-13T12:30:00Z", importance: 1, forecast: 0.3, previous: 0.2, actual: 0.3, currency: "%", scale: 1 },
        { title: "CPI m/m", country: "US", date: "2026-10-13T12:30:00Z", importance: 1, forecast: 0.3, previous: 0.2, actual: 0.3, currency: "%", scale: 1 },
      ],
    };
    mockedGet.mockResolvedValueOnce({ data: dupResponse });
    expect(await fetchFixture()).toHaveLength(1);
  });

  it("mapImportance: 1=High, 0=Medium, lainnya=Low", async () => {
    const resp = {
      result: [
        { title: "A", country: "US", date: "2026-10-13T12:30:00Z", importance: 1, forecast: 1, previous: 1, actual: 1, currency: "%", scale: 1 },
        { title: "B", country: "US", date: "2026-10-14T12:30:00Z", importance: 0, forecast: 1, previous: 1, actual: 1, currency: "%", scale: 1 },
        { title: "C", country: "US", date: "2026-10-15T12:30:00Z", importance: -1, forecast: 1, previous: 1, actual: 1, currency: "%", scale: 1 },
        { title: "D", country: "US", date: "2026-10-16T12:30:00Z", importance: 2, forecast: 1, previous: 1, actual: 1, currency: "%", scale: 1 },
      ],
    };
    mockedGet.mockResolvedValueOnce({ data: resp });

    const events = await fetchFixture();
    const a = events.find((e) => e.title === "A");
    const b = events.find((e) => e.title === "B");
    const c = events.find((e) => e.title === "C");
    const d = events.find((e) => e.title === "D");
    expect(a!.impact).toBe("High");
    expect(b!.impact).toBe("Medium");
    expect(c).toBeUndefined(); // importance -1 di-skip
    expect(d!.impact).toBe("Low"); // importance 2 -> Low
  });
});
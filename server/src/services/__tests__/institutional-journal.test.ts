import { describe, it, expect, vi, beforeEach } from "vitest";
import { maeMfeService } from "../mae-mfe.service";
import { journalMacroBridgeService } from "../journal-macro-bridge.service";
import axios from "axios";

vi.mock("axios");

describe("MaeMfeService", () => {
  it("computes MAE-R and MFE-R correctly for a LONG trade (manual prices)", async () => {
    // LONG entry 2000, SL 1990 (Risk = 10 pts)
    // Worst price reached = 1995 (5 pts adverse = 0.5R)
    // Best price reached = 2030 (30 pts favorable = 3.0R)
    const result = await maeMfeService.calculate({
      direction: "LONG",
      entryPrice: 2000,
      stopLoss: 1990,
      worstPriceReached: 1995,
      bestPriceReached: 2030,
    });

    expect(result.maeR).toBe(0.5);
    expect(result.mfeR).toBe(3.0);
    expect(result.source).toBe("manual");
  });

  it("computes MAE-R and MFE-R correctly for a SHORT trade (manual prices)", async () => {
    // SHORT entry 2000, SL 2010 (Risk = 10 pts)
    // Worst price reached = 2005 (5 pts adverse = 0.5R)
    // Best price reached = 1970 (30 pts favorable = 3.0R)
    const result = await maeMfeService.calculate({
      direction: "SHORT",
      entryPrice: 2000,
      stopLoss: 2010,
      worstPriceReached: 2005,
      bestPriceReached: 1970,
    });

    expect(result.maeR).toBe(0.5);
    expect(result.mfeR).toBe(3.0);
    expect(result.source).toBe("manual");
  });

  it("returns nulls when SL distance is 0", async () => {
    const result = await maeMfeService.calculate({
      direction: "LONG",
      entryPrice: 2000,
      stopLoss: 2000,
    });

    expect(result.maeR).toBeNull();
    expect(result.mfeR).toBeNull();
    expect(result.source).toBe("unavailable");
  });
});

describe("JournalMacroBridgeService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("captures macro regime snapshot when Macro Terminal API responds", async () => {
    (axios.get as any).mockResolvedValue({
      data: {
        success: true,
        data: {
          quadrant: "Stagflation",
          liquidity: { riskState: "HEALTHY" },
          vix: { value: 18.5 },
          yieldCurve: { spread10y2y: -0.35 },
        },
      },
    });

    const snapshot = await journalMacroBridgeService.captureSnapshot();

    expect(snapshot).not.toBeNull();
    expect(snapshot?.regime).toBe("Stagflation");
    expect(snapshot?.liquidityRisk).toBe("HEALTHY");
    expect(snapshot?.vix).toBe(18.5);
    expect(snapshot?.yieldCurveSpread).toBe(-0.35);
  });

  it("returns null gracefully if Macro Terminal is unreachable", async () => {
    (axios.get as any).mockRejectedValue(new Error("Network Error"));

    const snapshot = await journalMacroBridgeService.captureSnapshot();

    expect(snapshot).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { normalizeAccountInfo } from "../account-info-normalizer";

describe("normalizeAccountInfo", () => {
  it("preserves absent WS risk fields for partial merges", () => {
    const normalized = normalizeAccountInfo({ balance: 1200, equity: 1250 });
    expect(normalized).toEqual({ balance: 1200, equity: 1250 });
    expect("dailyPnL" in normalized).toBe(false);
    expect("openRisk" in normalized).toBe(false);
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "normalizes invalid present numeric value %s to zero",
    (value) => {
      const normalized = normalizeAccountInfo({ dailyPnL: value as number, openRisk: value as number });
      expect(normalized.dailyPnL).toBe(0);
      expect(normalized.openRisk).toBe(0);
    },
  );

  it("preserves valid risk values exactly", () => {
    expect(normalizeAccountInfo({ dailyPnL: -12.5, openRisk: 42.75 })).toEqual({
      dailyPnL: -12.5,
      openRisk: 42.75,
    });
  });
});

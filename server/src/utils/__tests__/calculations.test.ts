import { describe, it, expect } from "vitest";
import {
  calculateRiskAmount,
  calculateRMultiple,
  calculateProfitFactor,
  calculateExpectancy,
} from "../calculations";

describe("calculations utility", () => {
  describe("calculateRiskAmount", () => {
    it("should calculate correct risk amount with default pip multiplier", () => {
      const entry = 1.1200;
      const sl = 1.1150;
      const lotSize = 2; // 2 lots
      // Expected = Math.abs(1.1200 - 1.1150) * 2 * 100 = 0.0050 * 200 = 1.0
      expect(calculateRiskAmount(entry, sl, lotSize)).toBeCloseTo(1.0);
    });

    it("should calculate correct risk amount with custom pip multiplier", () => {
      const entry = 1.1200;
      const sl = 1.1100;
      const lotSize = 1;
      const multiplier = 1000;
      // Expected = Math.abs(1.1200 - 1.1100) * 1 * 1000 = 0.0100 * 1000 = 10.0
      expect(calculateRiskAmount(entry, sl, lotSize, multiplier)).toBeCloseTo(10.0);
    });

    it("should handle stop loss higher than entry price (short position)", () => {
      const entry = 1.1200;
      const sl = 1.1250;
      const lotSize = 1;
      // Expected = Math.abs(1.1200 - 1.1250) * 1 * 100 = 0.0050 * 100 = 0.5
      expect(calculateRiskAmount(entry, sl, lotSize)).toBeCloseTo(0.5);
    });
  });

  describe("calculateRMultiple", () => {
    it("should calculate correct R-Multiple", () => {
      expect(calculateRMultiple(300, 100)).toBe(3.0);
      expect(calculateRMultiple(-150, 100)).toBe(-1.5);
    });

    it("should return 0 when risk amount is 0", () => {
      expect(calculateRMultiple(300, 0)).toBe(0);
    });

    it("should format to 2 decimal places", () => {
      expect(calculateRMultiple(100, 30)).toBe(3.33);
    });
  });

  describe("calculateProfitFactor", () => {
    it("should calculate correct profit factor", () => {
      expect(calculateProfitFactor(3000, 1500)).toBe(2.0);
      expect(calculateProfitFactor(500, 1000)).toBe(0.5);
    });

    it("should prevent infinity when gross loss is 0", () => {
      expect(calculateProfitFactor(1000, 0)).toBe(99.99);
      expect(calculateProfitFactor(0, 0)).toBe(0);
    });
  });

  describe("calculateExpectancy", () => {
    it("should calculate correct expectancy", () => {
      // WinRate: 50%, AvgWin: $200, AvgLoss: $100
      // Expectancy = (0.5 * 200) - (0.5 * 100) = 100 - 50 = 50
      expect(calculateExpectancy(50, 200, 100)).toBe(50.0);
    });

    it("should handle negative avgLoss and compute absolute value", () => {
      // Even if passed as negative (-100), it should be handled correctly
      expect(calculateExpectancy(50, 200, -100)).toBe(50.0);
    });

    it("should calculate correct expectancy for losing win rates", () => {
      // WinRate: 30%, AvgWin: $300, AvgLoss: $100
      // Expectancy = (0.3 * 300) - (0.7 * 100) = 90 - 70 = 20
      expect(calculateExpectancy(30, 300, 100)).toBe(20.0);
    });
  });
});

import { describe, expect, it } from "vitest";
import { getAmountIDR, validateAmountIDR, getPricingCatalog } from "../payment-pricing";

describe("payment pricing acceptance", () => {
  it("rejects a client amount that is not the server price", () => {
    expect(validateAmountIDR({
      orderType: "package",
      packageType: "premium",
      amountIDR: 1,
      isBooster: false,
    })).toEqual({
      ok: false,
      error: expect.stringContaining("does not match the price table"),
    });
  });

  it("prices premium without booster at Rp3.500.000", () => {
    expect(getAmountIDR({ orderType: "package", packageType: "premium", isBooster: false }))
      .toBe(3_500_000);
  });

  it("prices premium booster once at Rp3.150.000, not Rp2.835.000", () => {
    expect(getAmountIDR({ orderType: "package", packageType: "premium", isBooster: true }))
      .toBe(3_150_000);
    expect(getAmountIDR({ orderType: "package", packageType: "premium", isBooster: true }))
      .not.toBe(2_835_000);
  });

  it("rejects tampered client amount for premium booster", () => {
    expect(validateAmountIDR({
      orderType: "package",
      packageType: "premium",
      amountIDR: 3_500_000,
      isBooster: true,
    }).ok).toBe(false);
  });
});

describe("GET /api/v1/payment/prices catalog shape", () => {
  it("returns basic, pro, premium packages with amountIDR, durationMs, label", () => {
    const catalog = getPricingCatalog(false);
    expect(catalog.currency).toBe("IDR");
    expect(catalog.boosterDiscountRate).toBe(0.1);

    for (const pkg of ["basic", "pro", "premium"] as const) {
      const p = catalog.packages[pkg];
      expect(p).toHaveProperty("amountIDR");
      expect(p).toHaveProperty("durationMs");
      expect(p).toHaveProperty("label");
      expect(p.amountIDR).toBeGreaterThan(0);
    }
  });

  it("returns registration pricing in the catalog", () => {
    const catalog = getPricingCatalog(false);
    expect(catalog.registration.amountIDR).toBe(150_000);
  });

  it("applies booster discount to package prices when isBooster=true", () => {
    const base = getPricingCatalog(false);
    const boosted = getPricingCatalog(true);

    for (const pkg of ["basic", "pro", "premium"] as const) {
      const discounted = base.packages[pkg].amountIDR * (1 - base.boosterDiscountRate);
      expect(boosted.packages[pkg].amountIDR).toBe(Math.round(discounted));
    }
  });

  it("premium booster is discounted once (3_150_000), not twice", () => {
    const boosted = getPricingCatalog(true);
    expect(boosted.packages.premium.amountIDR).toBe(3_150_000);
  });
});

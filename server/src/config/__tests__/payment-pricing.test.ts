import { describe, expect, it } from "vitest";
import { getAmountIDR, validateAmountIDR } from "../payment-pricing";

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

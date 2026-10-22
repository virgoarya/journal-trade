import { beforeEach, describe, expect, it, vi } from "vitest";

const createTransactionToken = vi.hoisted(() => vi.fn().mockResolvedValue("snap-token"));

vi.mock("midtrans-client", () => ({
  Snap: class MockSnap { createTransactionToken = createTransactionToken; },
  CoreApi: class MockCoreApi {},
}));

import { createSnapToken } from "../midtrans.service";

describe("createSnapToken server-side amount", () => {
  beforeEach(() => createTransactionToken.mockClear());

  it("sends the validated premium booster amount to Snap", async () => {
    await createSnapToken({
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      amountIDR: 3_150_000,
      isBooster: true,
      orderType: "package",
      packageType: "premium",
      orderId: "pkg_aaaaaaaaaaaaaaaaaaaaaaaa_premium_test",
    });

    expect(createTransactionToken).toHaveBeenCalledWith(expect.objectContaining({
      gross_amount: 3_150_000,
      transaction_details: { order_id: "pkg_aaaaaaaaaaaaaaaaaaaaaaaa_premium_test", gross_amount: 3_150_000 },
      items: [expect.objectContaining({ price: 3_150_000, quantity: 1 })],
    }));
  });
});

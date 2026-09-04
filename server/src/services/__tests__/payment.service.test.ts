import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

// Mock models (paths relative to THIS file)
vi.mock("../../models/Registration", () => ({
  Registration: { findOneAndUpdate: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../../models/Subscription", () => ({
  Subscription: { findOneAndUpdate: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../../models/TokenBalance", () => ({
  TokenBalance: { findOneAndUpdate: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../../models/Transaction", () => ({
  Transaction: { create: vi.fn().mockResolvedValue({}) },
}));

import {
  verifyMidtransSignature,
  parseOrderId,
  handlePaymentSuccess,
} from "../payment.service";
import { Transaction } from "../../models/Transaction";
import { Registration } from "../../models/Registration";
import { Subscription } from "../../models/Subscription";
import { TokenBalance } from "../../models/TokenBalance";

const TEST_SERVER_KEY = "SB-Mid-server-testkey1234567890";

describe("payment.service", () => {
  beforeEach(() => {
    process.env.MIDTRANS_SERVER_KEY = TEST_SERVER_KEY;
    vi.clearAllMocks();
  });

  describe("verifyMidtransSignature", () => {
    it("should return true for a correctly computed signature", () => {
      const payload = {
        order_id: "token_topup_usr_123_1690000000",
        status_code: "200",
        gross_amount: "50000.00",
        signature_key: "",
      };
      payload.signature_key = crypto
        .createHash("sha512")
        .update(
          payload.order_id + payload.status_code + payload.gross_amount + TEST_SERVER_KEY
        )
        .digest("hex");

      expect(verifyMidtransSignature(payload)).toBe(true);
    });

    it("should return false for a tampered signature", () => {
      const payload = {
        order_id: "token_topup_usr_123_1690000000",
        status_code: "200",
        gross_amount: "50000.00",
        signature_key: "deadbeef",
      };
      expect(verifyMidtransSignature(payload)).toBe(false);
    });
  });

  describe("parseOrderId", () => {
    it("should parse token_topup order id correctly", () => {
      const ctx = parseOrderId("token_topup_usra_1690000000");
      expect(ctx).toEqual({ orderType: "token_topup", userId: "usra" });
    });

    it("should parse registration order id correctly", () => {
      const ctx = parseOrderId("registration_usrb_1690000000");
      expect(ctx).toEqual({ orderType: "registration", userId: "usrb" });
    });

    it("should return null for malformed order id", () => {
      expect(parseOrderId("invalid")).toBeNull();
      expect(parseOrderId("only_one_part")).toBeNull();
    });

    it("should reject orderType that is neither registration nor token_topup", () => {
      expect(parseOrderId("unknown_usr_1690000000")).toBeNull();
    });
  });

  describe("handlePaymentSuccess", () => {
    it("should create transaction + registration + subscription + token balance for registration", async () => {
      const result = await handlePaymentSuccess(
        "registration_usr_abc_1690000000",
        100000,
        "usr_abc",
        "registration",
        "txn_1",
        false
      );

      expect(Transaction.create).toHaveBeenCalledOnce();
      expect(Registration.findOneAndUpdate).toHaveBeenCalledOnce();
      expect(Subscription.findOneAndUpdate).toHaveBeenCalledOnce();
      expect(TokenBalance.findOneAndUpdate).toHaveBeenCalledOnce();
      expect(result).toContain("Registration activated for user usr_abc");
    });

    it("should increment token balance for token_topup", async () => {
      const result = await handlePaymentSuccess(
        "token_topup_usr_abc_1690000000",
        50000,
        "usr_abc",
        "token_topup",
        "txn_2",
        false
      );

      expect(Transaction.create).toHaveBeenCalledOnce();
      expect(TokenBalance.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "usr_abc" }),
        expect.objectContaining({ $inc: { balance: 50 } }),
        expect.any(Object)
      );
      expect(result).toContain("+50 tokens for user usr_abc");
    });
  });
});

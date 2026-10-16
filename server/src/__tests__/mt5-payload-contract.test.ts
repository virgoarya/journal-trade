import { describe, it, expect } from "vitest";
import { Mt5Position, Mt5Order } from "../../../frontend/src/types/ws-types";
import { normalizePositionForFrontend } from "../../../server/src/mt5-streamer";

describe("normalizePositionForFrontend", () => {
  it("should map internal position to Mt5Position frontend type", () => {
    const internalPos = {
      ticket: 12345,
      symbol: "EURUSD",
      type: "BUY",
      priceOpen: 1.0876,
      profit: 12.5,
    };

    const result = normalizePositionForFrontend(internalPos);

    expect(result).toEqual({
      id: "12345",
      symbol: "EURUSD",
      entryPrice: 1.0876,
      pnl: 12.5,
      status: "open",
    });

    // Verify it matches Mt5Position interface
    const position: Mt5Position = result;
    expect(position.id).toBe("12345");
    expect(position.symbol).toBe("EURUSD");
    expect(position.entryPrice).toBe(1.0876);
    expect(position.pnl).toBe(12.5);
    expect(position.status).toBe("open");
  });

  it("should map SELL position to open status", () => {
    const internalPos = {
      ticket: 67890,
      symbol: "GBPUSD",
      type: "SELL",
      priceOpen: 1.2543,
      profit: -8.2,
    };

    const result = normalizePositionForFrontend(internalPos);

    expect(result).toEqual({
      id: "67890",
      symbol: "GBPUSD",
      entryPrice: 1.2543,
      pnl: -8.2,
      status: "open",
    });
  });

  it("should map pending order to closed status", () => {
    const internalOrder = {
      ticket: 54321,
      symbol: "USDJPY",
      type: "BUY_LIMIT",
      priceOpen: 110.25,
      profit: 0,
    };

    const result = normalizePositionForFrontend(internalOrder);

    expect(result).toEqual({
      id: "54321",
      symbol: "USDJPY",
      entryPrice: 110.25,
      pnl: 0,
      status: "closed",
    });
  });

  it("should handle missing fields gracefully", () => {
    const partialPos = {
      ticket: null,
      symbol: undefined,
      type: "BUY",
      priceOpen: undefined,
      profit: null,
    };

    const result = normalizePositionForFrontend(partialPos);

    expect(result).toEqual({
      id: "0",
      symbol: "",
      entryPrice: 0,
      pnl: 0,
      status: "open",
    });
  });
});

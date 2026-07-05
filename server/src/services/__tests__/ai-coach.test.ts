import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiCoachService } from "../ai-coach.service";
import { Trade } from "../../models/Trade";
import { Playbook } from "../../models/Playbook";
import { TradingAccount } from "../../models/TradingAccount";

vi.mock("../../models/Trade", () => {
  return {
    Trade: {
      find: vi.fn(),
    },
  };
});

vi.mock("../../models/Playbook", () => {
  return {
    Playbook: {
      find: vi.fn(),
    },
  };
});

vi.mock("../../models/TradingAccount", () => {
  return {
    TradingAccount: {
      findOne: vi.fn(),
    },
  };
});

describe("aiCoachService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should compile correct trading context when trade logs exist", async () => {
    // Mock Active Account
    vi.mocked(TradingAccount.findOne).mockResolvedValue({
      name: "MetaTrader 5 Live",
      balance: 10500.5,
      currency: "USD",
      riskTier: "CONSERVATIVE",
    } as any);

    // Mock Trades (2 wins, 1 loss, 1 breakeven)
    const mockTrades = [
      { _id: { toString: () => "t1" }, pair: "EURUSD", direction: "LONG", result: "WIN", actualPnl: 150.0, rMultiple: 1.5, session: "London", emotionalState: 4, notes: "Good trade discipline" },
      { _id: { toString: () => "t2" }, pair: "GBPUSD", direction: "SHORT", result: "LOSS", actualPnl: -100.0, rMultiple: -1.0, session: "NY AM", emotionalState: 2, notes: "FOMO on breakout" },
      { _id: { toString: () => "t3" }, pair: "XAUUSD", direction: "LONG", result: "WIN", actualPnl: 250.0, rMultiple: 2.5, session: "NY PM", emotionalState: 5, notes: "Excellent execution" },
      { _id: { toString: () => "t4" }, pair: "USDCAD", direction: "SHORT", result: "BREAKEVEN", actualPnl: 0.0, rMultiple: 0.0, session: "Asia", emotionalState: 3, notes: "No emotion" },
    ];

    // Set up mock chain: Trade.find().sort().limit()
    const sortMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockResolvedValue(mockTrades);
    vi.mocked(Trade.find).mockReturnValue({
      sort: sortMock,
      limit: limitMock,
    } as any);

    // Mock Playbooks
    vi.mocked(Playbook.find).mockResolvedValue([
      {
        _id: { toString: () => "p1" },
        name: "ICT Silver Bullet",
        methodology: "ICT",
        marketCondition: "TRENDING",
        rules: ["Rule 1", "Rule 2"],
        stats: { totalTrades: 12, winRate: 66.7, totalPnL: 850 },
      }
    ] as any);

    const context = await aiCoachService.getUserTradingContext("user-123");

    // Assertions on active account
    expect(context.account).not.toBeNull();
    expect(context.account?.name).toBe("MetaTrader 5 Live");
    expect(context.account?.balance).toBe(10500.5);

    // Assertions on stats
    expect(context.performanceSummary.evaluatedTradesCount).toBe(4);
    expect(context.performanceSummary.winRate).toBe("50.0%"); // 2 wins out of 4 trades
    expect(context.performanceSummary.accumulatedPnL).toBe("300.00"); // 150 - 100 + 250 + 0 = 300
    expect(context.performanceSummary.averageEmotionalRating).toBe("3.5"); // (4+2+5+3)/4 = 3.5

    // Assertions on Playbooks
    expect(context.playbooks).toHaveLength(1);
    expect(context.playbooks[0].name).toBe("ICT Silver Bullet");
    expect(context.playbooks[0].rulesCount).toBe(2);

    // Assertions on Recent Trades
    expect(context.recentTrades).toHaveLength(4);
    expect(context.recentTrades[0].pair).toBe("EURUSD");
    expect(context.recentTrades[1].result).toBe("LOSS");
  });

  it("should handle empty trading database gracefully", async () => {
    vi.mocked(TradingAccount.findOne).mockResolvedValue(null);

    const sortMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockResolvedValue([]);
    vi.mocked(Trade.find).mockReturnValue({
      sort: sortMock,
      limit: limitMock,
    } as any);

    vi.mocked(Playbook.find).mockResolvedValue([]);

    const context = await aiCoachService.getUserTradingContext("user-123");

    expect(context.account).toBeNull();
    expect(context.performanceSummary.evaluatedTradesCount).toBe(0);
    expect(context.performanceSummary.winRate).toBe("0%");
    expect(context.performanceSummary.averageEmotionalRating).toBe("Tidak dicatat");
    expect(context.playbooks).toHaveLength(0);
    expect(context.recentTrades).toHaveLength(0);
  });
});

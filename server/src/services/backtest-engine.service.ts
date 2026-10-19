/**
 * Backtest Engine — schema-agnostik, data-driven.
 *
 * Input: array trade log (synthetic atau dari MongoDB nanti).
 * Output: BacktestReport dengan win rate, profit factor, expectancy,
 *         max drawdown, dan breakdown per methodology / symbol.
 *
 * Sengaja tanpa dependency MongoDB — engine murni function, mudah di-test.
 */

export interface BacktestTradeInput {
  symbol: string;
  direction: string;
  confidence: number;
  methodology: string;
  pnl: number;
}

export interface BacktestBreakdown {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
}

export interface BacktestReport {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  netPnl: number;
  perMethodology: Record<string, BacktestBreakdown>;
  perSymbol: Record<string, BacktestBreakdown>;
}

const EMPTY_BREAKDOWN: BacktestBreakdown = {
  trades: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  netPnl: 0,
};

function breakdownFor(map: Record<string, BacktestBreakdown>, key: string): BacktestBreakdown {
  if (!map[key]) {
    map[key] = { ...EMPTY_BREAKDOWN };
  }
  return map[key];
}

function finalizeBreakdown(b: BacktestBreakdown): BacktestBreakdown {
  const decided = b.wins + b.losses;
  return { ...b, winRate: decided > 0 ? b.wins / decided : 0 };
}

export function runBacktest(trades: BacktestTradeInput[]): BacktestReport {
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netPnl = 0;

  // Equity curve untuk max drawdown
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  const perMethodology: Record<string, BacktestBreakdown> = {};
  const perSymbol: Record<string, BacktestBreakdown> = {};

  for (const trade of trades) {
    const pnl = trade.pnl ?? 0;
    netPnl += pnl;

    const isWin = pnl > 0;
    const isLoss = pnl < 0;
    if (isWin) {
      wins++;
      grossProfit += pnl;
    } else if (isLoss) {
      losses++;
      grossLoss += Math.abs(pnl);
    }

    equity += pnl;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    const m = breakdownFor(perMethodology, trade.methodology ?? "unknown");
    m.trades++;
    m.netPnl += pnl;
    if (isWin) m.wins++;
    if (isLoss) m.losses++;

    const s = breakdownFor(perSymbol, trade.symbol ?? "unknown");
    s.trades++;
    s.netPnl += pnl;
    if (isWin) s.wins++;
    if (isLoss) s.losses++;
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? wins / decided : 0;
  const expectancy = trades.length > 0 ? netPnl / trades.length : 0;

  let profitFactor: number;
  if (grossLoss === 0) {
    profitFactor = grossProfit > 0 ? Infinity : 0;
  } else {
    profitFactor = grossProfit / grossLoss;
  }

  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate,
    profitFactor,
    expectancy,
    avgWin,
    avgLoss,
    maxDrawdown,
    netPnl,
    perMethodology: Object.fromEntries(
      Object.entries(perMethodology).map(([k, v]) => [k, finalizeBreakdown(v)])
    ),
    perSymbol: Object.fromEntries(
      Object.entries(perSymbol).map(([k, v]) => [k, finalizeBreakdown(v)])
    ),
  };
}

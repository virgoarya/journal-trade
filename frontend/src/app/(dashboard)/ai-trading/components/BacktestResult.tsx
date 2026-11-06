"use client";

import React, { useState, useMemo, useCallback, Component, ErrorInfo, ReactNode } from "react";
import {
  type BacktestResult as BacktestResultData,
  type BacktestAnalysis,
  type BacktestTrade,
} from "@/services/backtest.service";
import { TradingChart } from "./TradingChart";
import { useMarketReplay } from "../hooks/useMarketReplay";
import { ReplayControls } from "./TradingChart";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  CheckCircle2,
  Zap,
  BrainCircuit,
  BarChart3,
  ChevronRight,
  Award,
  Percent,
  Shield,
  Layers,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

// ── Defensive Safe Formatting Helpers ─────────────────────────────────

const safeNum = (val: any, fallback = 0): number => {
  const n = Number(val);
  return !isNaN(n) && isFinite(n) ? n : fallback;
};

const safeFixed = (val: any, digits = 2, fallback = "0.00"): string => {
  const n = Number(val);
  return !isNaN(n) && isFinite(n) ? n.toFixed(digits) : fallback;
};

const safeDateStr = (ts: any): string => {
  if (ts === undefined || ts === null || ts === "") return "-";
  const num = Number(ts);
  if (isNaN(num)) return "-";
  const ms = num < 1e11 ? num * 1000 : num;
  const date = new Date(ms);
  return isNaN(date.getTime()) ? "-" : date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// ── Error Boundary ──────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  result: BacktestResultData | null;
  analysis: BacktestAnalysis | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onApplyToPipeline: () => void;
  isApplying: boolean;
}

class BacktestResultErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("BacktestResult ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto" />
          <h3 className="text-base font-bold text-white uppercase tracking-wider">Result Display Error</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            {this.state.error?.message || "An unexpected error occurred while rendering backtest results."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-accent-gold text-black text-xs font-bold rounded-lg uppercase tracking-wider hover:bg-yellow-400 transition"
          >
            Retry Display
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function BacktestResultContent({ result, analysis, isAnalyzing, onAnalyze, onApplyToPipeline, isApplying }: Props) {
  const [showTrades, setShowTrades] = useState(false);
  const [tradePage, setTradePage] = useState(1);
  const tradesPerPage = 50;

  // Downsample equity curve to max 300 points for smooth Recharts rendering
  const chartData = useMemo(() => {
    if (!result?.equityCurve || !Array.isArray(result.equityCurve) || result.equityCurve.length === 0) return [];
    const raw = result.equityCurve;
    const maxPoints = 300;
    const safePointDate = (ts: any) => {
      if (ts === undefined || ts === null) return "-";
      const num = Number(ts);
      if (isNaN(num)) return "-";
      const ms = num < 1e11 ? num * 1000 : num;
      const date = new Date(ms);
      return isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
    };

    if (raw.length <= maxPoints) {
      return raw.map((p) => ({
        time: safePointDate(p?.time),
        equity: safeNum(p?.equity),
      }));
    }
    const step = Math.ceil(raw.length / maxPoints);
    const sampled = [];
    for (let i = 0; i < raw.length; i += step) {
      sampled.push({
        time: safePointDate(raw[i]?.time),
        equity: safeNum(raw[i]?.equity),
      });
    }
    const lastRaw = raw[raw.length - 1];
    if (lastRaw && sampled[sampled.length - 1]?.time !== safePointDate(lastRaw.time)) {
      sampled.push({
        time: safePointDate(lastRaw.time),
        equity: safeNum(lastRaw.equity),
      });
    }
    return sampled;
  }, [result?.equityCurve]);

  // Paginate trade history to prevent DOM bloat
  const allTrades = useMemo(() => (Array.isArray(result?.trades) ? result.trades : []), [result?.trades]);
  const totalTradePages = Math.max(1, Math.ceil(allTrades.length / tradesPerPage));
  const paginatedTrades = useMemo(() => {
    const start = (tradePage - 1) * tradesPerPage;
    return allTrades.slice(start, start + tradesPerPage);
  }, [allTrades, tradePage, tradesPerPage]);

  const bestSymbol = useMemo(() => {
    if (!result?.symbolStats || !Array.isArray(result.symbolStats) || result.symbolStats.length === 0) return null;
    return [...result.symbolStats].sort((a, b) => safeNum(b?.totalPnL) - safeNum(a?.totalPnL))[0] || null;
  }, [result?.symbolStats]);

  const worstSymbol = useMemo(() => {
    if (!result?.symbolStats || !Array.isArray(result.symbolStats) || result.symbolStats.length === 0) return null;
    return [...result.symbolStats].sort((a, b) => safeNum(a?.totalPnL) - safeNum(b?.totalPnL))[0] || null;
  }, [result?.symbolStats]);

  // Ensure result is valid before rendering
  if (!result || typeof result !== "object" || result.totalTrades === undefined) return null;

  const totalPnL = safeNum(result.totalPnL);
  const isProfitable = totalPnL >= 0;
  const maxDD = safeNum(result.maxDrawdown);
  const recoveryFactor = result.recoveryFactor ?? (maxDD > 0 ? totalPnL / maxDD : totalPnL > 0 ? Infinity : 0);
  const recoveryColor =
    recoveryFactor === Infinity
      ? "text-green-400"
      : recoveryFactor >= 3
      ? "text-green-400"
      : recoveryFactor >= 1.5
      ? "text-yellow-400"
      : "text-red-400";

  // MetricCard component
  const MetricCard = ({
    icon: Icon,
    label,
    value,
    color = "text-text-secondary",
    sub = null,
  }: {
    icon: React.ElementType;
    label: string;
    value: string;
    color?: string;
    sub?: string | null;
  }) => (
    <div className="bg-surface/60 border border-border-subtle/80 rounded-xl p-4 flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-text-muted" />
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-mono">{label}</span>
      </div>
      <div className={`font-mono font-bold text-text-primary ${color} text-xl tracking-wide`}>{value}</div>
      {sub && <span className="text-[9px] text-text-muted font-mono">{sub}</span>}
    </div>
  );

  return (
    <div className="glass p-6 space-y-6 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
      <div
        className={`absolute -top-32 -left-32 w-64 h-64 rounded-full blur-3xl pointer-events-none ${isProfitable ? "bg-green-500/10" : "bg-red-500/10"}`}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-accent-gold/20 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black/60 rounded-lg border border-accent-gold/30">
            <BarChart3 className="w-5 h-5 text-accent-gold" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary tracking-wide">Simulation Results</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {(result.symbols || []).join(", ")} · {result.timeframe || "-"} · {safeNum(result.totalCandles)} candles
            </p>
          </div>
        </div>
        {result.backtestId && (
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono text-text-muted bg-black/60 px-3 py-1.5 rounded border border-accent-gold/30">
              ID: {String(result.backtestId).substring(0, 8)}
            </div>
            {(() => {
              const [confirming, setConfirming] = React.useState(false);
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirming) {
                      setConfirming(true);
                      setTimeout(() => setConfirming(false), 4000);
                    } else {
                      setConfirming(false);
                      onApplyToPipeline();
                    }
                  }}
                  disabled={isApplying}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 border ${
                    confirming
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse"
                      : "bg-accent-gold/10 hover:bg-accent-gold/20 border-accent-gold/40 text-accent-gold"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Apply backtest parameters to active live pipeline"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : confirming ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Confirm Apply?</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Apply to Live</span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <MetricCard icon={Activity} label="Total Trades" value={`${safeNum(result.totalTrades)}`} />
        <MetricCard
          icon={Target}
          label="Win Rate"
          value={`${safeFixed(result.winRate, 1)}%`}
          color={safeNum(result.winRate) >= 50 ? "text-green-400" : "text-red-400"}
          sub={`${safeNum(result.winningTrades)}W / ${safeNum(result.losingTrades)}L`}
        />
        <MetricCard
          icon={isProfitable ? TrendingUp : TrendingDown}
          label="Net PnL"
          value={`${isProfitable ? "+" : ""}${safeFixed(result.totalPnLPercent, 2)}%`}
          color={isProfitable ? "text-green-400" : "text-red-400"}
          sub={`$${safeFixed(totalPnL, 2)}`}
        />
        <MetricCard
          icon={TrendingDown}
          label="Max DD"
          value={`${safeFixed(result.maxDrawdownPercent, 2)}%`}
          color={safeNum(result.maxDrawdownPercent) < 10 ? "text-green-400" : safeNum(result.maxDrawdownPercent) < 20 ? "text-yellow-400" : "text-red-400"}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 relative z-10">
        <MetricCard icon={Shield} label="Recovery Factor" value={recoveryFactor === Infinity ? "∞" : safeFixed(recoveryFactor, 2)} color={recoveryColor} />
        <MetricCard icon={Award} label="Profit Factor" value={result.profitFactor === Infinity ? "∞" : safeFixed(result.profitFactor, 2)} color={safeNum(result.profitFactor) >= 1.5 ? "text-green-400" : safeNum(result.profitFactor) >= 1 ? "text-yellow-400" : "text-red-400"} />
        <MetricCard icon={Activity} label="Avg Win" value={`$${safeFixed(result.averageWin, 2)}`} color="text-green-400" />
        <MetricCard icon={Activity} label="Avg Loss" value={`$${safeFixed(result.averageLoss, 2)}`} color="text-red-400" />
        <MetricCard icon={Percent} label="Sharpe" value={safeFixed(result.sharpeRatio, 2)} color={safeNum(result.sharpeRatio) >= 1 ? "text-green-400" : "text-text-secondary"} />
      </div>

      {/* Equity Curve */}
      {chartData.length > 1 && (
        <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-4 relative z-10">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">Equity Curve ({chartData.length} points)</p>
          <div className="w-full relative h-[200px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="btEqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={60} />
                <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", fontSize: "10px" }} />
                <Area type="monotone" dataKey="equity" stroke="#D4AF37" strokeWidth={2} fill="url(#btEqGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Market Replay - Replay trades on historical price data */}
      {(result.symbols && result.symbols.length > 0 && result.timeframe) && (
        <ReplaySection
          symbol={result.symbols[0]}
          timeframe={result.timeframe as any}
          fromDate={result.fromDate}
          toDate={result.toDate}
          trades={result.trades}
          equityCurve={result.equityCurve}
        />
      )}

      {/* Symbol Performance */}
      {result.symbolStats && Array.isArray(result.symbolStats) && result.symbolStats.length > 0 && (
        <div className="space-y-4 relative z-10">
          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-gold" />
            Symbol Performance
          </h4>
          <div className="bg-surface/80 border border-border-subtle/80 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface/50 text-xs uppercase text-text-muted border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Symbol</th>
                  <th className="px-4 py-3 font-medium text-center whitespace-nowrap">Trades</th>
                  <th className="px-4 py-3 font-medium text-center whitespace-nowrap">Win %</th>
                  <th className="px-4 py-3 font-medium text-center whitespace-nowrap">W/L/BE</th>
                  <th className="px-4 py-3 font-medium text-right whitespace-nowrap">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {result.symbolStats.map((stat, i) => (
                  <tr key={i} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary flex items-center gap-2">
                      {stat.symbol || "-"}
                      {bestSymbol && stat.symbol === bestSymbol.symbol && safeNum(stat.totalPnL) > 0 && <span className="text-[8px] bg-green-500/20 text-green-400 px-1 rounded">BEST</span>}
                      {worstSymbol && stat.symbol === worstSymbol.symbol && safeNum(stat.totalPnL) < 0 && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded">WORST</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{safeNum(stat.totalTrades)}</td>
                    <td className="px-4 py-3 text-center font-mono">{safeFixed(stat.winRate, 1)}%</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      <span className="text-green-400">{safeNum(stat.winningTrades)}W</span>
                      <span className="text-text-muted"> / </span>
                      <span className="text-red-400">{safeNum(stat.losingTrades)}L</span>
                      {safeNum((stat as any).breakEvenTrades) > 0 && <span className="text-text-muted"> / {safeNum((stat as any).breakEvenTrades)}BE</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${safeNum(stat.totalPnL) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {safeNum(stat.totalPnL) >= 0 ? "+" : ""}${safeFixed(stat.totalPnL, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Methodology Performance */}
      <div className="space-y-4 pt-6 border-t border-border-subtle relative z-10">
        <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-accent-gold" />
          Methodology Performance
        </h4>
        <div className="bg-surface/80 border border-border-subtle/80 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-surface/50 text-xs uppercase text-text-muted border-b border-border-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-center">Trades</th>
                <th className="px-4 py-3 font-medium text-center">Win %</th>
                <th className="px-4 py-3 font-medium text-center">W/L</th>
                <th className="px-4 py-3 font-medium text-right">PnL</th>
                <th className="px-4 py-3 font-medium text-right">Avg Conf</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {(result.methodologyStats || []).map((meth, idx) => {
                const allStats = result.methodologyStats || [];
                const bestStat = allStats.length ? [...allStats].sort((a: any, b: any) => safeNum(b?.totalPnL) - safeNum(a?.totalPnL))[0] : null;
                const worstStat = allStats.length ? [...allStats].sort((a: any, b: any) => safeNum(a?.totalPnL) - safeNum(b?.totalPnL))[0] : null;
                const isBest = bestStat?.methodology === meth.methodology && safeNum(meth.totalPnL) > 0;
                const isWorst = worstStat?.methodology === meth.methodology && safeNum(meth.totalPnL) < 0;

                return (
                  <tr key={idx} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary flex items-center gap-2 whitespace-nowrap">
                      {meth.methodology || "-"}
                      {isBest && <span className="text-[8px] bg-green-500/20 text-green-400 px-1 rounded">BEST</span>}
                      {isWorst && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded">WORST</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{safeNum(meth.totalTrades)}</td>
                    <td className="px-4 py-3 text-center font-mono">{safeFixed(meth.winRate, 1)}%</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      <span className="text-green-400">{safeNum(meth.winningTrades)}W</span>
                      <span className="text-text-muted"> / </span>
                      <span className="text-red-400">{safeNum(meth.losingTrades)}L</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${safeNum(meth.totalPnL) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {safeNum(meth.totalPnL) >= 0 ? "+" : ""}${safeFixed(meth.totalPnL, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">{safeFixed(meth.avgConfidence, 0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Performance */}
      {result.sessionStats && Array.isArray(result.sessionStats) && result.sessionStats.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-border-subtle relative z-10">
          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-gold" />
            Session Performance
          </h4>
          <div className="bg-surface/80 border border-border-subtle/80 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface/50 text-xs uppercase text-text-muted border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium text-center">Trades</th>
                  <th className="px-4 py-3 font-medium text-center">Win %</th>
                  <th className="px-4 py-3 font-medium text-center">W/L</th>
                  <th className="px-4 py-3 font-medium text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {(result.sessionStats || []).map((sess, idx) => (
                  <tr key={idx} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">{sess.session || "-"}</td>
                    <td className="px-4 py-3 text-center font-mono">{safeNum(sess.totalTrades)}</td>
                    <td className="px-4 py-3 text-center font-mono">{safeFixed(sess.winRate, 1)}%</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      <span className="text-green-400">{safeNum(sess.winningTrades)}W</span>
                      <span className="text-text-muted"> / </span>
                      <span className="text-red-400">{safeNum(sess.losingTrades)}L</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${safeNum(sess.totalPnL) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {safeNum(sess.totalPnL) >= 0 ? "+" : ""}${safeFixed(sess.totalPnL, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {isAnalyzing && (
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-center py-8 relative z-10">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="ml-2 text-sm text-text-muted">Analyzing backtest patterns...</span>
            </div>
          </motion.div>
        </div>
      )}

      {analysis && (
        <div>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            <div className="pt-6 border-t border-border-subtle relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
                AI Insight Engine
              </h4>
              {analysis.confidenceToApply && (
                <span className="text-xs font-medium text-text-muted bg-surface px-2 py-1 rounded-md border border-border-subtle">
                  Confidence: <span className="text-text-primary">{analysis.confidenceToApply}%</span>
                </span>
              )}
            </div>

            {analysis.methodologyRecommendations && analysis.methodologyRecommendations.length > 0 && (
              <div className="mb-4 p-4 bg-surface/80 border border-border-subtle/80 rounded-xl">
                <p className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3 flex items-center gap-2">
                  <Layers className="w-3 h-3" /> Methodology Recommendations
                </p>
                {analysis.methodologyRecommendations.map((r, i) => {
                  const vColor = r.verdict === "KEEP" ? "text-green-400" : r.verdict === "ADJUST" ? "text-yellow-400" : "text-red-400";
                  return (
                    <div key={i} className="flex items-start gap-2 text-sm text-text-secondary mb-2">
                      <span className={`font-semibold shrink-0 ${vColor}`}>{r.verdict}</span>
                      <span className="text-text-muted">{r.methodology}:</span>
                      <span>{r.reason}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-5 bg-surface/80 border border-border-subtle/80 rounded-xl">
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">{analysis.summary}</p>
              {analysis.strengths?.length > 0 && (
                <div className="mt-4 space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      <span className="text-text-secondary">{s}</span>
                    </div>
                  ))}
                </div>
              )}
              {analysis.weaknesses?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {analysis.weaknesses.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-4 h-4 text-red-400 mt-0.5 shrink-0 text-center">!</span>
                      <span className="text-text-secondary">{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {analysis.lessonsLearned?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <h5 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">Lessons</h5>
                  {analysis.lessonsLearned.map((l, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-text-muted mb-1">
                      <ChevronRight className="w-4 h-4 text-accent-gold mt-0.5 shrink-0" />
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Trade History */}
      <div className="bg-black/40 border border-accent-gold/20 rounded-lg overflow-hidden relative z-10">
        <button
          onClick={() => setShowTrades(!showTrades)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm text-text-primary hover:bg-bg-input transition"
        >
          <span>Trade History ({allTrades.length} trades)</span>
          <span className="text-text-muted">{showTrades ? "▲" : "▼"}</span>
        </button>
        {showTrades && (
          <div className="border-t border-border-subtle">
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted uppercase bg-black/60 sticky top-0 z-10">
                    <th className="text-left px-3 py-2">Symbol</th>
                    <th className="text-left px-3 py-2">Entry</th>
                    <th className="text-left px-3 py-2">Exit</th>
                    <th className="text-center px-3 py-2">Dir</th>
                    <th className="text-center px-3 py-2">Vol</th>
                    <th className="text-right px-3 py-2">Entry Px</th>
                    <th className="text-right px-3 py-2">Exit Px</th>
                    <th className="text-right px-3 py-2">PnL</th>
                    <th className="text-right px-3 py-2">R</th>
                    <th className="text-center px-3 py-2">Method</th>
                    <th className="text-center px-3 py-2">Reason</th>
                    <th className="text-center px-3 py-2">Conf</th>
                    <th className="text-left px-3 py-2">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {paginatedTrades.map((t, i) => (
                    <tr key={i} className="hover:bg-surface/30 transition-colors">
                      <td className="px-3 py-2 text-text-secondary font-mono text-[11px]">{t.symbol || "-"}</td>
                      <td className="px-3 py-2 text-text-secondary text-[11px]">{safeDateStr(t.entryTime)}</td>
                      <td className="px-3 py-2 text-text-secondary text-[11px]">{safeDateStr(t.exitTime)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${t.direction === "BUY" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {t.direction || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary font-mono">{(t as any).volume ? safeFixed((t as any).volume, 2) : "—"}</td>
                      <td className="px-3 py-2 text-right text-text-secondary font-mono">{safeFixed(t.entryPrice, 5)}</td>
                      <td className="px-3 py-2 text-right text-text-secondary font-mono">{safeFixed(t.exitPrice, 5)}</td>
                      <td className={`px-3 py-2 text-right font-medium font-mono ${safeNum(t.pnl) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        ${safeFixed(t.pnl, 2)}
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary font-mono">{(t as any).rr ? safeFixed((t as any).rr, 2) + "R" : "—"}</td>
                      <td className="px-3 py-2 text-center">{(t as any).primaryMethodology && <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-purple-500/10 text-purple-400">{(t as any).primaryMethodology}</span>}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${t.closeReason === "TP_HIT" ? "bg-green-500/10 text-green-400" : t.closeReason === "SL_HIT" ? "bg-red-500/10 text-red-400" : t.closeReason === "TRAILING_STOP" ? "bg-yellow-500/10 text-yellow-400" : "bg-gray-500/10 text-text-muted"}`}>
                          {(t as any).exitMethodology && (t as any).exitMethodology !== "Risk Management" ? `${(t as any).exitMethodology.toUpperCase()} ` : ""}{t.closeReason === "SL_HIT" && (t as any).trailingHistory?.length > 0 ? "TRAILING_STOP" : t.closeReason || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-text-secondary font-mono">{safeFixed(t.confidence, 0)}%</td>
                      <td className="px-3 py-2 text-left text-text-muted text-[10px] max-w-[100px] truncate" title={(t as any).comment || ""}>
                        {(t as any).comment || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalTradePages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-t border-border-subtle text-xs font-mono text-text-muted">
                <span>
                  Page {tradePage} of {totalTradePages} ({allTrades.length} trades total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTradePage((p) => Math.max(1, p - 1))}
                    disabled={tradePage === 1}
                    className="px-2.5 py-1 bg-surface border border-border-subtle rounded hover:bg-bg-input disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setTradePage((p) => Math.min(totalTradePages, p + 1))}
                    disabled={tradePage === totalTradePages}
                    className="px-2.5 py-1 bg-surface border border-border-subtle rounded hover:bg-bg-input disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  </div>
  );
}

// ============================================================================
// Replay Section - Replay backtest trades on historical price data
// ============================================================================

interface ReplaySectionProps {
  symbol: string;
  timeframe: "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";
  fromDate: string;
  toDate: string;
  trades: BacktestTrade[];
  equityCurve: Array<{ time: number; equity: number; floatingPnL?: number; openTrades?: number }>;
}

function ReplaySection({ symbol, timeframe, fromDate, toDate, trades, equityCurve }: ReplaySectionProps) {
  const { state, loadHistory, play, pause, stop, setSpeed, jumpTo, stepForward, stepBackward, progress } = useMarketReplay();
  const [showReplay, setShowReplay] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Convert trades to signals for TradingChart
  const signals = useMemo(() => {
    return trades.map(t => ({
      time: t.entryTime,
      type: (t.direction === "BUY" ? "buy" : "sell") as "buy" | "sell",
      price: t.entryPrice,
      label: t.direction === "BUY" ? "BUY" : "SELL",
    }));
  }, [trades]);

  const handleLoadReplay = useCallback(async () => {
    try {
      const from = new Date(fromDate).getTime() / 1000;
      const to = new Date(toDate).getTime() / 1000;
      await loadHistory(symbol, timeframe, from, to);
      setHistoryLoaded(true);
    } catch (err) {
      console.error("Failed to load replay history:", err);
    }
  }, [loadHistory, symbol, timeframe, fromDate, toDate]);

  if (!showReplay && !historyLoaded) {
    return (
      <div className="mt-6 border-t border-accent-gold/20 pt-6 relative z-10">
        <button
          onClick={() => setShowReplay(true)}
          className="flex items-center gap-2 w-full py-3 bg-black/30 border border-accent-gold/20 hover:bg-black/50 hover:border-accent-gold/40 rounded-xl text-text-primary transition-all font-mono text-sm"
        >
          <BarChart3 className="w-5 h-5 text-accent-gold" />
          <span className="font-medium">Load Market Replay</span>
          <span className="text-text-muted ml-auto">Replay {symbol} {timeframe} trades</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-accent-gold/20 pt-6 relative z-10 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-gold" />
          Market Replay - {symbol} {timeframe}
        </h4>
        <button
          onClick={() => setShowReplay(false)}
          className="text-xs text-text-muted hover:text-text-primary font-mono uppercase"
        >
          Hide Replay
        </button>
      </div>

      {!historyLoaded ? (
        <div className="bg-black/30 border border-accent-gold/10 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 text-center">
          <p className="text-text-muted">Click to load historical data from MT5 for replay</p>
          <button
            onClick={handleLoadReplay}
            className="px-6 py-2.5 bg-accent-gold/10 border border-accent-gold/40 text-accent-gold hover:bg-accent-gold/20 rounded-lg font-bold text-sm uppercase tracking-wider transition-all"
          >
            Load History from MT5
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <TradingChart
              candles={state.candles}
              currentIndex={state.currentIndex}
              totalCandles={state.totalCandles}
              isPlaying={state.isPlaying}
              speed={state.speed}
              symbol={symbol}
              timeframe={timeframe}
              signals={signals}
              height={400}
            />
          </div>
          <ReplayControls
            isPlaying={state.isPlaying}
            speed={state.speed}
            currentIndex={state.currentIndex}
            totalCandles={state.totalCandles}
            progress={progress}
            currentTime={state.currentIndex >= 0 ? state.candles[state.currentIndex]?.time ?? null : null}
            startTime={state.candles[0]?.time ?? null}
            endTime={state.candles[state.candles.length - 1]?.time ?? null}
            onPlay={play}
            onPause={pause}
            onStop={stop}
            onStepBack={stepBackward}
            onStepForward={stepForward}
            onSpeedChange={setSpeed}
            onJumpTo={jumpTo}
          />
        </>
      )}
    </div>
  );
}

export function BacktestResult(props: Props) {
  return (
    <BacktestResultErrorBoundary>
      <BacktestResultContent {...props} />
    </BacktestResultErrorBoundary>
  );
}
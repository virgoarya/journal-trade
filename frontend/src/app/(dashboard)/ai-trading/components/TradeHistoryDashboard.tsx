"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Percent,
  Award,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  Activity,
  RefreshCw,
  Target,
  Zap,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  aiTradingService,
  type PipelinePerformance as PipelinePerformanceData,
} from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";

// ─── Types & Constants ───────────────────────────────────

interface Props {
  triggerRefresh?: number;
}

interface MethodologyStat {
  methodology: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
  avgConfidence: number;
}

interface SymbolStat {
  symbol: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
}

const METHODOLOGY_COLORS: Record<string, string> = {
  smc: "#8B5CF6",
  ict: "#3B82F6",
  msnr: "#10B981",
  crt: "#F59E0B",
};

// ─── Helper Functions ─────────────────────────────────────

function formatCurrency(value: number): string {
  return `${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── Sub-Components ──────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  color = "text-white",
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-black/30 border border-accent-gold/10 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-accent-gold-dim text-[9px] uppercase tracking-wider font-mono">{label}</p>
          <p className={`text-lg font-bold font-mono mt-0.5 ${color}`}>{value}</p>
          {sub && <p className="text-[10px] text-text-muted mt-0.5 font-mono">{sub}</p>}
        </div>
        <Icon className="w-4 h-4 text-accent-gold-dim" />
      </div>
    </div>
  );
}

function WinLossBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  const winPercent = total > 0 ? (wins / total) * 100 : 50;

  return (
    <div className="space-y-1" role="meter" aria-valuenow={Math.round(winPercent)} aria-valuemin={0} aria-valuemax={100} aria-label={`Win rate: ${Math.round(winPercent)}%`}>
      <div className="flex justify-between text-[10px]">
        <span className="text-neon-green">{wins}W</span>
        <span className="text-text-muted">{Math.round(winPercent)}%</span>
        <span className="text-neon-red">{losses}L</span>
      </div>
      <div className="h-2 bg-black/60 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-neon-green transition-all duration-500"
          style={{ width: `${winPercent}%` }}
        />
        <div
          className="h-full bg-neon-red transition-all duration-500"
          style={{ width: `${100 - winPercent}%` }}
        />
      </div>
    </div>
  );
}

function MethodologyBreakdown({ stats }: { stats: MethodologyStat[] }) {
  const [isOpen, setIsOpen] = useState(true);

  if (stats.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-[10px] font-bold text-accent-gold-dim uppercase tracking-widest mb-2 font-mono"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5">
          <Layers className="w-3 h-3" />
          Methodology Performance
        </span>
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {isOpen && (
        <div className="space-y-2">
          {stats.map((stat) => {
            const color = METHODOLOGY_COLORS[stat.methodology] || "#D4AF37";
            return (
              <div key={stat.methodology} className="bg-black/30 border border-accent-gold/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold text-white uppercase">{stat.methodology}</span>
                  </div>
                  <span className={`text-xs font-bold font-mono ${stat.totalPnL >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                    {formatCurrency(stat.totalPnL)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                  <div>
                    <span className="text-text-muted">Trades:</span>{" "}
                    <span className="text-gray-300">{stat.totalTrades}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Win Rate:</span>{" "}
                    <span className={stat.winRate >= 50 ? "text-neon-green" : "text-neon-red"}>
                      {formatPercent(stat.winRate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Avg Conf:</span>{" "}
                    <span className="text-accent-gold">{stat.avgConfidence}%</span>
                  </div>
                </div>
                <WinLossBar wins={stat.winningTrades} losses={stat.losingTrades} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SymbolBreakdown({ stats }: { stats: SymbolStat[] }) {
  const [isOpen, setIsOpen] = useState(true);

  if (stats.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-[10px] font-bold text-accent-gold-dim uppercase tracking-widest mb-2 font-mono"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5">
          <Target className="w-3 h-3" />
          Symbol Performance
        </span>
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {isOpen && (
        <div className="space-y-2">
          {stats.map((stat) => (
            <div key={stat.symbol} className="bg-black/30 border border-accent-gold/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">{stat.symbol}</span>
                <span className={`text-xs font-bold font-mono ${stat.totalPnL >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                  {formatCurrency(stat.totalPnL)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                <div>
                  <span className="text-text-muted">Trades:</span>{" "}
                  <span className="text-gray-300">{stat.totalTrades}</span>
                </div>
                <div>
                  <span className="text-text-muted">Win Rate:</span>{" "}
                  <span className={stat.winRate >= 50 ? "text-neon-green" : "text-neon-red"}>
                    {formatPercent(stat.winRate)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">W/L:</span>{" "}
                  <span className="text-gray-300">{stat.winningTrades}/{stat.losingTrades}</span>
                </div>
              </div>
              <WinLossBar wins={stat.winningTrades} losses={stat.losingTrades} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────

export function TradeHistoryDashboard({ triggerRefresh }: Props) {
  const [data, setData] = useState<PipelinePerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiTradingService.getPerformance();
      if (res.success && res.data) setData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch, triggerRefresh]);

  const sortedMethodologyStats = useMemo(() => {
    if (!data?.methodologyStats?.length) return [];
    return [...data.methodologyStats].sort((a, b) => b.totalPnL - a.totalPnL);
  }, [data?.methodologyStats]);

  const sortedSymbolStats = useMemo(() => {
    if (!data?.symbolStats?.length) return [];
    return [...data.symbolStats].sort((a, b) => b.totalPnL - a.totalPnL);
  }, [data?.symbolStats]);

  if (loading) {
    return <SkeletonLoader type="card" />;
  }

  if (!data || data.totalTrades === 0) {
    return (
      <EmptyState
        type="data"
        title="No Trade Data"
        description="No trade history available yet. Start the pipeline to see analytics."
        actionText="Refresh"
        onAction={fetch}
      />
    );
  }

  const pnlColor = data.totalPnL >= 0 ? "text-neon-green" : "text-neon-red";
  const winRateColor = data.winRate >= 50 ? "text-neon-green" : "text-neon-red";

  // Calculate additional metrics
  const avgWin = data.winningTrades > 0 ? data.totalPnL / data.winningTrades : 0;
  const avgLoss = data.losingTrades > 0 ? Math.abs(data.totalPnL) / data.losingTrades : 0;
  const profitFactor = data.losingTrades > 0
    ? (data.winningTrades * avgWin) / (data.losingTrades * avgLoss)
    : data.winningTrades > 0
    ? Infinity
    : 0;

  return (
    <div className="glass p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-accent-gold flex items-center gap-2 drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          <Activity className="w-4 h-4" />
          Trade History Dashboard
        </h3>
        <button
          onClick={fetch}
          className="text-accent-gold-dim hover:text-accent-gold transition"
          title="Refresh"
          aria-label="Refresh trade history"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard
          icon={TrendingUp}
          label="Total PnL"
          value={formatCurrency(data.totalPnL)}
          color={pnlColor}
        />
        <MetricCard
          icon={BarChart3}
          label="Win Rate"
          value={formatPercent(data.winRate)}
          color={winRateColor}
          sub={`${data.winningTrades}/${data.totalTrades}`}
        />
        <MetricCard
          icon={Percent}
          label="Total Trades"
          value={`${data.totalTrades}`}
          color="text-text-primary"
        />
        <MetricCard
          icon={Award}
          label="Profit Factor"
          value={profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)}
          color={profitFactor >= 1 ? "text-neon-green" : "text-neon-red"}
        />
      </div>

      {/* Win/Loss Bar */}
      <div className="bg-black/30 border border-accent-gold/10 rounded-lg p-3">
        <p className="text-[9px] font-bold text-accent-gold-dim uppercase tracking-wider mb-2 font-mono">
          Win/Loss Distribution
        </p>
        <WinLossBar wins={data.winningTrades} losses={data.losingTrades} />
      </div>

      {/* Equity Curve */}
      {data.equityCurve.length > 1 && (
        <div className="bg-black/30 border border-accent-gold/10 rounded-lg p-3">
          <p className="text-[9px] font-bold text-accent-gold-dim uppercase tracking-wider mb-2 font-mono">
            Equity Curve
          </p>
          <div style={{ height: "120px", width: "100%", position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.equityCurve}>
                <defs>
                  <linearGradient id="tradeEquityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.1)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#8B7722", fontSize: 8 }} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tick={{ fill: "#8B7722", fontSize: 8 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={50} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid rgba(212,175,55,0.3)",
                    fontSize: "10px",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#D4AF37"
                  strokeWidth={1.5}
                  fill="url(#tradeEquityGrad)"
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Methodology Performance */}
      <MethodologyBreakdown stats={sortedMethodologyStats} />

      {/* Symbol Performance */}
      <SymbolBreakdown stats={sortedSymbolStats} />
    </div>
  );
}

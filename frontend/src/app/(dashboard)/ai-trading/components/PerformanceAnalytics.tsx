"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp,
  BarChart3,
  Percent,
  Award,
  ChevronDown,
  ChevronUp,
  Activity,
  RefreshCw,
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

interface ComparisonData {
  agent: {
    winRate: number;
    totalTrades: number;
    totalPnL: number;
  };
  llm: {
    winRate: number;
    totalTrades: number;
    totalPnL: number;
  };
}

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

function ComparisonBar({
  agentValue,
  llmValue,
  label,
}: {
  agentValue: number;
  llmValue: number;
  label: string;
}) {
  const max = Math.max(agentValue, llmValue, 1);
  const agentPercent = (agentValue / max) * 100;
  const llmPercent = (llmValue / max) * 100;

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-text-muted">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-accent-gold w-12">Agent</span>
          <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-gold rounded-full transition-all duration-500"
              style={{ width: `${agentPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-white w-12 text-right">{formatPercent(agentValue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted w-12">LLM</span>
          <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-500 rounded-full transition-all duration-500"
              style={{ width: `${llmPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted w-12 text-right">{formatPercent(llmValue)}</span>
        </div>
      </div>
    </div>
  );
}

function MethodologyComparison({ data }: { data: PipelinePerformanceData }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!data.methodologyStats?.length) return null;

  const sorted = [...data.methodologyStats].sort((a, b) => b.totalPnL - a.totalPnL);
  const best = sorted[0];

  return (
    <div className="border border-accent-gold/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 flex items-center gap-3 bg-black/20 hover:bg-black/30 transition-colors"
        aria-expanded={isOpen}
      >
        <Award className="w-4 h-4 text-accent-gold" />
        <span className="text-xs font-bold text-white">Best Methodology</span>
        {best && (
          <span className="ml-auto text-xs font-bold text-accent-gold uppercase">
            {best.methodology}
          </span>
        )}
        {isOpen ? <ChevronUp className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
      </button>
      {isOpen && (
        <div className="p-3 space-y-2">
          {best && (
            <div className="bg-accent-gold/10 border border-accent-gold/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-accent-gold" />
                <span className="text-xs font-bold text-accent-gold uppercase">{best.methodology}</span>
                <span className="ml-auto text-xs font-bold text-neon-green">
                  {formatCurrency(best.totalPnL)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <span className="text-text-muted">Trades:</span>{" "}
                  <span className="text-gray-300">{best.totalTrades}</span>
                </div>
                <div>
                  <span className="text-text-muted">Win Rate:</span>{" "}
                  <span className={best.winRate >= 50 ? "text-neon-green" : "text-neon-red"}>
                    {formatPercent(best.winRate)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Avg Conf:</span>{" "}
                  <span className="text-accent-gold">{best.avgConfidence}%</span>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-1">
            {sorted.map((stat) => (
              <div key={stat.methodology} className="flex items-center justify-between text-[10px]">
                <span className="text-gray-300 uppercase">{stat.methodology}</span>
                <span className={stat.totalPnL >= 0 ? "text-neon-green" : "text-neon-red"}>
                  {formatCurrency(stat.totalPnL)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────

export function PerformanceAnalytics({ triggerRefresh }: Props) {
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

  if (loading) {
    return <SkeletonLoader type="card" />;
  }

  if (!data || data.totalTrades === 0) {
    return (
      <EmptyState
        type="data"
        title="No Performance Data"
        description="No performance analytics available yet."
        actionText="Refresh"
        onAction={fetch}
      />
    );
  }

  const pnlColor = data.totalPnL >= 0 ? "text-neon-green" : "text-neon-red";
  const winRateColor = data.winRate >= 50 ? "text-neon-green" : "text-neon-red";

  // Mock LLM comparison data (will be replaced with real data when available)
  const llmComparison: ComparisonData = {
    agent: {
      winRate: data.winRate,
      totalTrades: data.totalTrades,
      totalPnL: data.totalPnL,
    },
    llm: {
      winRate: 55, // Placeholder — will be replaced with real LLM data
      totalTrades: data.totalTrades,
      totalPnL: data.totalPnL * 0.8, // Placeholder
    },
  };

  return (
    <div className="glass p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-accent-gold flex items-center gap-2 drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          <Activity className="w-4 h-4" />
          Performance Analytics
        </h3>
        <button
          onClick={fetch}
          className="text-accent-gold-dim hover:text-accent-gold transition"
          aria-label="Refresh performance analytics"
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
          label="Best Methodology"
          value={sortedMethodologyStats[0]?.methodology?.toUpperCase() || "—"}
          color="text-accent-gold"
        />
      </div>

      {/* Agent vs LLM Comparison */}
      <div className="bg-black/30 border border-accent-gold/10 rounded-lg p-3 space-y-3">
        <p className="text-[9px] font-bold text-accent-gold-dim uppercase tracking-wider font-mono">
          Agent vs LLM Consensus
        </p>
        <ComparisonBar
          agentValue={llmComparison.agent.winRate}
          llmValue={llmComparison.llm.winRate}
          label="Win Rate"
        />
        <ComparisonBar
          agentValue={llmComparison.agent.totalPnL}
          llmValue={llmComparison.llm.totalPnL}
          label="Total PnL ($)"
        />
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
                  <linearGradient id="perfEquityGrad" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#perfEquityGrad)"
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Best Methodology */}
      <MethodologyComparison data={data} />

      {/* Methodology Performance Table */}
      {sortedMethodologyStats.length > 0 && (
        <div className="bg-black/30 border border-accent-gold/10 rounded-lg p-3">
          <p className="text-[9px] font-bold text-accent-gold-dim uppercase tracking-wider mb-2 font-mono">
            Methodology Breakdown
          </p>
          <div className="space-y-2">
            {sortedMethodologyStats.map((stat) => (
              <div key={stat.methodology} className="flex items-center justify-between text-[10px]">
                <span className="text-gray-300 uppercase">{stat.methodology}</span>
                <div className="flex items-center gap-3">
                  <span className="text-text-muted">{stat.totalTrades} trades</span>
                  <span className={stat.winRate >= 50 ? "text-neon-green" : "text-neon-red"}>
                    {formatPercent(stat.winRate)}
                  </span>
                  <span className={stat.totalPnL >= 0 ? "text-neon-green" : "text-neon-red"}>
                    {formatCurrency(stat.totalPnL)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

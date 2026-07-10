"use client";

import { useState, useEffect, useCallback } from "react";
import {
  aiTradingService,
  type PipelinePerformance as PipelinePerformanceData,
} from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Percent,
  Award,
  Layers,
  Loader2,
  RefreshCw,
  Activity,
  Shield,
  ChevronDown,
  ChevronUp,
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
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">{label}</p>
          <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
          {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
    </div>
  );
}

export function PipelinePerformance() {
  const [data, setData] = useState<PipelinePerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMeth, setShowMeth] = useState(true);
  const [showSym, setShowSym] = useState(true);

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
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [fetch]);

  if (loading) {
    return <SkeletonLoader type="card" />;
  }

  if (!data || data.totalTrades === 0) {
    return (
      <EmptyState
        type="data"
        title="No Pipeline Data"
        description="No pipeline performance data available yet."
        actionText="Refresh"
        onAction={fetch}
      />
    );
  }

  const pnlColor = data.totalPnL >= 0 ? "text-green-400" : "text-red-400";
  const recoveryFactor = data.winningTrades > 0 && data.losingTrades > 0
    ? (data.totalPnL / Math.abs(data.losingTrades)).toFixed(2)
    : "∞";
  const bestMethodology = data.methodologyStats.length
    ? [...data.methodologyStats].sort((a, b) => b.totalPnL - a.totalPnL)[0]
    : null;
  const worstMethodology = data.methodologyStats.length
    ? [...data.methodologyStats].sort((a, b) => a.totalPnL - b.totalPnL)[0]
    : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-gold" />
          Pipeline Performance
        </h3>
        <button onClick={fetch} className="text-gray-500 hover:text-white transition" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard icon={TrendingUp} label="Total PnL" value={`${data.totalPnL >= 0 ? "+" : ""}$${data.totalPnL.toFixed(2)}`} color={pnlColor} />
        <MetricCard icon={BarChart3} label="Win Rate" value={`${data.winRate}%`} color={data.winRate >= 50 ? "text-green-400" : "text-red-400"} sub={`${data.winningTrades}/${data.totalTrades}`} />
        <MetricCard icon={Percent} label="Total Trades" value={`${data.totalTrades}`} color="text-white" />
        <MetricCard icon={Shield} label="Avg Conf" value={data.methodologyStats.length > 0 ? `${Math.round(data.methodologyStats.reduce((a, m) => a + m.avgConfidence, 0) / data.methodologyStats.length)}%` : "—"} color="text-white" />
      </div>

      {/* Equity Curve */}
      {data.equityCurve.length > 1 && (
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Equity Curve</p>
          <div style={{ height: "120px", width: "100%", position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.equityCurve}>
                <defs>
                  <linearGradient id="pipeEquityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 8 }} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 8 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={50} />
                <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", fontSize: "10px" }} />
                <Area type="monotone" dataKey="equity" stroke="#D4AF37" strokeWidth={1.5} fill="url(#pipeEquityGrad)" isAnimationActive={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Methodology Performance */}
      {data.methodologyStats.length > 0 && (
        <div>
          <button
            onClick={() => setShowMeth(!showMeth)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3 h-3" />
              Methodology Performance
            </span>
            {showMeth ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showMeth && (
            <div className="space-y-1.5">
              {data.methodologyStats.map((m) => {
                const isBest = bestMethodology && m.methodology === bestMethodology.methodology;
                const isWorst = worstMethodology && m.methodology === worstMethodology.methodology;
                const maxPnl = Math.max(...data.methodologyStats.map(x => Math.abs(x.totalPnL)), 1);
                const barPct = (Math.abs(m.totalPnL) / maxPnl) * 100;
                return (
                  <div key={m.methodology} className="bg-gray-800/40 rounded px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white capitalize">{m.methodology}</span>
                        {isBest && <span className="text-[8px] bg-green-500/20 text-green-400 px-1 rounded">BEST</span>}
                        {isWorst && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded">WORST</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{m.totalTrades} trades</span>
                        <span className="text-[10px] text-gray-400">{m.winRate}% WR</span>
                        <span className={`text-xs font-mono font-medium ${m.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {m.totalPnL >= 0 ? "+" : ""}${m.totalPnL.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${m.totalPnL >= 0 ? "bg-green-500/60" : "bg-red-500/60"}`} style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Symbol Stats */}
      {data.symbolStats.length > 0 && (
        <div>
          <button
            onClick={() => setShowSym(!showSym)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              Symbol Performance
            </span>
            {showSym ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showSym && (
            <div className="space-y-1.5">
              {data.symbolStats.map((s) => {
                const maxTrades = Math.max(...data.symbolStats.map(x => x.totalTrades), 1);
                const pct = (s.totalTrades / maxTrades) * 100;
                return (
                  <div key={s.symbol} className="bg-gray-800/40 rounded px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{s.symbol}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{s.totalTrades} trades</span>
                        <span className="text-[10px] text-gray-400">{s.winRate}% WR</span>
                        <span className={`text-xs font-mono font-medium ${s.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.totalPnL >= 0 ? "+" : ""}${s.totalPnL.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-accent-gold/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import {
  type BacktestResult as BacktestResultData,
  type BacktestAnalysis,
} from "@/services/backtest.service";
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
import { useState } from "react";

interface Props {
  result: BacktestResultData;
  analysis: BacktestAnalysis | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onApplyToPipeline: () => void;
  isApplying: boolean;
}

function MetricCard({ icon: Icon, label, value, color = "text-white", sub }: {
  icon: React.ElementType; label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div className="bg-gray-950/50 border border-gray-800/60 p-4 rounded-xl flex flex-col items-center justify-center text-center transition hover:border-gray-700">
      <Icon className={`w-5 h-5 ${color.includes("text-") ? color : "text-gray-400"} mb-3`} />
      <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-semibold mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export function BacktestResult({ result, analysis, isAnalyzing, onAnalyze, onApplyToPipeline, isApplying }: Props) {
  const [showTrades, setShowTrades] = useState(false);
  if (!result) return null;

  const isProfitable = result.totalPnL >= 0;
  const recoveryFactor = result.recoveryFactor ?? (result.maxDrawdown > 0 ? result.totalPnL / result.maxDrawdown : result.totalPnL > 0 ? Infinity : 0);
  const recoveryColor = recoveryFactor === Infinity ? "text-green-400" : recoveryFactor >= 3 ? "text-green-400" : recoveryFactor >= 1.5 ? "text-yellow-400" : "text-red-400";
  const bestSymbol = result.symbolStats?.length ? [...result.symbolStats].sort((a, b) => b.totalPnL - a.totalPnL)[0] : null;
  const worstSymbol = result.symbolStats?.length ? [...result.symbolStats].sort((a, b) => a.totalPnL - b.totalPnL)[0] : null;

  const chartData = result.equityCurve?.map((p) => ({ time: new Date(p.time * 1000).toLocaleDateString(), equity: p.equity })) || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
      <div className={`absolute -top-32 -left-32 w-64 h-64 rounded-full blur-3xl pointer-events-none ${isProfitable ? "bg-green-500/10" : "bg-red-500/10"}`} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/60 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/50"><BarChart3 className="w-5 h-5 text-accent-gold" /></div>
          <div>
            <h3 className="text-lg font-semibold text-white tracking-wide">Simulation Results</h3>
            <p className="text-xs text-gray-500 mt-0.5">{(result.symbols || [result.symbol]).join(", ")} · {result.timeframe} · {result.totalCandles} candles</p>
          </div>
        </div>
        {result.backtestId && <div className="text-xs font-mono text-gray-500 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800">ID: {result.backtestId.substring(0, 8)}</div>}
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <MetricCard icon={Activity} label="Total Trades" value={`${result.totalTrades}`} />
        <MetricCard icon={Target} label="Win Rate" value={`${result.winRate}%`} color={result.winRate >= 50 ? "text-green-400" : "text-red-400"} sub={`${result.winningTrades}W / ${result.losingTrades}L`} />
        <MetricCard icon={isProfitable ? TrendingUp : TrendingDown} label="Net PnL" value={`${isProfitable ? "+" : ""}${result.totalPnLPercent}%`} color={isProfitable ? "text-green-400" : "text-red-400"} sub={`$${result.totalPnL.toFixed(2)}`} />
        <MetricCard icon={TrendingDown} label="Max DD" value={`${result.maxDrawdownPercent}%`} color={result.maxDrawdownPercent < 10 ? "text-green-400" : result.maxDrawdownPercent < 20 ? "text-yellow-400" : "text-red-400"} />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 relative z-10">
        <MetricCard icon={Shield} label="Recovery Factor" value={recoveryFactor === Infinity ? "∞" : recoveryFactor.toFixed(2)} color={recoveryColor} />
        <MetricCard icon={Award} label="Profit Factor" value={result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)} color={result.profitFactor >= 1.5 ? "text-green-400" : result.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"} />
        <MetricCard icon={Activity} label="Avg Win" value={`$${result.averageWin.toFixed(2)}`} color="text-green-400" />
        <MetricCard icon={Activity} label="Avg Loss" value={`$${result.averageLoss.toFixed(2)}`} color="text-red-400" />
        <MetricCard icon={Percent} label="Sharpe" value={result.sharpeRatio.toFixed(2)} color={result.sharpeRatio >= 1 ? "text-green-400" : "text-gray-300"} />
      </div>

      {/* Equity Curve */}
      {chartData.length > 1 && (
        <div className="bg-gray-950/50 border border-gray-800/60 rounded-xl p-4 relative z-10">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Equity Curve</p>
          <div style={{ height: "200px", width: "100%", position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs><linearGradient id="btEqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} /><stop offset="95%" stopColor="#D4AF37" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={60} />
                <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", fontSize: "10px" }} />
                <Area type="monotone" dataKey="equity" stroke="#D4AF37" strokeWidth={2} fill="url(#btEqGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── SYMBOL PERFORMANCE (di bawah equity curve) ── */}
      {result.symbolStats && result.symbolStats.length > 0 && (
        <div className="space-y-4 relative z-10">
          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-gold" />
            Symbol Performance
          </h4>
          <div className="bg-gray-950/80 border border-gray-800/80 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium text-center">Trades</th>
                  <th className="px-4 py-3 font-medium text-center">Win %</th>
                  <th className="px-4 py-3 font-medium text-center">W/L/BE</th>
                  <th className="px-4 py-3 font-medium text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {result.symbolStats.map((stat, i) => (
                  <tr key={i} className="hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                      {stat.symbol}
                      {bestSymbol && stat.symbol === bestSymbol.symbol && stat.totalPnL > 0 && <span className="text-[8px] bg-green-500/20 text-green-400 px-1 rounded">BEST</span>}
                      {worstSymbol && stat.symbol === worstSymbol.symbol && stat.totalPnL < 0 && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded">WORST</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{stat.totalTrades}</td>
                    <td className="px-4 py-3 text-center font-mono">{stat.winRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      <span className="text-green-400">{stat.winningTrades}W</span>
                      <span className="text-gray-500"> / </span>
                      <span className="text-red-400">{stat.losingTrades}L</span>
                      {(stat as any).breakEvenTrades > 0 && <span className="text-gray-500"> / {(stat as any).breakEvenTrades}BE</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${stat.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {stat.totalPnL >= 0 ? "+" : ""}${stat.totalPnL.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── METHODOLOGY PERFORMANCE — 7 METODOLOGI TETAP ── */}
      <div className="space-y-4 pt-6 border-t border-gray-800/60 relative z-10">
        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-accent-gold" />
          Methodology Performance
        </h4>
        <div className="bg-gray-950/80 border border-gray-800/80 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900/50 text-xs uppercase text-gray-500 border-b border-gray-800">
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
                const bestStat = allStats.length ? [...allStats].sort((a: any, b: any) => b.totalPnL - a.totalPnL)[0] : null;
                const worstStat = allStats.length ? [...allStats].sort((a: any, b: any) => a.totalPnL - b.totalPnL)[0] : null;
                const isBest = bestStat?.methodology === meth.methodology && meth.totalPnL > 0;
                const isWorst = worstStat?.methodology === meth.methodology && meth.totalPnL < 0;
                return (
                  <tr key={idx} className="hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2 capitalize">
                      {meth.methodology === "rsiEngulf" ? "RSI+Engulf" : meth.methodology}
                      {isBest && <span className="text-[8px] bg-green-500/20 text-green-400 px-1 rounded">BEST</span>}
                      {isWorst && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded">WORST</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{meth.totalTrades}</td>
                    <td className="px-4 py-3 text-center font-mono">{meth.winRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      <span className="text-green-400">{meth.winningTrades}W</span>
                      <span className="text-gray-500"> / </span>
                      <span className="text-red-400">{meth.losingTrades}L</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${meth.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {meth.totalPnL >= 0 ? "+" : ""}${meth.totalPnL.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">{meth.avgConfidence}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 relative z-10">
        <button onClick={onAnalyze} disabled={isAnalyzing || !result.backtestId}
          className="flex-1 py-3 px-4 bg-gray-950 border border-blue-900/40 text-blue-400 hover:bg-blue-950/50 hover:border-blue-800/60 font-medium rounded-xl flex justify-center items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
          <span>{isAnalyzing ? "Analyzing..." : "Run AI Analysis"}</span>
        </button>
        <button onClick={onApplyToPipeline} disabled={isApplying || !result.backtestId}
          className="flex-1 py-3 px-4 bg-accent-gold text-black border border-accent-gold hover:bg-accent-gold/90 font-semibold rounded-xl flex justify-center items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]">
          {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          <span>Apply to Live Pipeline</span>
        </button>
      </div>

      {/* AI Analysis */}
      {isAnalyzing && (
        <div className="flex items-center justify-center py-8 relative z-10">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="ml-2 text-sm text-gray-400">Analyzing backtest patterns...</span>
        </div>
      )}

      {analysis && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="pt-6 border-t border-gray-800/60 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              AI Insight Engine
            </h4>
            {analysis.confidenceToApply && (
              <span className="text-xs font-medium text-gray-400 bg-gray-950 px-2 py-1 rounded-md border border-gray-800">
                Confidence: <span className="text-white">{analysis.confidenceToApply}%</span>
              </span>
            )}
          </div>

          {analysis.methodologyRecommendations && analysis.methodologyRecommendations.length > 0 && (
            <div className="mb-4 p-4 bg-gray-950/80 border border-gray-800/80 rounded-xl">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-2"><Layers className="w-3 h-3" /> Methodology Recommendations</p>
              {analysis.methodologyRecommendations.map((r, i) => {
                const vColor = r.verdict === "KEEP" ? "text-green-400" : r.verdict === "ADJUST" ? "text-yellow-400" : "text-red-400";
                return (<div key={i} className="flex items-start gap-2 text-sm text-gray-300 mb-2">
                  <span className={`font-semibold shrink-0 ${vColor}`}>{r.verdict}</span>
                  <span className="text-gray-400">{r.methodology}:</span>
                  <span>{r.reason}</span>
                </div>);
              })}
            </div>
          )}

          <div className="p-5 bg-gray-950/80 border border-gray-800/80 rounded-xl">
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">{analysis.summary}</p>
            {analysis.strengths?.length > 0 && (<div className="mt-4 space-y-1">
              {analysis.strengths.map((s, i) => <div key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /><span className="text-gray-300">{s}</span></div>)}
            </div>)}
            {analysis.weaknesses?.length > 0 && (<div className="mt-3 space-y-1">
              {analysis.weaknesses.map((w, i) => <div key={i} className="flex items-start gap-2 text-sm"><span className="w-4 h-4 text-red-400 mt-0.5 shrink-0 text-center">!</span><span className="text-gray-300">{w}</span></div>)}
            </div>)}
            {analysis.lessonsLearned?.length > 0 && (<div className="mt-4 pt-4 border-t border-gray-800/50">
              <h5 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Lessons</h5>
              {analysis.lessonsLearned.map((l, i) => <div key={i} className="flex items-start gap-2 text-sm text-gray-400 mb-1"><ChevronRight className="w-4 h-4 text-accent-gold mt-0.5 shrink-0" /><span>{l}</span></div>)}
            </div>)}
          </div>
        </motion.div>
      )}

      {/* Trade History */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden relative z-10">
        <button onClick={() => setShowTrades(!showTrades)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm text-white hover:bg-gray-800/50 transition">
          <span>Trade History ({result.trades.length} trades)</span>
          <span className="text-gray-400">{showTrades ? "▲" : "▼"}</span>
        </button>
        {showTrades && (
          <div className="overflow-x-auto max-h-72 overflow-y-auto border-t border-gray-800">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 uppercase">
                <th className="text-left px-3 py-2">Symbol</th>
                <th className="text-left px-3 py-2">Entry</th>
                <th className="text-left px-3 py-2">Exit</th>
                <th className="text-center px-3 py-2">Dir</th>
                <th className="text-right px-3 py-2">Entry</th>
                <th className="text-right px-3 py-2">Exit</th>
                <th className="text-right px-3 py-2">PnL</th>
                <th className="text-center px-3 py-2">Method</th>
                <th className="text-center px-3 py-2">Reason</th>
                <th className="text-center px-3 py-2">Conf</th>
                <th className="text-left px-3 py-2">Comment</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {result.trades.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-gray-400 font-mono">{(t as any).symbol || "-"}</td>
                    <td className="px-3 py-2 text-gray-300">{new Date(t.entryTime * 1000).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-gray-300">{new Date(t.exitTime * 1000).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-center"><span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${t.direction === "BUY" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{t.direction}</span></td>
                    <td className="px-3 py-2 text-right text-gray-300">{t.entryPrice.toFixed(5)}</td>
                    <td className="px-3 py-2 text-right text-gray-300">{t.exitPrice.toFixed(5)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>${t.pnl.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">{(t as any).primaryMethodology && <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-purple-500/10 text-purple-400">{(t as any).primaryMethodology}</span>}</td>
                    <td className="px-3 py-2 text-center"><span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${t.closeReason === "TP_HIT" ? "bg-green-500/10 text-green-400" : t.closeReason === "SL_HIT" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"}`}>{t.closeReason}</span></td>
                    <td className="px-3 py-2 text-center text-gray-300">{t.confidence}%</td>
                    <td className="px-3 py-2 text-left text-gray-500 text-[10px] max-w-[100px] truncate" title={(t as any).comment || ""}>{(t as any).comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}

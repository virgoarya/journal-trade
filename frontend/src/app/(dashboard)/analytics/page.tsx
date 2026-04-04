"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Calendar, DollarSign, Percent, Target, Activity, Award, Loader2 } from "lucide-react";
import { analyticsService, type AnalyticsData } from "@/services/analytics.service";
import { Heatmap } from "@/components/analytics/Heatmap";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<string>("6M");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await analyticsService.getOverview(timeRange);
        if (result.success && result.data) {
          // Merge with defaults to ensure all fields exist
          const data = result.data;
          data.monthlyPnL = data.monthlyPnL || [];
          data.weeklyStats = data.weeklyStats || [];
          data.sessionPerformance = data.sessionPerformance || [];
          data.heatmap = data.heatmap || [];
          data.streakStats = data.streakStats || { longestWin: 0, longestLoss: 0, currentStreak: { type: "win" as const, count: 0 }, avgConsecutiveWins: 0, avgConsecutiveLosses: 0 };
          data.bestPerformingPairs = data.bestPerformingPairs || [];
          data.riskMetrics = data.riskMetrics || { sharpeRatio: 0, maxDrawdown: 0, avgRR: 0, expectancy: 0 };
          data.tradingBehaviour = data.tradingBehaviour || { avgTradeDuration: "0h 0m", avgPnlPerTrade: 0, tradesPerDay: 0, planAdherence: 0 };
          data.totalPnL = data.totalPnL ?? 0;
          data.totalTrades = data.totalTrades ?? 0;
          data.winRate = data.winRate ?? 0;
          data.profitFactor = data.profitFactor ?? 0;
          setAnalytics(data as AnalyticsData);
        } else {
          setError(result.error || "Failed to load analytics");
        }
      } catch (err: any) {
        setError(err.message || "Network error");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  const refreshData = async () => {
    const result = await analyticsService.getOverview(timeRange);
    if (result.success && result.data) {
      setAnalytics(result.data);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-accent-gold animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-data-loss font-medium mb-2">Error loading analytics</p>
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <button onClick={refreshData} className="btn-gold">Retry</button>
        </div>
      </div>
    );
  }

  const displayData = analytics || {
    monthlyPnL: [],
    weeklyStats: [],
    sessionPerformance: [],
    heatmap: [],
    streakStats: { longestWin: 0, longestLoss: 0, currentStreak: { type: "win" as const, count: 0 }, avgConsecutiveWins: 0, avgConsecutiveLosses: 0 },
    totalPnL: 0,
    totalTrades: 0,
    winRate: 0,
    profitFactor: 0,
    bestPerformingPairs: [],
    riskMetrics: { sharpeRatio: 0, maxDrawdown: 0, avgRR: 0, expectancy: 0 },
    tradingBehaviour: { avgTradeDuration: "0h 0m", avgPnlPerTrade: 0, tradesPerDay: 0, planAdherence: 0 }
  };

  const SimpleBarChart = ({ data, valueKey, color }: { data: any[], valueKey: string, color: string }) => {
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-text-muted text-sm uppercase tracking-widest font-mono opacity-30">No Data Flowing</div>;
    const max = Math.max(...data.map(d => Math.abs(d[valueKey])));
    return (
      <div className="flex items-end justify-between h-48 gap-4 px-2 relative">
        {/* Background Grid Lines (Subtle) */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-5">
           <div className="w-full border-t border-white" />
           <div className="w-full border-t border-white" />
           <div className="w-full border-t border-white" />
        </div>

        {data.map((item, idx) => {
          const val = item[valueKey];
          const height = max > 0 ? (Math.abs(val) / max) * 100 : 0;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center group relative z-10">
              <div
                className="w-full rounded-t-sm transition-all duration-500 group-hover:brightness-125 group-hover:shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                style={{
                  height: `${height}%`,
                  backgroundColor: val >= 0 ? color : '#FF1744',
                  minHeight: Math.abs(val) > 0 ? '4px' : '0',
                }}
              >
                 {/* Detail Popup on Hover */}
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-bg-surface border border-accent-gold/20 px-2 py-1 rounded text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-20 shadow-xl font-mono">
                    ${val.toLocaleString()}
                 </div>
              </div>
              <span className="text-[10px] font-mono text-text-muted mt-2 group-hover:text-accent-gold transition-colors">{item.month || item.day || item.session}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Analytics</h1>
          <p className="text-sm text-text-secondary mt-1">Deep insights into your trading performance</p>
        </div>
        <div className="flex space-x-2">
          {["1M", "3M", "6M", "1Y", "ALL"].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] rounded transition-all ${
                timeRange === range
                  ? "bg-accent-gold text-bg-void"
                  : "bg-bg-elevated text-text-secondary hover:text-accent-gold"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 border-b-2 border-accent-gold/20">
          <div className="flex items-center text-text-secondary mb-2">
            <DollarSign className="w-4 h-4 mr-2 text-accent-gold" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Total P&L</span>
          </div>
          <p className={`font-mono text-xl font-bold ${displayData.totalPnL >= 0 ? "text-data-profit" : "text-data-loss"}`}>
            {displayData.totalPnL >= 0 ? "+" : ""}${displayData.totalPnL.toLocaleString()}
          </p>
        </div>
        <div className="glass p-4 border-b-2 border-accent-gold/20">
          <div className="flex items-center text-text-secondary mb-2">
            <Percent className="w-4 h-4 mr-2 text-accent-gold" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Win Rate</span>
          </div>
          <p className="font-mono text-xl font-bold text-data-profit">{displayData.winRate.toFixed(1)}%</p>
        </div>
        <div className="glass p-4 border-b-2 border-accent-gold/20">
          <div className="flex items-center text-text-secondary mb-2">
            <Activity className="w-4 h-4 mr-2 text-accent-gold" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Profit Factor</span>
          </div>
          <p className="font-mono text-xl font-bold text-accent-gold">{displayData.profitFactor.toFixed(2)}</p>
        </div>
        <div className="glass p-4 border-b-2 border-accent-gold/20">
          <div className="flex items-center text-text-secondary mb-2">
            <Target className="w-4 h-4 mr-2 text-accent-gold" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Total Trades</span>
          </div>
          <p className="font-mono text-xl font-bold text-text-primary">{displayData.totalTrades}</p>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly P&L Chart */}
        <div className="glass p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-text-primary">Monthly P&L (Last 6M)</h3>
            <BarChart3 className="w-4 h-4 text-text-muted" />
          </div>
          <SimpleBarChart data={displayData.monthlyPnL} valueKey="pnl" color="#D4AF37" />
          <div className="flex justify-between mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center text-data-profit text-[10px] font-mono tracking-wider">
              <TrendingUp className="w-3 h-3 mr-1" />
              WINS: {displayData.monthlyPnL.reduce((sum, m) => sum + m.wins, 0)}
            </div>
            <div className="flex items-center text-data-loss text-[10px] font-mono tracking-wider">
              <TrendingDown className="w-3 h-3 mr-1" />
              LOSSES: {displayData.monthlyPnL.reduce((sum, m) => sum + m.losses, 0)}
            </div>
          </div>
        </div>

        {/* Weekly Performance */}
        <div className="glass p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-text-primary">Weekly Performance</h3>
            <Calendar className="w-4 h-4 text-text-muted" />
          </div>
          <SimpleBarChart data={displayData.weeklyStats.filter(d => d.trades > 0)} valueKey="avgPnl" color="#D4AF37" />
          <p className="text-[10px] text-text-muted italic mt-4 text-center font-mono opacity-50 uppercase tracking-widest">Average P&L by Weekday (Absolute USD)</p>
        </div>

        {/* New Real Heatmap Component */}
        <div className="glass p-6 lg:col-span-2">
           <div className="flex justify-between items-center mb-10">
              <div className="flex items-center space-x-3">
                 <div className="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                   <Activity className="w-4 h-4 text-accent-gold" />
                 </div>
                 <h3 className="font-bold text-text-primary tracking-wide">Performance Heatmap (Session vs Day)</h3>
              </div>
              <div className="flex items-center gap-2">
                 <span className="px-3 py-1 rounded bg-bg-elevated border border-white/5 text-[9px] font-bold text-text-muted tracking-[0.2em] uppercase">Real-Time Data Flow</span>
              </div>
           </div>
           
           <Heatmap data={displayData.heatmap} />
        </div>

        {/* Session Performance Detail */}
        <div className="glass p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-text-primary">Session Alpha</h3>
            <Calendar className="w-4 h-4 text-text-muted" />
          </div>
          <div className="space-y-6">
            {displayData.sessionPerformance.map((session) => {
              const maxPnl = Math.max(...displayData.sessionPerformance.map(s => Math.abs(s.pnl)));
              const barWidth = maxPnl > 0 ? (Math.abs(session.pnl) / maxPnl) * 100 : 0;
              
              return (
                <div key={session.session} className="flex items-center">
                  <div className="w-24 text-[10px] font-bold text-accent-gold uppercase tracking-widest">{session.session}</div>
                  <div className="flex-1 bg-bg-void/50 rounded-full h-1.5 overflow-hidden mx-4 border border-white/5">
                    <div
                      className="h-full bg-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.4)] transition-all duration-1000"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="w-24 text-right">
                    <span className={`font-mono text-sm font-bold ${session.pnl >= 0 ? "text-data-profit" : "text-data-loss"}`}>
                      {session.pnl >= 0 ? "+" : ""}${session.pnl.toLocaleString()}
                    </span>
                    <div className="text-[9px] text-text-muted uppercase tracking-tighter">{session.trades} Executions</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak Stats */}
        <div className="glass p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-text-primary">Psychological Momentum</h3>
            <Award className="w-4 h-4 text-text-muted" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-bg-void/50 rounded-lg text-center border border-white/5 hover:border-accent-gold/20 transition-all">
              <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2 font-bold">Longest Win Chain</p>
              <p className="font-mono text-3xl font-bold text-data-profit">{displayData.streakStats.longestWin}</p>
            </div>
            <div className="p-4 bg-bg-void/50 rounded-lg text-center border border-white/5 hover:border-accent-gold/20 transition-all">
              <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2 font-bold">Longest Value Drawdown</p>
              <p className="font-mono text-3xl font-bold text-data-loss">{displayData.streakStats.longestLoss}</p>
            </div>
            <div className="p-4 bg-accent-gold/5 rounded-lg text-center border border-accent-gold/10 flex flex-col justify-center items-center">
              <p className="text-[9px] text-accent-gold uppercase tracking-widest mb-2 font-bold">Current Cycle</p>
              <div className="flex items-center justify-center space-x-2">
                {displayData.streakStats.currentStreak.type === "win" ? (
                  <TrendingUp className="w-5 h-5 text-data-profit" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-data-loss" />
                )}
                <span className={`font-mono text-xl font-bold ${displayData.streakStats.currentStreak.type === "win" ? "text-data-profit" : "text-data-loss"}`}>
                  {displayData.streakStats.currentStreak.count} {displayData.streakStats.currentStreak.type.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="p-4 bg-bg-void/50 rounded-lg text-center border border-white/5">
              <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2 font-bold">Avg Consistency</p>
              <p className="font-mono text-2xl font-bold text-accent-gold">{displayData.streakStats.avgConsecutiveWins.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass p-6 border-t border-accent-gold/20">
          <h3 className="font-bold text-text-primary mb-6 flex items-center tracking-widest uppercase text-xs">
            <Target className="w-4 h-4 mr-2 text-accent-gold" />
            Alpha Assets
          </h3>
          <div className="space-y-4">
            {displayData.bestPerformingPairs.length > 0 ? (
              displayData.bestPerformingPairs.map((item) => (
                <div key={item.pair} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                  <div>
                    <p className="font-mono font-bold text-text-primary">{item.pair}</p>
                    <p className="text-[9px] text-text-muted uppercase tracking-tighter">{item.winRate.toFixed(0)}% strike rate</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-data-profit">+${item.pnl.toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-text-muted italic uppercase text-center py-4">No Asset Discovery Yet</p>
            )}
          </div>
        </div>

        <div className="glass p-6 border-t border-accent-gold/20">
          <h3 className="font-bold text-text-primary mb-6 flex items-center tracking-widest uppercase text-xs">
            <TrendingUp className="w-4 h-4 mr-2 text-accent-gold" />
            Risk Metrics
          </h3>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-[10px] mb-2 uppercase font-bold tracking-widest">
                <span className="text-text-secondary">Sharpe Efficiency</span>
                <span className="font-mono text-accent-gold">{displayData.riskMetrics.sharpeRatio.toFixed(2)}</span>
              </div>
              <div className="w-full h-1 bg-bg-void rounded-full overflow-hidden">
                <div className="h-full bg-accent-gold" style={{ width: `${Math.min(displayData.riskMetrics.sharpeRatio * 50, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-2 uppercase font-bold tracking-widest">
                <span className="text-text-secondary">Measured Drawdown</span>
                <span className="font-mono text-data-loss">{displayData.riskMetrics.maxDrawdown.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1 bg-bg-void rounded-full overflow-hidden">
                <div className="h-full bg-data-loss" style={{ width: `${Math.min(displayData.riskMetrics.maxDrawdown * 10, 100)}%` }}></div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
               <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Profit Expectancy</span>
               <span className="font-mono text-lg font-bold text-data-profit">${displayData.riskMetrics.expectancy.toFixed(0)}</span>
            </div>
          </div>
        </div>

        <div className="glass p-6 border-t border-accent-gold/20">
          <h3 className="font-bold text-text-primary mb-6 flex items-center tracking-widest uppercase text-xs">
            <Activity className="w-4 h-4 mr-2 text-accent-gold" />
            Behavioural Analytics
          </h3>
          <div className="space-y-4 font-mono">
            <div className="flex items-center justify-between p-2 border-b border-white/5">
              <span className="text-[9px] text-text-secondary uppercase tracking-widest">Avg Exposure Time</span>
              <span className="text-xs text-text-primary">{displayData.tradingBehaviour.avgTradeDuration}</span>
            </div>
            <div className="flex items-center justify-between p-2 border-b border-white/5">
              <span className="text-[9px] text-text-secondary uppercase tracking-widest">Alpha Per Exec</span>
              <span className="text-xs text-data-profit">${displayData.tradingBehaviour.avgPnlPerTrade.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between p-2 border-b border-white/5">
              <span className="text-[9px] text-text-secondary uppercase tracking-widest">Daily Velocity</span>
              <span className="text-xs text-text-primary">{displayData.tradingBehaviour.tradesPerDay.toFixed(1)} <span className="text-[8px] opacity-50">T/D</span></span>
            </div>
            <div className="flex items-center justify-between p-2">
              <span className="text-[9px] text-accent-gold uppercase tracking-widest font-bold">Rule Compliance</span>
              <span className="text-xs text-accent-gold font-bold">{displayData.tradingBehaviour.planAdherence.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
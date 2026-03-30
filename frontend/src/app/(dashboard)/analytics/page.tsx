"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Calendar, DollarSign, Percent, Target, Activity, Award, Loader2 } from "lucide-react";
import { analyticsService, type AnalyticsData } from "@/services/analytics.service";

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
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-text-muted text-sm">No data</div>;
    const max = Math.max(...data.map(d => d[valueKey]));
    return (
      <div className="flex items-end justify-between h-48 gap-2 px-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center group">
            <div
              className="w-full rounded-t-sm transition-all group-hover:brightness-110"
              style={{
                height: `${max > 0 ? (item[valueKey] / max) * 100 : 0}%`,
                backgroundColor: color,
                minHeight: item[valueKey] > 0 ? '4px' : '0',
              }}
            />
            <span className="text-[10px] text-text-muted mt-2">{item.month || item.day || item.session}</span>
          </div>
        ))}
      </div>
    );
  };

  const CalendarHeatmap = () => {
    const days = Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      intensity: Math.random() > 0.7 ? "high" : Math.random() > 0.4 ? "medium" : "low"
    }));

    return (
      <div className="grid grid-cols-7 gap-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
          <div key={idx} className="text-center text-[9px] text-text-muted uppercase mb-1">{day}</div>
        ))}
        {days.map((day, idx) => (
          <div
            key={idx}
            className={`aspect-square rounded-sm transition-transform hover:scale-110 cursor-pointer ${
              day.intensity === "high"
                ? "bg-data-profit/80"
                : day.intensity === "medium"
                ? "bg-data-profit/40"
                : "bg-bg-elevated border border-border-subtle"
            }`}
            title={`Day ${day.day}: ${day.intensity === "high" ? "High P&L" : day.intensity === "medium" ? "Medium P&L" : "Low/Breakeven"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Analitik</h1>
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
        <div className="glass p-4">
          <div className="flex items-center text-text-secondary mb-2">
            <DollarSign className="w-4 h-4 mr-2" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Total P&L</span>
          </div>
          <p className={`font-mono text-xl font-bold ${displayData.totalPnL >= 0 ? "text-data-profit" : "text-data-loss"}`}>
            {displayData.totalPnL >= 0 ? "+" : ""}${displayData.totalPnL.toLocaleString()}
          </p>
        </div>
        <div className="glass p-4">
          <div className="flex items-center text-text-secondary mb-2">
            <Percent className="w-4 h-4 mr-2" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Win Rate</span>
          </div>
          <p className="font-mono text-xl font-bold text-data-profit">{displayData.winRate.toFixed(1)}%</p>
        </div>
        <div className="glass p-4">
          <div className="flex items-center text-text-secondary mb-2">
            <Activity className="w-4 h-4 mr-2" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Profit Factor</span>
          </div>
          <p className="font-mono text-xl font-bold text-accent-gold">{displayData.profitFactor.toFixed(2)}</p>
        </div>
        <div className="glass p-4">
          <div className="flex items-center text-text-secondary mb-2">
            <Target className="w-4 h-4 mr-2" />
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
            <h3 className="font-semibold text-text-primary">Monthly P&L</h3>
            <BarChart3 className="w-4 h-4 text-text-muted" />
          </div>
          <SimpleBarChart data={displayData.monthlyPnL} valueKey="pnl" color={displayData.totalPnL >= 0 ? "#00E676" : "#FF1744"} />
          <div className="flex justify-between mt-4 pt-4 border-t border-white/10">
            {displayData.monthlyPnL.reduce((sum, m) => sum + m.wins, 0) > 0 && (
              <div className="flex items-center text-data-profit text-[11px]">
                <TrendingUp className="w-3 h-3 mr-1" />
                Wins: {displayData.monthlyPnL.reduce((sum, m) => sum + m.wins, 0)}
              </div>
            )}
            {displayData.monthlyPnL.reduce((sum, m) => sum + m.losses, 0) > 0 && (
              <div className="flex items-center text-data-loss text-[11px]">
                <TrendingDown className="w-3 h-3 mr-1" />
                Losses: {displayData.monthlyPnL.reduce((sum, m) => sum + m.losses, 0)}
              </div>
            )}
          </div>
        </div>

        {/* Weekly Performance */}
        <div className="glass p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-text-primary">Weekly Pattern</h3>
            <Calendar className="w-4 h-4 text-text-muted" />
          </div>
          <SimpleBarChart data={displayData.weeklyStats.filter(d => d.trades > 0)} valueKey="avgPnl" color="#D4AF37" />
          <p className="text-[10px] text-text-muted italic mt-4 text-center">Average P&L by weekday (USD)</p>
        </div>

        {/* Session Performance */}
        <div className="glass p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-text-primary">Session Distribution</h3>
            <Calendar className="w-4 h-4 text-text-muted" />
          </div>
          <div className="space-y-4">
            {displayData.sessionPerformance.map((session) => (
              <div key={session.session} className="flex items-center">
                <div className="w-24 text-[11px] font-medium text-text-secondary uppercase">{session.session}</div>
                <div className="flex-1 bg-bg-void rounded-full h-2 overflow-hidden mx-4">
                  <div
                    className="h-full bg-accent-gold"
                    style={{ width: `${(session.pnl / Math.max(...displayData.sessionPerformance.map(s => s.pnl))) * 100}%` }}
                  />
                </div>
                <div className="w-20 text-right">
                  <span className={`font-mono text-sm ${session.pnl >= 0 ? "text-data-profit" : "text-data-loss"}`}>
                    {session.pnl >= 0 ? "+" : ""}${session.pnl}
                  </span>
                  <div className="text-[9px] text-text-muted">{session.trades} trades</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Streak Stats */}
        <div className="glass p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-text-primary">Streak Analysis</h3>
            <Award className="w-4 h-4 text-text-muted" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-bg-void/50 rounded-lg text-center border border-white/5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Longest Win Streak</p>
              <p className="font-mono text-2xl font-bold text-data-profit">{displayData.streakStats.longestWin}</p>
            </div>
            <div className="p-4 bg-bg-void/50 rounded-lg text-center border border-white/5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Longest Loss Streak</p>
              <p className="font-mono text-2xl font-bold text-data-loss">{displayData.streakStats.longestLoss}</p>
            </div>
            <div className="p-4 bg-bg-void/50 rounded-lg text-center border border-white/5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Current Streak</p>
              <div className="flex items-center justify-center mt-1 space-x-2">
                {displayData.streakStats.currentStreak.type === "win" ? (
                  <TrendingUp className="w-4 h-4 text-data-profit" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-data-loss" />
                )}
                <span className={`font-mono text-lg font-bold ${displayData.streakStats.currentStreak.type === "win" ? "text-data-profit" : "text-data-loss"}`}>
                  {displayData.streakStats.currentStreak.count}
                </span>
              </div>
            </div>
            <div className="p-4 bg-bg-void/50 rounded-lg text-center border border-white/5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Avg Win Streak</p>
              <p className="font-mono text-2xl font-bold text-accent-gold">{displayData.streakStats.avgConsecutiveWins.toFixed(1)}</p>
            </div>
          </div>
        </div>

        {/* Calendar Heatmap */}
        <div className="glass p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-text-primary">Performance Heatmap (Last 30 Days)</h3>
            <Calendar className="w-4 h-4 text-text-muted" />
          </div>
          <CalendarHeatmap />
          <div className="flex items-center justify-end space-x-4 mt-4 text-[10px] text-text-muted">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-bg-elevated border border-border-subtle rounded-sm mr-1" />
              <span>Low</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-data-profit/40 rounded-sm mr-1" />
              <span>Medium</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-data-profit/80 rounded-sm mr-1" />
              <span>High</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass p-6">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center">
            <Target className="w-4 h-4 mr-2 text-accent-gold" />
            Best Performing Pairs
          </h3>
          <div className="space-y-3">
            {displayData.bestPerformingPairs.length > 0 ? (
              displayData.bestPerformingPairs.map((item) => (
                <div key={item.pair} className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-text-primary">{item.pair}</p>
                    <p className="text-[10px] text-text-muted">{item.winRate}% win rate</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-data-profit">{item.pnl.toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-muted">No data available</p>
            )}
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-accent-gold" />
            Risk Metrics
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-text-secondary">Sharpe Ratio</span>
                <span className="font-mono text-accent-gold">{displayData.riskMetrics.sharpeRatio.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-text-secondary">Max Drawdown</span>
                <span className="font-mono text-data-loss">{displayData.riskMetrics.maxDrawdown.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-bg-void rounded-full overflow-hidden">
                <div className="h-full bg-data-loss" style={{ width: `${Math.min(displayData.riskMetrics.maxDrawdown * 4, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-text-secondary">Avg R:R</span>
                <span className="font-mono text-accent-gold">{displayData.riskMetrics.avgRR.toFixed(1)}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-text-secondary">Expectancy</span>
                <span className="font-mono text-data-profit">${displayData.riskMetrics.expectancy.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center">
            <Activity className="w-4 h-4 mr-2 text-accent-gold" />
            Trading Behaviour
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-secondary uppercase">Avg Trade Duration</span>
              <span className="font-mono text-sm text-text-primary">{displayData.tradingBehaviour.avgTradeDuration}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-secondary uppercase">Avg P&L/Trade</span>
              <span className="font-mono text-sm text-data-profit">${displayData.tradingBehaviour.avgPnlPerTrade.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-secondary uppercase">Trades/Day (Avg)</span>
              <span className="font-mono text-sm text-text-primary">{displayData.tradingBehaviour.tradesPerDay.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-secondary uppercase">Plan Adherence</span>
              <span className="font-mono text-sm text-accent-gold">{displayData.tradingBehaviour.planAdherence.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
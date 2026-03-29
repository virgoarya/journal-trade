"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  ShieldCheck,
  Zap,
  Target,
  Trophy,
  History,
  Loader2
} from "lucide-react";
import { tradeService, type Trade } from "@/services/trade.service";
import { analyticsService, type AnalyticsData } from "@/services/analytics.service";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch recent trades
        const tradesResult = await tradeService.getRecent(5);
        if (tradesResult.success && tradesResult.data) {
          setRecentTrades(tradesResult.data);
        }

        // Fetch analytics overview
        const analyticsResult = await analyticsService.getOverview();
        if (analyticsResult.success && analyticsResult.data) {
          setAnalytics(analyticsResult.data);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-data-loss font-medium mb-2">Error loading dashboard</p>
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  // Derive KPIs from analytics data or use defaults
  const kpis = [
    {
      label: "Win Rate",
      value: analytics ? `${analytics.winRate.toFixed(1)}%` : "0%",
      sub: analytics ? `+${(analytics.winRate - 50).toFixed(1)}%` : "-",
      icon: Trophy,
      isGold: true
    },
    {
      label: "Profit Factor",
      value: analytics ? analytics.profitFactor.toFixed(2) : "0.00",
      sub: analytics ? (analytics.profitFactor >= 1 ? "Profitable" : "Loss") : "-",
      icon: Target,
      isGold: true
    },
    {
      label: "Avg Win",
      value: analytics ? `$${analytics.riskMetrics.expectancy.toFixed(0)}` : "$0",
      color: "text-data-profit",
      icon: TrendingUp
    },
    {
      label: "Avg Loss",
      value: analytics ? `-$${Math.abs(analytics.riskMetrics.expectancy * 0.7).toFixed(0)}` : "$0",
      color: "text-data-loss",
      icon: TrendingDown
    },
    {
      label: "Total Trade",
      value: analytics ? analytics.totalTrades.toString() : "0",
      icon: Activity
    },
    {
      label: "Best Streak",
      value: analytics ? `${analytics.streakStats.longestWin} WINS` : "0",
      isGold: true,
      icon: Zap
    },
  ];

  const formatPnL = (pnl: number) => {
    const formatted = Math.abs(pnl).toFixed(2);
    return `${pnl >= 0 ? "+" : "-"}$${formatted}`;
  };

  const getPnlColor = (result: string) => {
    return result === "win" ? "text-data-profit" : result === "loss" ? "text-data-loss" : "text-accent-gold";
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      
      {/* SECTION 1: Bento Grid Top */}
      <div className="grid grid-cols-12 gap-6">

        {/* 1. Account Summary & Gauges */}
        <div className="col-span-12 lg:col-span-4 glass p-6 flex flex-col justify-between min-h-[300px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.2em] mb-1">Total Ekuitas</p>
              <h3 className="font-mono text-3xl font-bold text-accent-gold">
                {analytics ? `$${analytics.totalPnL.toLocaleString()}` : "$0.00"}
              </h3>
              <div className="flex items-center mt-2">
                <TrendingUp className="text-data-profit w-4 h-4 mr-1" />
                <span className={`font-mono text-sm font-medium ${analytics && analytics.totalPnL >= 0 ? "text-data-profit" : "text-data-loss"}`}>
                  {analytics ? `${analytics.totalPnL >= 0 ? "+" : ""}$${analytics.totalPnL.toLocaleString()} (${analytics.winRate}%)` : "N/A"}
                </span>
              </div>
            </div>
            <Wallet className="text-text-muted w-6 h-6" />
          </div>

          <div className="pt-6 border-t border-white/5 flex justify-around">
            <div className="text-center group">
              <div className="w-20 h-20 rounded-full border-4 border-accent-gold/20 border-t-accent-gold flex items-center justify-center mb-2 transition-transform group-hover:scale-105">
                <span className="font-mono text-[11px] text-text-primary">70%</span>
              </div>
              <p className="text-[10px] text-text-secondary uppercase font-medium">Eksposur</p>
            </div>
            <div className="text-center group">
               <div className="w-20 h-20 rounded-full border-4 border-data-loss/20 border-t-data-loss flex items-center justify-center mb-2 transition-transform group-hover:scale-105">
                <span className="font-mono text-[11px] text-text-primary">15%</span>
              </div>
              <p className="text-[10px] text-text-secondary uppercase font-medium">Risiko Sesi</p>
            </div>
          </div>
        </div>

        {/* 2. Equity Curve Chart Placeholder */}
        <div className="col-span-12 lg:col-span-5 glass p-6 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-semibold text-text-primary">Kurva Ekuitas</h4>
            <div className="flex bg-bg-void/50 p-1 rounded-lg border border-white/5">
              <button className="px-3 py-1 text-[10px] font-mono text-text-secondary hover:text-accent-gold">1M</button>
              <button className="px-3 py-1 text-[10px] font-mono bg-accent-gold text-bg-void font-bold rounded shadow-sm">3B</button>
              <button className="px-3 py-1 text-[10px] font-mono text-text-secondary hover:text-accent-gold">SEMUA</button>
            </div>
          </div>
          {/* Simple Chart */}
          <div className="flex-1 bg-gradient-to-t from-accent-gold/5 to-transparent border-b border-white/5 relative overflow-hidden flex items-end">
            {analytics && analytics.monthlyPnL ? (
              <div className="absolute inset-0 flex items-end px-2">
                {analytics.monthlyPnL.map((month, idx) => {
                  const maxPnL = Math.max(...analytics.monthlyPnL.map(m => m.pnl));
                  const minPnL = Math.min(...analytics.monthlyPnL.map(m => m.pnl));
                  const range = maxPnL - minPnL || 1;
                  const height = ((month.pnl - minPnL) / range) * 80 + 20; // Scale to 20-100%
                  const isPositive = month.pnl >= 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group">
                      <div
                        className="w-full max-w-[60px] rounded-t-sm transition-all group-hover:brightness-110"
                        style={{
                          height: `${height}%`,
                          backgroundColor: isPositive ? '#00E676' : '#FF1744',
                          opacity: 0.7 + (idx === analytics.monthlyPnL.length - 1 ? 0.3 : 0)
                        }}
                      />
                      <span className="text-[9px] text-text-muted mt-1">{month.month}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center italic text-text-muted text-xs">
                [ Chart akan muncul setelah ada data ]
              </div>
            )}
          </div>
        </div>

        {/* 3. Recent Trades */}
        <div className="col-span-12 lg:col-span-3 glass p-6 min-h-[300px]">
           <div className="flex justify-between items-center mb-6">
            <h4 className="font-semibold text-text-primary">Transaksi Terakhir</h4>
            <History className="w-4 h-4 text-text-muted" />
          </div>
          <div className="space-y-3">
             {recentTrades.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-accent-gold/20 hover:bg-white/10 transition-all cursor-default">
                   <div className="flex items-center">
                      <div className={`w-9 h-9 rounded-lg ${t.result === "win" ? "bg-data-profit/10 text-data-profit" : t.result === "loss" ? "bg-data-loss/10 text-data-loss" : "bg-accent-gold/10 text-accent-gold"} flex items-center justify-center mr-3`}>
                         {t.result === "win" ? <TrendingUp className="w-5 h-5" /> : t.result === "loss" ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-text-primary">{t.pair}</p>
                        <p className="text-[10px] text-text-secondary uppercase">{t.type}</p>
                      </div>
                   </div>
                   <p className={`font-mono font-bold ${getPnlColor(t.result)}`}>
                     {formatPnL(t.pnl)}
                   </p>
                </div>
             ))}
          </div>
          <button className="w-full py-3 mt-6 text-[11px] font-bold text-accent-gold uppercase tracking-[0.2em] border border-accent-gold/20 rounded-xl hover:bg-accent-gold/5 transition-all active:scale-95">
             Lihat Semua
          </button>
        </div>
      </div>

      {/* SECTION 2: KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((k, idx) => (
            <div key={idx} className={`glass p-4 text-center border-b-2 ${k.isGold ? "border-accent-gold" : "border-transparent"}`}>
               <div className="flex justify-center mb-2">
                  <k.icon className={`w-4 h-4 ${k.isGold ? "text-accent-gold" : "text-text-secondary"}`} />
               </div>
               <p className="text-[9px] text-text-secondary uppercase tracking-[0.15em] mb-1">{k.label}</p>
               <p className={`font-mono text-lg font-bold ${k.color ? k.color : "text-text-primary"} ${k.isGold ? "text-accent-gold" : ""}`}>{k.value}</p>
            </div>
          ))}
      </div>

      {/* SECTION 3: Bottom Stats */}
      <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 glass p-6 min-h-[260px]">
             <h4 className="font-semibold text-text-primary mb-6">Kalender Performa (Heatmap)</h4>
             <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`aspect-square rounded ${i % 7 === 2 ? "bg-data-loss/60" : i % 7 === 4 ? "bg-data-profit/80" : "bg-bg-elevated"} border border-white/5`} 
                  />
                ))}
             </div>
          </div>

          <div className="col-span-12 lg:col-span-4 glass p-6 flex flex-col justify-between">
              <div>
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="font-semibold text-text-primary">Risk Control Center</h4>
                    <span className="px-2 py-1 rounded bg-accent-gold/10 text-accent-gold text-[9px] font-bold tracking-[0.2em] border border-accent-gold/30">AMAN</span>
                 </div>
                 <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-[11px] mb-2 uppercase tracking-wide">
                          <span className="text-text-secondary">Harian Drawdown</span>
                          <span className="font-mono text-text-primary">0.4% / 2.0%</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-void rounded-full overflow-hidden">
                          <div className="h-full bg-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]" style={{ width: "20%" }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[11px] mb-2 uppercase tracking-wide">
                          <span className="text-text-secondary">Total Drawdown</span>
                          <span className="font-mono text-text-primary">1.2% / 5.0%</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-void rounded-full overflow-hidden">
                          <div className="h-full bg-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]" style={{ width: "24%" }}></div>
                        </div>
                    </div>
                 </div>
              </div>
              <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                 <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-accent-gold" />
                    <span className="text-[11px] text-text-secondary uppercase">Risk Guard Aktif</span>
                 </div>
                 <button className="text-[10px] text-accent-gold font-bold uppercase hover:underline">Edit Hub</button>
              </div>
          </div>
      </div>

    </div>
  );
}

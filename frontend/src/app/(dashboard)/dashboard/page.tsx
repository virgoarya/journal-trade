"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
  AlertCircle
} from "lucide-react";
import { tradeService, type Trade } from "@/services/trade.service";
import { analyticsService, type AnalyticsData } from "@/services/analytics.service";
import { tradingAccountService, type TradingAccount } from "@/services/trading-account.service";
import { useSession } from "@/lib/auth-client";
import { Heatmap } from "@/components/analytics/Heatmap";
import { PnLCalendar } from "@/components/analytics/PnLCalendar";
import { AssetDistributionChart } from "@/components/analytics/AssetDistributionChart";
import { toast } from "sonner";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activeAccount, setActiveAccount] = useState<TradingAccount | null>(null);
  const [equityCurve, setEquityCurve] = useState<{ date: string, equity: number }[]>([]);
  const [exposure, setExposure] = useState(0);
  const [sessionRisk, setSessionRisk] = useState(0);
  const [allTradesForCalendar, setAllTradesForCalendar] = useState<Trade[]>([]);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isPending && !session) {
      router.push("/");
      return;
    }

    const fetchData = async () => {
      try {
        setError(null);

        // 1. Fetch Active Account (Onboarding Check) - only once
        let localActiveAccount = activeAccount;
        if (!localActiveAccount) {
          const accountResult = await tradingAccountService.getActiveAccount();
          if (!accountResult.success) {
            router.push("/onboarding");
            return;
          }
          localActiveAccount = accountResult.data as TradingAccount;
          setActiveAccount(localActiveAccount);
        }

        // 2. Fetch Recent Trades (fetch more to populate the calendar)
        const tradesResult = await tradeService.getRecent(50);
        if (tradesResult.success && Array.isArray(tradesResult.data)) {
          setAllTradesForCalendar(tradesResult.data);
          setRecentTrades(tradesResult.data.slice(0, 5)); // display only top 5

          // Calculate Exposure & Session Risk based on today's trades
          const today = new Date().toDateString();
          const todayTrades = tradesResult.data.filter(t => {
            const tDate = new Date(t.tradeDate).toDateString();
            return tDate === today && !t.isDeleted;
          });
          
          const totalRiskToday = todayTrades.reduce((sum, t) => sum + (t.riskPercent || 0), 0);
          setExposure(totalRiskToday);

          // Get the dynamic daily limit directly from fetched account data to avoid stale state closure
          // Session Risk: normalize against user's daily limit (fallback to 2% max for higher sensitivity)
          const dailyLimit = localActiveAccount?.maxDailyDrawdownPct || 2;
          const riskOfLimit = (totalRiskToday / dailyLimit) * 100;
          setSessionRisk(Math.min(riskOfLimit, 100)); // Cap at 100% for gauge
        } else {
          setRecentTrades([]);
          setExposure(0);
          setSessionRisk(0);
        }

        // 3. Fetch Analytics Overview (auto-refresh)
        const analyticsResult = await analyticsService.getOverview();
        if (analyticsResult.success && analyticsResult.data) {
          setAnalytics(analyticsResult.data);
        }

        // 4. Fetch Real Equity Curve (auto-refresh)
        const equityResult = await analyticsService.getEquityCurve();
        if (equityResult.success && Array.isArray(equityResult.data?.points)) {
          setEquityCurve(equityResult.data.points);
        }
      } catch (err: any) {
        console.error("Dashboard Fetch Error:", err);
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchData();
      // Auto-refresh every 30 seconds to sync with Log Trade
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [session, isPending, router, activeAccount]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-accent-gold animate-spin mx-auto mb-4" />
          <p className="text-accent-gold font-mono text-sm tracking-widest animate-pulse">SYNCING DATA...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center p-8 glass rounded-2xl max-w-md">
          <AlertCircle className="w-12 h-12 text-data-loss mx-auto mb-4" />
          <p className="text-data-loss font-bold text-lg mb-2">An Error Occurred</p>
          <p className="text-sm text-text-secondary mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-accent-gold text-bg-void rounded-xl font-bold hover:brightness-110 transition-all uppercase text-xs tracking-widest"
          >
            Refresh System
          </button>
        </div>
      </div>
    );
  }

  // Calculate dynamic values
  const initialBalance = activeAccount?.initialBalance || 0;
  const totalPnL = analytics?.totalPnL || 0;
  const currentEquity = initialBalance + totalPnL;
  const equityGrowth = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;

  // Derive KPIs from analytics data or use defaults
  const kpis = [
    {
      label: "Win Rate",
      value: analytics?.winRate ? `${analytics.winRate.toFixed(1)}%` : "0.0%",
      sub: analytics?.winRate && analytics.winRate >= 50 ? "Excellent" : analytics?.winRate ? "Needs Work" : "-",
      icon: Trophy,
      isGold: true
    },
    {
      label: "Profit Factor",
      value: analytics?.profitFactor ? analytics.profitFactor.toFixed(2) : "0.00",
      sub: analytics?.profitFactor ? (analytics.profitFactor >= 1.5 ? "Stable" : analytics.profitFactor >= 1 ? "Positive" : "Negative") : "-",
      icon: Target,
      isGold: true
    },
    {
      label: "Avg Win",
      value: analytics?.riskMetrics?.avgWin ? `$${analytics.riskMetrics.avgWin.toFixed(0)}` : "$0",
      color: "text-data-profit",
      icon: TrendingUp
    },
    {
      label: "Avg Loss",
      value: analytics?.riskMetrics?.avgLoss ? `-$${Math.abs(analytics.riskMetrics.avgLoss).toFixed(0)}` : "$0",
      color: "text-data-loss",
      icon: TrendingDown
    },
    {
      label: "Total Trade",
      value: analytics?.totalTrades?.toString() || "0",
      icon: Activity
    },
    {
      label: "Best Streak",
      value: analytics?.streakStats?.longestWin ? `${analytics.streakStats.longestWin} WINS` : "0",
      isGold: true,
      icon: Zap
    },
  ];

  const formatPnL = (pnl: number) => {
    const formatted = Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${pnl >= 0 ? "+" : "-"}$${formatted}`;
  };


  const getPnlColor = (result: string) => {
    return result === "win" ? "text-data-profit" : result === "loss" ? "text-data-loss" : "text-accent-gold";
  };

  // SVG Line Chart Helper for Equity Curve (SMOOTH VERSION)
  const EquityLineChart = ({ data }: { data: { date: string, equity: number }[] }) => {
    if (data.length === 0) return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-30">
        <div className="w-12 h-12 border-2 border-dashed border-[#d4af37] rounded-full animate-spin-slow"></div>
        <span className="font-mono text-[10px] text-text-muted tracking-widest uppercase">Waiting for Trade Data...</span>
      </div>
    );

    const chartData = data.length === 1 
      ? [{ date: 'Start', equity: 0 }, ...data] 
      : data;

    const values = chartData.map(d => d.equity);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 100);
    const range = (max - min) || 1;
    
    // Scale points
    const points = chartData.map((d, i) => ({
      x: (i / (chartData.length - 1)) * 100,
      y: 80 - ((d.equity - min) / range) * 60 // Increased padding for "smaller" look (was 70/85)
    }));

    // Helper for smoothing (Bezier Curve)
    const getSmoothingPath = (pts: {x: number, y: number}[]) => {
      if (pts.length < 2) return "";
      let d = `M ${pts[0].x},${pts[0].y}`;
      
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i+1];
        const cp_x = (p0.x + p1.x) / 2;
        d += ` C ${cp_x},${p0.y} ${cp_x},${p1.y} ${p1.x},${p1.y}`;
      }
      return d;
    };

    const pathData = getSmoothingPath(points);

    return (
      <div className="w-full h-[85%] relative p-6 group"> {/* Restored to 85% to fit large container */}
        <svg viewBox="0 0 100 80" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Shadow Area - keep it smooth but closed */}
          {pathData && (
            <path
              d={`${pathData} L 100,80 L 0,80 Z`}
              fill="url(#equityGradient)"
              className="transition-all duration-700 opacity-60 group-hover:opacity-100"
            />
          )}
          {/* Main Smooth Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#d4af37"
            strokeWidth="0.6" // Refined stroke (original was 0.8)
            strokeLinecap="round"
            strokeLinejoin="round"
            className="filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] transition-all duration-500"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
      
      {/* SECTION 1: KPI Strip (Top Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((k, idx) => (
            <div key={idx} className={`glass p-5 text-center border-b-2 ${k.isGold ? "border-accent-gold shadow-[0_4px_20px_-4px_rgba(212,175,55,0.15)]" : "border-transparent"} hover:-translate-y-1 transition-transform duration-300`}>
               <div className="flex justify-center mb-3">
                  <k.icon className={`w-[30px] h-[30px] ${k.isGold ? "text-accent-gold filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" : "text-text-secondary opacity-70"}`} />
               </div>
               <p className="text-[10px] text-text-secondary uppercase tracking-[0.15em] mb-1.5 font-bold">{k.label}</p>
               <p className={`font-mono text-2xl font-black tracking-tight ${k.color ? k.color : "text-text-primary"} ${k.isGold ? "text-accent-gold" : ""}`}>{k.value}</p>
            </div>
          ))}
      </div>
      {/* ROW 1: Top Analysis & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* 1. Equity Curve Chart */}
        <div className="lg:col-span-8 glass p-5 flex flex-col h-[450px]"> 
          <div className="flex justify-between items-center mb-0">
            <h4 className="font-semibold text-text-primary text-[10px] uppercase tracking-widest leading-none">Equity Curve</h4>
            <div className="flex bg-bg-void/50 p-1 rounded-lg border border-white/5">
              <button className="px-2 py-0.5 text-[8px] font-mono text-text-secondary hover:text-accent-gold uppercase tracking-tighter">1M</button>
              <button className="px-2 py-0.5 text-[8px] font-mono bg-accent-gold text-bg-void font-bold rounded shadow-sm transition-all uppercase tracking-tighter">PRIMARY</button>
            </div>
          </div>
          
          <div className="flex-1 bg-gradient-to-t from-accent-gold/5 to-transparent border-b border-white/5 relative overflow-hidden flex items-end rounded-xl mt-3">
             <EquityLineChart data={equityCurve} />
          </div>
        </div>

        {/* 2. Account Summary, Gauges & Risk Guard */}
        <div className="lg:col-span-4 glass p-5 flex flex-col gap-5 self-start">
          
          {/* Total Equity */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-medium text-text-secondary uppercase tracking-[0.2em] mb-1">Total Equity</p>
              <h3 className="font-mono text-xl font-bold text-accent-gold leading-none">
                ${currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <Wallet className="text-text-muted w-4 h-4" />
          </div>

          {/* Gauges */}
          <div className="pt-4 border-t border-white/5 flex justify-around">
            <div className="text-center" title="Total risk of trades today">
              <div className="relative w-14 h-14 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 40 40" className="w-full h-full transform -rotate-90">
                  <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                  <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray="106.8" strokeDashoffset={106.8 * (1 - Math.min(exposure / 2, 1))} className={`transition-all duration-1000 ease-out ${exposure >= 2 ? 'text-data-loss' : 'text-accent-gold'}`} strokeLinecap="round" />
                </svg>
                <span className="absolute font-mono text-[9px] text-text-primary">{exposure.toFixed(1)}%</span>
              </div>
              <p className="text-[8px] text-text-secondary uppercase tracking-widest mt-2">Exposure</p>
            </div>

            <div className="text-center" title="Percentage of daily risk limit used today">
              <div className="relative w-14 h-14 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 40 40" className="w-full h-full transform -rotate-90">
                  <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                  <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray="106.8" strokeDashoffset={106.8 * (1 - (sessionRisk / 100))} className={`transition-all duration-1000 ease-out ${sessionRisk > 60 ? 'text-data-loss' : 'text-accent-gold'}`} strokeLinecap="round" />
                </svg>
                <span className="absolute font-mono text-[9px] text-text-primary">{Math.round(sessionRisk)}%</span>
              </div>
              <p className="text-[8px] text-text-secondary uppercase tracking-widest mt-2">Session Risk</p>
            </div>
          </div>

          {/* Risk Guard */}
          <div className="pt-4 border-t border-white/5 space-y-4">
             <div className="flex items-center space-x-2 -mt-1 mb-3 text-text-muted">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[9px] uppercase tracking-widest font-semibold">Risk Guard</span>
             </div>
             <div>
                 <div className="flex justify-between text-[9px] mb-1.5 uppercase tracking-wider">
                   <span className="text-text-secondary">Daily Drawdown</span>
                   <span className="font-mono text-text-primary">{activeAccount?.maxDailyDrawdownPct || "---"}% Limit</span>
                 </div>
                 <div className="w-full h-1 bg-bg-void rounded-full overflow-hidden">
                   <div className="h-full bg-accent-gold" style={{ width: "2%" }}></div>
                 </div>
             </div>
             <div>
                 <div className="flex justify-between text-[9px] mb-1.5 uppercase tracking-wider">
                   <span className="text-text-secondary">Total Drawdown</span>
                   <span className="font-mono text-text-primary">{activeAccount?.maxTotalDrawdownPct || "---"}% Limit</span>
                 </div>
                 <div className="w-full h-1 bg-bg-void rounded-full overflow-hidden">
                   <div className="h-full bg-accent-gold" style={{ width: "2%" }}></div>
                 </div>
             </div>
          </div>

        </div>
      </div>

      {/* ROW 2: Performance Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Monthly Performance Calendar */}
        <div className="lg:col-span-7 glass p-6 min-h-[400px]">
           <div className="flex justify-between items-center mb-6">
              <h4 className="font-semibold text-text-primary uppercase tracking-[0.2em] text-xs">Monthly Performance Calendar</h4>
              <div className="text-[10px] text-accent-gold font-mono uppercase tracking-[0.2em] bg-accent-gold/5 px-3 py-1 rounded-full border border-accent-gold/10">
                Daily Tracker
              </div>
           </div>
           <PnLCalendar trades={allTradesForCalendar} />
        </div>

        {/* Right: Side Panels */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Performance Matrix */}
          <div className="glass p-5 flex flex-col min-h-[220px]">
            <div className="flex justify-between items-center mb-4">
               <h4 className="font-semibold text-text-primary uppercase tracking-[0.2em] text-[10px]">Performance Matrix</h4>
            </div>
            {analytics?.heatmap ? (
              <Heatmap data={analytics.heatmap} />
            ) : (
              <div className="h-24 flex items-center justify-center border border-dashed border-white/5 rounded-xl">
                <p className="text-[9px] text-text-muted uppercase tracking-widest">Processing Analytics...</p>
              </div>
            )}
          </div>

          {/* Recent Trades */}
          <div className="glass p-4">
             <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-[8px] text-text-primary uppercase tracking-widest leading-none">Recent Trades</h4>
              <History className="w-3 h-3 text-text-muted" />
            </div>
            <div className="space-y-1.5">
              {Array.isArray(recentTrades) && recentTrades.slice(0, 5).map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 border border-transparent hover:border-accent-gold/20 transition-all text-[9px]">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded bg-${t.result === "win" ? "data-profit" : "data-loss"}/10 flex items-center justify-center`}>
                      {t.result === "win" ? <TrendingUp className="w-2.5 h-2.5 text-data-profit" /> : <TrendingDown className="text-data-loss w-2.5 h-2.5" />}
                    </div>
                    <p className="font-bold">{t.pair}</p>
                  </div>
                  <p className={`font-mono font-bold ${getPnlColor(t.result)}`}>{formatPnL(t.pnl)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Asset Distribution */}
          <div className="glass p-5 flex flex-col min-h-[160px]">
            <div className="flex justify-between items-center mb-4">
               <h4 className="font-semibold text-text-primary uppercase tracking-[0.2em] text-[10px]">Asset Distribution</h4>
               <div className="text-[10px] text-accent-gold font-mono uppercase tracking-[0.2em]">Top Assets</div>
            </div>
            {analytics?.assetDistribution ? (
              <AssetDistributionChart data={analytics.assetDistribution} />
            ) : (
              <div className="h-32 flex items-center justify-center border border-dashed border-white/5 rounded-xl">
                <p className="text-[9px] text-text-muted uppercase tracking-widest">Calculating Assets...</p>
              </div>
            )}
          </div>
          
        </div>
      </div>


    </div>
  );
}

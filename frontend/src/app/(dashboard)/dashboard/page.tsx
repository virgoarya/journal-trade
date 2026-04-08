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
import { ForexCalculator } from "@/components/dashboard/ForexCalculator";
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
  // 'idle' = show real value | 'zero' = needle at 0 | 'full' = needle at 100% | 'return' = sweep back to real
  const [gaugePhase, setGaugePhase] = useState<Record<string, 'idle' | 'zero' | 'full' | 'return'>>({});

  const startVarioRev = (id: string) => {
    if (gaugePhase[id] && gaugePhase[id] !== 'idle') return; // already animating
    // Phase 1: instantly snap to zero
    setGaugePhase(prev => ({ ...prev, [id]: 'zero' }));
    // Phase 2: after brief hold, sweep to 100%
    setTimeout(() => {
      setGaugePhase(prev => ({ ...prev, [id]: 'full' }));
    }, 120);
    // Phase 3: return to actual value
    setTimeout(() => {
      setGaugePhase(prev => ({ ...prev, [id]: 'return' }));
    }, 720);
    // Phase 4: reset to idle
    setTimeout(() => {
      setGaugePhase(prev => ({ ...prev, [id]: 'idle' }));
    }, 1500);
  };

  const getGaugeOffset = (id: string, realOffset: number) => {
    const phase = gaugePhase[id];
    if (phase === 'zero') return 106.8;       // needle at 0%
    if (phase === 'full') return 0;            // needle at 100%
    return realOffset;                         // actual value
  };

  const getGaugeTransition = (id: string) => {
    const phase = gaugePhase[id];
    if (phase === 'zero') return 'duration-0';                                            // instant snap
    if (phase === 'full') return 'duration-[600ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]';  // smooth sweep up
    if (phase === 'return') return 'duration-[700ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)]'; // bouncy return
    return 'duration-[800ms] ease-out';                                                   // default
  };

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
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {kpis.map((k, idx) => (
            <div key={idx} className={`glass p-3 sm:p-4 text-center border-b-2 ${k.isGold ? "border-accent-gold shadow-[0_4px_20px_-4px_rgba(212,175,55,0.15)]" : "border-transparent"} hover:-translate-y-1 transition-transform duration-300`}>
               <div className="flex justify-center mb-2 sm:mb-3">
                  <k.icon className={`w-6 h-6 sm:w-[30px] sm:h-[30px] ${k.isGold ? "text-accent-gold filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" : "text-text-secondary opacity-70"}`} />
               </div>
               <p className="text-[10px] sm:text-xs text-text-secondary uppercase tracking-[0.15em] mb-1 sm:mb-1.5 font-bold">{k.label}</p>
               <p className={`font-mono text-lg sm:text-2xl font-black tracking-tight ${k.color ? k.color : "text-text-primary"} ${k.isGold ? "text-accent-gold" : ""}`}>{k.value}</p>
            </div>
          ))}
      </div>
      {/* ROW 1: Top Analysis & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* 1. Equity Curve Chart */}
        <div className="lg:col-span-7 glass p-3 sm:p-4 md:p-5 flex flex-col min-h-[350px] md:h-[450px]">
          <div className="flex justify-between items-center mb-0">
             <h4 className="font-semibold text-text-primary text-xs sm:text-sm uppercase tracking-wider leading-none">Equity Curve</h4>
             <div className="flex bg-bg-void/50 p-1 rounded-lg border border-white/5">
                <button className="px-2 py-1 text-[10px] font-mono text-text-secondary hover:text-accent-gold uppercase tracking-tighter">1M</button>
                <button className="px-2 py-1 text-[10px] font-mono bg-accent-gold text-bg-void font-bold rounded shadow-sm transition-all uppercase tracking-tighter">PRIMARY</button>
             </div>
          </div>
          
          <div className="flex-1 bg-gradient-to-t from-accent-gold/5 to-transparent border-b border-white/5 relative overflow-hidden flex items-end rounded-xl mt-3">
             <EquityLineChart data={equityCurve} />
          </div>
        </div>

        {/* 2. Account Summary, Gauges & Risk Guard */}
        <div className="lg:col-span-5 glass p-3 sm:p-4 md:p-5 flex flex-col min-h-[350px] md:h-[450px]">

          {/* Total Equity */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-text-secondary uppercase tracking-[0.2em] mb-1">Total Equity</p>
              <h3 className="font-mono text-lg sm:text-xl font-bold text-accent-gold leading-none">
                ${currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <Wallet className="text-text-muted w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          {/* Gauges */}
          <div className="pt-4 border-t border-white/5 flex justify-around">
            <div className="text-center w-full cursor-pointer group" title="Total risk of trades today" onMouseEnter={() => startVarioRev('exposure')}>
              <div className="relative w-24 h-24 flex items-center justify-center mx-auto transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                <svg viewBox="0 0 40 40" className="w-full h-full transform -rotate-90 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] transition-all duration-300">
                  <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                  <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray="106.8" 
                    strokeDashoffset={getGaugeOffset('exposure', 106.8 * (1 - Math.min(exposure / 2, 1)))} 
                    className={`transition-all ${getGaugeTransition('exposure')} ${exposure >= 2 ? 'text-data-loss' : 'text-accent-gold'}`} strokeLinecap="round" />
                </svg>
                <span className="absolute font-mono text-[14px] text-text-primary font-bold">{exposure.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-4">Exposure</p>
            </div>

            <div className="text-center w-full cursor-pointer group" title="Percentage of daily risk limit used today" onMouseEnter={() => startVarioRev('session')}>
              <div className="relative w-24 h-24 flex items-center justify-center mx-auto transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                <svg viewBox="0 0 40 40" className="w-full h-full transform -rotate-90 group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] transition-all duration-300">
                  <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                  <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray="106.8" 
                    strokeDashoffset={getGaugeOffset('session', 106.8 * (1 - (sessionRisk / 100)))} 
                    className={`transition-all ${getGaugeTransition('session')} ${sessionRisk > 60 ? 'text-data-loss' : 'text-accent-gold'}`} strokeLinecap="round" />
                </svg>
                <span className="absolute font-mono text-[14px] text-text-primary font-bold">{Math.round(sessionRisk)}%</span>
              </div>
              <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-4">Session Risk</p>
            </div>
          </div>

          {/* Risk Guard */}
          <div className="pt-4 border-t border-white/5 space-y-5">
             <div className="flex items-center space-x-2 -mt-1 mb-1 text-text-muted">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[9px] uppercase tracking-widest font-semibold">Risk Guard</span>
             </div>
             <div>
                <div className="flex justify-between text-[9px] mb-2 uppercase tracking-wider">
                  <span className="text-text-secondary">Daily Drawdown</span>
                  <span className="font-mono text-text-primary">{activeAccount?.maxDailyDrawdownPct || "---"}% Limit</span>
                </div>
                <div className="w-full h-2.5 bg-bg-void rounded-full overflow-hidden border border-white/5 shadow-inner p-[1.5px]">
                  <div className="h-full bg-gradient-to-r from-accent-gold/40 to-accent-gold rounded-full shadow-[0_0_8px_rgba(212,175,55,0.4)] transition-all duration-1000" style={{ width: "2%" }}></div>
                </div>
             </div>
             <div>
                <div className="flex justify-between text-[9px] mb-2 uppercase tracking-wider">
                  <span className="text-text-secondary">Total Drawdown</span>
                  <span className="font-mono text-text-primary">{activeAccount?.maxTotalDrawdownPct || "---"}% Limit</span>
                </div>
                <div className="w-full h-2.5 bg-bg-void rounded-full overflow-hidden border border-white/5 shadow-inner p-[1.5px]">
                  <div className="h-full bg-gradient-to-r from-accent-gold/40 to-accent-gold rounded-full shadow-[0_0_8px_rgba(212,175,55,0.4)] transition-all duration-1000" style={{ width: "2%" }}></div>
                </div>
             </div>
          </div>

        </div>
      </div>

      {/* ROW 2: Performance Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Monthly Performance Calendar */}
        <div className="lg:col-span-7 glass p-3 sm:p-4 md:p-6 min-h-[350px] md:min-h-[400px]">
           <div className="flex justify-between items-center mb-3 sm:mb-6">
              <h4 className="font-semibold text-text-primary uppercase tracking-[0.2em] text-xs sm:text-sm">Monthly Performance Calendar</h4>
              <div className="text-[10px] sm:text-xs text-accent-gold font-mono uppercase tracking-[0.2em] bg-accent-gold/5 px-2 sm:px-3 py-1 rounded-full border border-accent-gold/10">
                Daily Tracker
              </div>
           </div>
           <PnLCalendar trades={allTradesForCalendar} />
        </div>

        {/* Right: Side Panels */}
        <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-4">

          {/* Forex Calculator */}
          <div className="min-h-[300px] sm:min-h-[350px]">
            <ForexCalculator 
              initialBalance={currentEquity} 
              defaultRisk={activeAccount?.defaultRiskPercent}
            />
          </div>

          {/* Performance Matrix */}
          <div className="glass p-3 sm:p-4 flex flex-col min-h-[180px] sm:min-h-[220px]">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
               <h4 className="font-semibold text-text-primary uppercase tracking-[0.2em] text-xs sm:text-sm">Performance Matrix</h4>
            </div>
            {analytics?.heatmap ? (
              <Heatmap data={analytics.heatmap} />
            ) : (
              <div className="h-16 sm:h-24 flex items-center justify-center border border-dashed border-white/5 rounded-xl">
                <p className="text-[9px] sm:text-[10px] text-text-muted uppercase tracking-widest">Processing Analytics...</p>
              </div>
            )}
          </div>

          {/* Recent Trades */}
          <div className="glass p-3 sm:p-4 flex-1 flex flex-col justify-between">
             <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-xs sm:text-sm text-text-primary uppercase tracking-[0.2em] leading-none">Recent Trades</h4>
              <History className="w-4 h-4 sm:w-5 sm:h-5 text-text-muted" />
            </div>
            <div className="space-y-2">
              {Array.isArray(recentTrades) && recentTrades.slice(0, 4).map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-accent-gold/20 hover:translate-x-1 transition-all text-xs sm:text-[10px] shadow-sm group">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded bg-${t.result === "win" ? "data-profit" : "data-loss"}/10 flex items-center justify-center border border-${t.result === "win" ? "data-profit" : "data-loss"}/20 group-hover:scale-110 transition-transform`}>
                      {t.result === "win" ? <TrendingUp className="w-3 h-3 text-data-profit" /> : <TrendingDown className="text-data-loss w-3 h-3" />}
                    </div>
                    <p className="font-bold tracking-wide text-text-secondary group-hover:text-text-primary">{t.pair}</p>
                  </div>
                  <p className={`font-mono font-bold tracking-tight ${getPnlColor(t.result)}`}>{formatPnL(t.pnl)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Asset Distribution */}
          <div className="glass p-3 sm:p-4 flex flex-col min-h-[140px] sm:min-h-[160px]">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
               <h4 className="font-semibold text-xs sm:text-sm text-text-primary uppercase tracking-[0.2em]">Asset Distribution</h4>
               <div className="text-[10px] sm:text-xs text-accent-gold font-mono uppercase tracking-[0.2em]">Top Assets</div>
            </div>
            {analytics?.assetDistribution ? (
              <AssetDistributionChart data={analytics.assetDistribution} />
            ) : (
              <div className="h-24 sm:h-32 flex items-center justify-center border border-dashed border-white/5 rounded-xl">
                <p className="text-[9px] sm:text-[10px] text-text-muted uppercase tracking-widest">Calculating Assets...</p>
              </div>
            )}
          </div>
          
        </div>
      </div>


    </div>
  );
}

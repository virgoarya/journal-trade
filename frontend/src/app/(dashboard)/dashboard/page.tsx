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

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activeAccount, setActiveAccount] = useState<TradingAccount | null>(null);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isPending && !session) {
      router.push("/");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Active Account (Onboarding Check)
        const accountResult = await tradingAccountService.getActiveAccount();
        if (!accountResult.success) {
          router.push("/onboarding");
          return;
        }
        setActiveAccount(accountResult.data as TradingAccount);

        // 2. Fetch Recent Trades
        const tradesResult = await tradeService.getRecent(5);
        if (tradesResult.success && Array.isArray(tradesResult.data)) {
          setRecentTrades(tradesResult.data);
        } else {
          setRecentTrades([]);
        }

        // 3. Fetch Analytics Overview
        const analyticsResult = await analyticsService.getOverview();
        if (analyticsResult.success && analyticsResult.data) {
          setAnalytics(analyticsResult.data);
        } else {
          if (analyticsResult.error) {
            setError(analyticsResult.error || "Gagal memuat data analitik");
          } else {
            setAnalytics(null);
          }
        }
      } catch (err: any) {
        console.error("Dashboard Fetch Error:", err);
        setError(err.message || "Gagal memuat data dashboard");
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [session, isPending, router]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-accent-gold animate-spin mx-auto mb-4" />
          <p className="text-accent-gold font-mono text-sm tracking-widest animate-pulse">SINKRONISASI DATA...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center p-8 glass rounded-2xl max-w-md">
          <AlertCircle className="w-12 h-12 text-data-loss mx-auto mb-4" />
          <p className="text-data-loss font-bold text-lg mb-2">Terjadi Kesalahan</p>
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
      value: analytics?.riskMetrics?.expectancy ? `$${analytics.riskMetrics.expectancy.toFixed(0)}` : "$0",
      color: "text-data-profit",
      icon: TrendingUp
    },
    {
      label: "Avg Loss",
      value: analytics?.riskMetrics?.expectancy ? `-$${Math.abs(analytics.riskMetrics.expectancy * 0.7).toFixed(0)}` : "$0",
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      
      {/* SECTION 1: Bento Grid Top */}
      <div className="grid grid-cols-12 gap-6">

        {/* 1. Account Summary & Gauges */}
        <div className="col-span-12 lg:col-span-4 glass p-6 flex flex-col justify-between min-h-[300px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-medium text-text-secondary uppercase tracking-[0.2em] mb-1">Total Ekuitas ({activeAccount?.currency || "USD"})</p>
              <h3 className="font-mono text-3xl font-bold text-accent-gold">
                ${currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center mt-2">
                {totalPnL >= 0 ? <TrendingUp className="text-data-profit w-4 h-4 mr-1" /> : <TrendingDown className="text-data-loss w-4 h-4 mr-1" />}
                <span className={`font-mono text-sm font-medium ${totalPnL >= 0 ? "text-data-profit" : "text-data-loss"}`}>
                  {totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString()} ({equityGrowth.toFixed(1)}%)
                </span>
              </div>
            </div>
            <Wallet className="text-text-muted w-6 h-6" />
          </div>

          <div className="pt-6 border-t border-white/5 flex justify-around">
            {/* Gauge: Eksposur */}
            <div className="text-center group">
              <div className="relative w-20 h-20 flex items-center justify-center mb-2 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="40" cy="40" r="34"
                    stroke="currentColor" strokeWidth="4"
                    fill="transparent" className="text-white/5"
                  />
                  <circle
                    cx="40" cy="40" r="34"
                    stroke="currentColor" strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="213.6"
                    strokeDashoffset="213.6"
                    className="text-accent-gold transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-[11px] text-text-primary">0%</span>
              </div>
              <p className="text-[10px] text-text-secondary uppercase font-medium tracking-wider">Eksposur</p>
            </div>

            {/* Gauge: Risiko Sesi */}
            <div className="text-center group">
              <div className="relative w-20 h-20 flex items-center justify-center mb-2 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="40" cy="40" r="34"
                    stroke="currentColor" strokeWidth="4"
                    fill="transparent" className="text-white/5"
                  />
                  <circle
                    cx="40" cy="40" r="34"
                    stroke="currentColor" strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="213.6"
                    strokeDashoffset="213.6"
                    className="text-data-loss transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-[11px] text-text-primary">0%</span>
              </div>
              <p className="text-[10px] text-text-secondary uppercase font-medium tracking-wider">Risiko Sesi</p>
            </div>
          </div>
        </div>

        {/* 2. Equity Curve Chart */}
        <div className="col-span-12 lg:col-span-5 glass p-6 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-semibold text-text-primary">Kurva Ekuitas</h4>
            <div className="flex bg-bg-void/50 p-1 rounded-lg border border-white/5">
              <button className="px-3 py-1 text-[10px] font-mono text-text-secondary hover:text-accent-gold">1M</button>
              <button className="px-3 py-1 text-[10px] font-mono bg-accent-gold text-bg-void font-bold rounded shadow-sm transition-all">UTAMA</button>
            </div>
          </div>
          
          <div className="flex-1 bg-gradient-to-t from-accent-gold/5 to-transparent border-b border-white/5 relative overflow-hidden flex items-end">
            {analytics && Array.isArray(analytics.monthlyPnL) && analytics.monthlyPnL.length > 0 ? (
              <div className="absolute inset-0 flex items-end px-2">
                {analytics.monthlyPnL.map((month, idx) => {
                  const maxPnL = Math.max(...analytics.monthlyPnL.map(m => m.pnl));
                  const minPnL = Math.min(...analytics.monthlyPnL.map(m => m.pnl));
                  const range = maxPnL - minPnL || 1;
                  const height = ((month.pnl - minPnL) / range) * 80 + 20; 
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
                      <span className="text-[9px] text-text-muted mt-1 uppercase font-mono">{month.month}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-30">
                <div className="w-12 h-12 border-2 border-dashed border-[#d4af37] rounded-full animate-spin-slow"></div>
                <span className="font-mono text-[10px] text-text-muted tracking-widest uppercase">Menunggu Data Trade Pertama...</span>
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
             {Array.isArray(recentTrades) && recentTrades.length > 0 ? (
              recentTrades.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-accent-gold/20 hover:bg-white/10 transition-all cursor-default">
                   <div className="flex items-center">
                      <div className={`w-9 h-9 rounded-lg ${t.result === "win" ? "bg-data-profit/10 text-data-profit" : t.result === "loss" ? "bg-data-loss/10 text-data-loss" : "bg-accent-gold/10 text-accent-gold"} flex items-center justify-center mr-3`}>
                         {t.result === "win" ? <TrendingUp className="w-5 h-5" /> : t.result === "loss" ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-text-primary">{t.pair}</p>
                        <p className="text-[10px] text-text-secondary uppercase">{t.direction}</p>
                      </div>
                   </div>
                   <p className={`font-mono font-bold text-xs ${getPnlColor(t.result)}`}>
                     {formatPnL(t.pnl)}
                   </p>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-8 h-8 text-white/10 mx-auto mb-3" />
                <p className="text-[11px] text-text-secondary uppercase tracking-widest">Belum ada trade</p>
                <p className="text-[9px] text-text-muted mt-1 italic">Mulai catat trade di menu Catat Trade</p>
              </div>
            )}
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
             <div className="flex justify-between items-center mb-6">
                <h4 className="font-semibold text-text-primary">Kalender Performa (Heatmap)</h4>
                <div className="text-[10px] text-accent-gold font-mono uppercase tracking-[0.2em] bg-accent-gold/5 px-3 py-1 rounded-full border border-accent-gold/10">
                  {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                </div>
             </div>
             
             <div className="space-y-4">
                <div className="grid grid-cols-7 gap-2 px-1">
                   {['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'].map(day => (
                     <span key={day} className="text-[9px] text-white/20 font-bold text-center tracking-widest">{day}</span>
                   ))}
                </div>
                <div className="grid grid-cols-7 gap-3">
                   {(() => {
                     const now = new Date();
                     const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
                     const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                     const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; 
                     
                     return Array.from({ length: 42 }).map((_, i) => {
                       const dayNumber = i - adjustedFirstDay + 1;
                       const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                       const isToday = isCurrentMonth && dayNumber === now.getDate();
                       
                       return (
                         <div 
                           key={i} 
                           className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all duration-300 relative group
                             ${isCurrentMonth ? "bg-bg-elevated/40 border-white/5 hover:border-accent-gold/40 hover:bg-white/5" : "bg-transparent border-transparent opacity-0"}
                             ${isToday ? "border-accent-gold/60 shadow-[0_0_15px_rgba(212,175,55,0.1)] bg-accent-gold/5" : ""}`}
                         >
                           {isCurrentMonth && (
                             <>
                               <span className={`text-[10px] font-mono ${isToday ? "text-accent-gold font-bold" : "text-white/20 group-hover:text-white/60"}`}>
                                 {dayNumber}
                               </span>
                               <div className={`w-1 h-1 rounded-full mt-1.5 ${isToday ? "bg-accent-gold" : "bg-white/5 group-hover:bg-white/20"}`} />
                             </>
                           )}
                         </div>
                       );
                     });
                   })()}
                </div>
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
                          <span className="font-mono text-text-primary">0.0% / {activeAccount?.maxDailyDrawdownPct || "---"}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-void rounded-full overflow-hidden">
                          <div className="h-full bg-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]" style={{ width: "2%" }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[11px] mb-2 uppercase tracking-wide">
                          <span className="text-text-secondary">Total Drawdown</span>
                          <span className="font-mono text-text-primary">0.0% / {activeAccount?.maxTotalDrawdownPct || "---"}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-void rounded-full overflow-hidden">
                          <div className="h-full bg-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]" style={{ width: "2%" }}></div>
                        </div>
                    </div>
                 </div>
              </div>
              <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                 <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-accent-gold" />
                    <span className="text-[11px] text-text-secondary uppercase">Risk Guard Aktif</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted font-mono">{activeAccount?.broker || "No Broker"}</span>
                 </div>
              </div>
          </div>
      </div>

    </div>
  );
}

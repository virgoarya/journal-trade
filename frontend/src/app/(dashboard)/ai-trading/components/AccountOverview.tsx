"use client";

import { type ACCOUNTInfo } from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import { Activity, TrendingUp, TrendingDown, Shield, Server } from "lucide-react";

interface AccountOverviewProps {
  accountInfo: ACCOUNTInfo | null;
  isLoading: boolean;
}

export function AccountOverview({
  accountInfo,
  isLoading,
}: AccountOverviewProps) {
  if (isLoading) {
    return <SkeletonLoader type="card" />;
  }

  if (!accountInfo) {
    return (
      <EmptyState
        type="data"
        title="No Live Signal"
        description="Connect to your MT5 account to initialize the HUD."
      />
    );
  }

  const pnlColor = (accountInfo.profit ?? 0) >= 0 ? "text-neon-green" : "text-neon-red";
  const pnlBg = (accountInfo.profit ?? 0) >= 0 ? "bg-neon-green/10 border-neon-green/20" : "bg-neon-red/10 border-neon-red/20";
  const dailyColor = (accountInfo.dailyPnL ?? 0) >= 0 ? "text-neon-green" : "text-neon-red";

  const riskPercent = accountInfo.balance && accountInfo.balance > 0
    ? Math.min((accountInfo.openRisk / accountInfo.balance) * 100, 10)
    : 0;
  const marginHealth = (accountInfo.marginLevel ?? 0) > 500 ? "text-neon-green"
    : (accountInfo.marginLevel ?? 0) > 200 ? "text-yellow-400" : "text-neon-red";

  // Use openRisk from backend if available, otherwise calculate from balance
  const displayRisk = accountInfo.openRisk ?? (accountInfo.balance * riskPercent / 100);

  return (
    <div className="glass p-4 border-accent-gold/10 shadow-[0_0_20px_rgba(0,0,0,0.8)] rounded-xl">
      <div className="flex flex-col md:flex-row items-center md:items-center gap-6 md:gap-8">
        
        {/* Left: Holographic Account Ring (Enlarged) */}
        <div className="relative w-48 h-48 flex-shrink-0">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 192 192">
            <defs>
              <linearGradient id="ao-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#39FF88" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#39FF88" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {/* Outer ring */}
            <circle cx="96" cy="96" r="92" fill="none" stroke="rgba(57,255,136,0.15)" strokeWidth="1" />
            <circle cx="96" cy="96" r="92" fill="none" stroke="url(#ao-gold)" strokeWidth="1.5" 
                    strokeDasharray="300 500" strokeLinecap="round"
                    className="animate-[spin-slow_20s_linear_infinite]"
                    style={{ transformOrigin: 'center' }} />
            {/* Inner ring */}
            <circle cx="96" cy="96" r="82" fill="none" stroke="rgba(57,255,136,0.05)" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="96" cy="96" r="82" fill="none" 
                    stroke={accountInfo.profit >= 0 ? "#39FF88" : "#FF3864"} 
                    strokeWidth="2.5" strokeDasharray="200 400" strokeLinecap="round"
                    className="animate-[spin-slow_15s_linear_infinite_reverse]"
                    style={{ transformOrigin: 'center' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
            <p className="text-[10px] font-mono text-neon-green/70 uppercase tracking-[0.25em] mb-1.5">Account</p>
            <p className="text-xs font-bold text-neon-green font-mono tracking-wider drop-shadow-[0_0_8px_rgba(57,255,136,0.6)] whitespace-nowrap">
              {accountInfo.name || `USR_${accountInfo.login}`}
            </p>
            <p className="text-[9px] font-mono text-gray-500 mt-1.5 truncate w-full">{accountInfo.server}</p>
          </div>
        </div>

        {/* Right: All Metrics Container */}
        <div className="flex-1 flex flex-wrap items-center gap-x-6 gap-y-4 w-full">
          
          {/* Balance & Equity */}
          <div className="flex items-center gap-6 px-5 py-3 rounded-lg border border-neon-green/10 bg-black/40 flex-shrink-0">
            <div>
              <span className="text-[9px] uppercase tracking-[0.15em] text-neon-green block mb-1">Balance</span>
              <span className="text-2xl font-mono font-bold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">
                {formatMoney(accountInfo.balance, accountInfo.currency)}
              </span>
            </div>
            <div className="w-px h-10 bg-neon-green/10" />
            <div>
              <span className="text-[9px] uppercase tracking-[0.15em] text-neon-green block mb-1">Equity</span>
              <span className="text-xl font-mono font-bold text-neon-green drop-shadow-[0_0_4px_rgba(57,255,136,0.3)]">
                {formatMoney(accountInfo.equity, accountInfo.currency)}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-neon-green/20 to-transparent mx-2" />

          {/* Floating P&L */}
          <div className={`px-5 py-3 rounded-lg border ${pnlBg} shadow-[0_0_15px_rgba(57,255,136,0.15)] flex-shrink-0`}>
            <span className="text-[9px] uppercase tracking-widest text-gray-400 block mb-1">Floating P&L</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-mono font-bold ${pnlColor} drop-shadow-[0_0_10px_currentColor]`}>
                {accountInfo.profit >= 0 ? "+" : ""}{formatMoney(accountInfo.profit, accountInfo.currency)}
              </span>
            </div>
          </div>

          {/* Daily & Weekly P&L */}
          <div className="flex items-center gap-5 px-5 py-3 rounded-lg border border-neon-green/10 bg-black/40 flex-shrink-0">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-gray-400 block mb-1">Daily</span>
              <span className={`text-sm font-mono font-bold ${dailyColor} drop-shadow-[0_0_4px_currentColor]`}>
                {accountInfo.dailyPnL >= 0 ? "+" : ""}{formatMoney(accountInfo.dailyPnL, accountInfo.currency)}
              </span>
            </div>
            <div className="w-px h-8 bg-neon-green/10" />
            <div>
              <span className="text-[9px] uppercase tracking-widest text-gray-400 block mb-1">Weekly</span>
              <span className={`text-sm font-mono font-bold ${(accountInfo.weeklyPnL ?? 0) >= 0 ? "text-neon-green" : "text-neon-red"} drop-shadow-[0_0_4px_currentColor]`}>
                {(accountInfo.weeklyPnL ?? 0) >= 0 ? "+" : ""}{formatMoney(accountInfo.weeklyPnL ?? 0, accountInfo.currency)}
              </span>
            </div>
          </div>

          {/* Risk & Winrate */}
          <div className="flex items-center gap-5 px-5 py-3 rounded-lg border border-neon-green/10 bg-black/40 flex-shrink-0">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-gray-400 block mb-1">Risk</span>
              <span className="text-sm font-mono font-bold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">
                {formatMoney(displayRisk, accountInfo.currency)}
              </span>
            </div>
            <div className="w-px h-8 bg-neon-green/10" />
            <div>
              <span className="text-[9px] uppercase tracking-widest text-gray-400 block mb-1">Winrate</span>
              <span className="text-sm font-mono font-bold text-neon-green drop-shadow-[0_0_4px_rgba(57,255,136,0.3)]">
                {((accountInfo.winRate || 0)).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Margin & Margin Level */}
          <div className="flex items-center gap-5 px-5 py-3 rounded-lg border border-neon-green/10 bg-black/40 flex-shrink-0">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-gray-400 block mb-1">Margin</span>
              <span className="text-sm font-mono font-bold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">
                {formatMoney(accountInfo.margin, accountInfo.currency)}
              </span>
            </div>
            <div className="w-px h-8 bg-neon-green/10" />
            <div>
              <span className="text-[9px] uppercase tracking-widest text-gray-400 block mb-1">Level</span>
              <span className={`text-sm font-mono font-bold ${marginHealth} drop-shadow-[0_0_4px_currentColor]`}>
                {(accountInfo.marginLevel ?? 0).toFixed(0)}%
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount == null || isNaN(amount)) return "$0.00";
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${formatted}`;
}

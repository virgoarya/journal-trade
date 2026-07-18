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

  const pnlColor = accountInfo.profit >= 0 ? "text-neon-green" : "text-neon-red";
  const pnlBg = accountInfo.profit >= 0 ? "bg-neon-green/10 border-neon-green/20" : "bg-neon-red/10 border-neon-red/20";
  const dailyColor = accountInfo.dailyPnL >= 0 ? "text-neon-green" : "text-neon-red";

  const riskPercent = Math.min((accountInfo.openRisk / (accountInfo.balance || 1)) * 100, 10);
  const marginHealth = accountInfo.marginLevel > 500 ? "text-neon-green" : accountInfo.marginLevel > 200 ? "text-yellow-400" : "text-neon-red";

  return (
    <div className="hud-panel p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        
        {/* Left: Balance Ring + Identity */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Mini holographic ring */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="ao-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#8B7722" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              {/* Outer ring */}
              <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(212,175,55,0.15)" strokeWidth="1.5" />
              <circle cx="32" cy="32" r="30" fill="none" stroke="url(#ao-gold)" strokeWidth="2" 
                      strokeDasharray="120 189" strokeLinecap="round"
                      className="animate-[spin-slow_15s_linear_infinite]"
                      style={{ transformOrigin: 'center' }} />
              {/* Inner ring */}
              <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(212,175,55,0.1)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx="32" cy="32" r="22" fill="none" 
                      stroke={accountInfo.profit >= 0 ? "#39FF88" : "#FF3864"} 
                      strokeWidth="2" strokeDasharray="60 138" strokeLinecap="round"
                      className="animate-[spin-slow_10s_linear_infinite_reverse]"
                      style={{ transformOrigin: 'center' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="w-5 h-5 text-accent-gold drop-shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
            </div>
          </div>

          {/* Account name */}
          <div>
            <p className="text-[9px] font-mono text-accent-gold-dim uppercase tracking-widest mb-0.5">Account</p>
            <p className="text-sm font-bold text-accent-gold font-mono tracking-wider">
              {accountInfo.name || `USR_${accountInfo.login}`}
            </p>
            <p className="text-[9px] font-mono text-text-muted">{accountInfo.server}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-accent-gold/20 to-transparent" />

        {/* Center: Balance & Equity */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <div>
              <span className="text-[9px] uppercase tracking-[0.15em] text-accent-gold-dim block mb-0.5">Balance</span>
              <span className="text-2xl font-mono font-bold text-text-primary drop-shadow-[0_0_6px_rgba(255,255,255,0.15)]">
                {formatMoney(accountInfo.balance, accountInfo.currency)}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-[0.15em] text-accent-gold-dim block mb-0.5">Equity</span>
              <span className="text-lg font-mono font-semibold text-accent-gold">
                {formatMoney(accountInfo.equity, accountInfo.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-accent-gold/20 to-transparent" />

        {/* Right: P&L and Risk metrics */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Floating P&L */}
          <div className={`px-3 py-2 rounded-lg border ${pnlBg}`}>
            <span className="text-[8px] uppercase tracking-widest text-text-muted block mb-0.5">Floating P&L</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-mono font-bold ${pnlColor} drop-shadow-[0_0_6px_currentColor]`}>
                {accountInfo.profit >= 0 ? "+" : ""}{formatMoney(accountInfo.profit, accountInfo.currency)}
              </span>
            </div>
          </div>

          {/* Daily P&L */}
          <div className="px-3 py-2 rounded-lg border border-accent-gold/10 bg-black/30">
            <span className="text-[8px] uppercase tracking-widest text-text-muted block mb-0.5">Daily</span>
            <span className={`text-sm font-mono font-bold ${dailyColor}`}>
              {accountInfo.dailyPnL >= 0 ? "+" : ""}{formatMoney(accountInfo.dailyPnL, accountInfo.currency)}
            </span>
          </div>

          {/* Risk & Margin */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-accent-gold/10 bg-black/30">
            <div>
              <span className="text-[8px] uppercase tracking-widest text-text-muted block mb-0.5">Risk</span>
              <span className="text-xs font-mono text-text-primary">{formatMoney(accountInfo.openRisk, accountInfo.currency)}</span>
            </div>
            <div className="w-px h-6 bg-accent-gold/10" />
            <div>
              <span className="text-[8px] uppercase tracking-widest text-text-muted block mb-0.5">Margin</span>
              <span className={`text-xs font-mono font-bold ${marginHealth}`}>{accountInfo.marginLevel.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(amount: number, currency = "USD"): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${formatted}`;
}

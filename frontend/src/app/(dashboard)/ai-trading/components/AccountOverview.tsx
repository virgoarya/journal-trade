"use client";

import { type ACCOUNTInfo } from "@/services/ai-trading.service";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Percent,
  DollarSign,
  Activity,
} from "lucide-react";

interface AccountOverviewProps {
  accountInfo: ACCOUNTInfo | null;
  isLoading: boolean;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-white",
  subColor = "text-gray-400",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider">
            {label}
          </p>
          <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
        </div>
        <div className="p-2 bg-gray-800 rounded-lg">
          <Icon className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

export function AccountOverview({
  accountInfo,
  isLoading,
}: AccountOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse"
          >
            <div className="h-3 w-16 bg-gray-800 rounded mb-3" />
            <div className="h-6 w-24 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!accountInfo) return null;

  const marginLevelColor =
    accountInfo.marginLevel > 200
      ? "text-green-400"
      : accountInfo.marginLevel > 100
        ? "text-yellow-400"
        : "text-red-400";

  const pnlColor =
    accountInfo.profit >= 0 ? "text-green-400" : "text-red-400";
  const dailyPnlColor =
    accountInfo.dailyPnL >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* Account header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {accountInfo.name || `Account #${accountInfo.login}`}
          </h2>
          <p className="text-sm text-gray-500">
            {accountInfo.server} · {accountInfo.currency} · Leverage{" "}
            {accountInfo.leverage}:1
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={Wallet}
          label="Balance"
          value={formatMoney(accountInfo.balance, accountInfo.currency)}
          sub={
            accountInfo.equity !== accountInfo.balance
              ? `Equity: ${formatMoney(accountInfo.equity, accountInfo.currency)}`
              : undefined
          }
        />
        <MetricCard
          icon={BarChart3}
          label="Margin"
          value={formatMoney(accountInfo.margin, accountInfo.currency)}
          sub={`Free: ${formatMoney(accountInfo.freeMargin, accountInfo.currency)}`}
        />
        <MetricCard
          icon={Percent}
          label="Margin Level"
          value={`${accountInfo.marginLevel.toFixed(2)}%`}
          color={marginLevelColor}
          sub={`Open: ${accountInfo.openPositions} positions`}
        />
        <MetricCard
          icon={Activity}
          label="Daily P&L"
          value={formatMoney(accountInfo.dailyPnL, accountInfo.currency)}
          color={dailyPnlColor}
        />
      </div>

      {/* Additional row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          icon={TrendingUp}
          label="Open Risk"
          value={formatMoney(accountInfo.openRisk, accountInfo.currency)}
        />
        <MetricCard
          icon={accountInfo.profit >= 0 ? TrendingUp : TrendingDown}
          label="Floating P&L"
          value={formatMoney(accountInfo.profit, accountInfo.currency)}
          color={pnlColor}
        />
        <MetricCard
          icon={DollarSign}
          label="Daily Drawdown"
          value={formatMoney(accountInfo.dailyDrawdown, accountInfo.currency)}
          color={
            accountInfo.dailyDrawdown > 0 ? "text-red-400" : "text-gray-400"
          }
        />
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

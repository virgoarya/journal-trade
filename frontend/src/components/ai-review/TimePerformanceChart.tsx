"use client";

import { Clock, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  data: Array<{
    hour: number;
    symbol: string;
    count: number;
    winRate: number;
    avgR: number;
  }>;
}

// Group by hour and aggregate win rate across all symbols
function groupByHour(data: Props["data"]) {
  const hourMap: Record<number, { totalTrades: number; totalWins: number; symbols: string[] }> = {};
  
  for (const item of data) {
    if (!hourMap[item.hour]) {
      hourMap[item.hour] = { totalTrades: 0, totalWins: 0, symbols: [] };
    }
    hourMap[item.hour].totalTrades += item.count;
    hourMap[item.hour].totalWins += Math.round((item.winRate / 100) * item.count);
    if (!hourMap[item.hour].symbols.includes(item.symbol)) {
      hourMap[item.hour].symbols.push(item.symbol);
    }
  }

  return Array.from({ length: 24 }, (_, i) => {
    const h = hourMap[i];
    if (!h || h.totalTrades === 0) {
      return { hour: i, winRate: 0, count: 0, isHigh: false, isLow: false };
    }
    const wr = (h.totalWins / h.totalTrades) * 100;
    return {
      hour: i,
      winRate: Math.round(wr * 10) / 10,
      count: h.totalTrades,
      isHigh: wr >= 60,
      isLow: wr < 40 && h.totalTrades >= 5,
    };
  });
}

export function TimePerformanceChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-panel p-6 border border-white/5">
        <h3 className="text-sm font-medium text-white/50 mb-4">Jam vs Win Rate (NY Time)</h3>
        <p className="text-xs text-white/30 italic">Tidak ada data waktu yang cukup</p>
      </div>
    );
  }

  const hourlyData = groupByHour(data);
  const maxTrades = Math.max(...hourlyData.map(h => h.count));
  const avgWinRate = hourlyData.filter(h => h.count > 0).reduce((sum, h) => sum + h.winRate, 0) / hourlyData.filter(h => h.count > 0).length || 0;

  return (
    <div className="glass-panel p-6 border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent-gold" />
          <h3 className="text-sm font-medium text-white/80">Jam vs Win Rate</h3>
        </div>
        <span className="text-[10px] text-white/40">NY Time (UTC-4)</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[10px] text-white/40">≥ 60%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-white/40">&lt; 40%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-accent-gold" />
          <span className="text-[10px] text-white/40">Avg: {avgWinRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-[2px] h-32">
        {hourlyData.map((h) => {
          const height = maxTrades > 0 ? (h.count / maxTrades) * 100 : 0;
          const color = h.isHigh ? "bg-green-500" : h.isLow ? "bg-red-500" : "bg-white/20";
          
          return (
            <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-black/90 border border-white/10 rounded px-2 py-1 text-[10px] whitespace-nowrap">
                  <div className="text-white/80">{h.hour}:00 NY</div>
                  <div className={h.winRate >= 50 ? "text-green-400" : "text-red-400"}>
                    {h.winRate}% win rate
                  </div>
                  <div className="text-white/40">{h.count} trades</div>
                </div>
              </div>
              
              {/* Bar */}
              <div
                className={`w-full rounded-t transition-all duration-300 hover:opacity-80 ${color}`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              
              {/* Hour label (every 6 hours) */}
              {h.hour % 6 === 0 && (
                <span className="text-[8px] text-white/30 mt-1">{h.hour}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-white/50">Best:</span>
            <span className="text-green-400">
              {hourlyData.filter(h => h.isHigh).map(h => `${h.hour}:00`).join(", ") || "None"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400" />
            <span className="text-white/50">Avoid:</span>
            <span className="text-red-400">
              {hourlyData.filter(h => h.isLow).map(h => `${h.hour}:00`).join(", ") || "None"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
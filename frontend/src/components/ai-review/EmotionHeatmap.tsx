"use client";

import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  data: Array<{
    emotionTag: string;
    count: number;
    winRate: number;
    avgR: number;
    totalPnL: number;
  }>;
}

const emotionColors: Record<string, string> = {
  FOMO: "text-yellow-500",
  REVENGE: "text-red-500",
  GREEDY: "text-orange-500",
  FEAR: "text-gray-400",
  CONFIDENT: "text-green-500",
  CALM: "text-blue-500",
  HESITANT: "text-purple-500",
};

const emotionBg: Record<string, string> = {
  FOMO: "bg-yellow-500/10 border-yellow-500/20",
  REVENGE: "bg-red-500/10 border-red-500/20",
  GREEDY: "bg-orange-500/10 border-orange-500/20",
  FEAR: "bg-gray-400/10 border-gray-400/20",
  CONFIDENT: "bg-green-500/10 border-green-500/20",
  CALM: "bg-blue-500/10 border-blue-500/20",
  HESITANT: "bg-purple-500/10 border-purple-500/20",
};

export function EmotionHeatmap({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-panel p-6 border border-white/5">
        <h3 className="text-sm font-medium text-white/50 mb-4">Emosi vs Win Rate</h3>
        <p className="text-xs text-white/30 italic">Tidak ada data emosi yang cukup</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="glass-panel p-6 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-accent-gold" />
        <h3 className="text-sm font-medium text-white/80">Emosi vs Win Rate</h3>
      </div>
      
      <div className="space-y-2">
        {data.map((item) => {
          const intensity = maxCount > 0 ? item.count / maxCount : 0;
          const isProfit = item.totalPnL > 0;
          
          return (
            <div
              key={item.emotionTag}
              className={`p-3 rounded-lg border ${emotionBg[item.emotionTag] || "bg-white/5 border-white/10"} transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${emotionColors[item.emotionTag] || "text-white/60"}`}>
                  {item.emotionTag}
                </span>
                <span className="text-[10px] text-white/40">{item.count} trades</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isProfit ? "bg-green-500" : "bg-red-500"
                      }`}
                      style={{ width: `${item.winRate}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs font-mono ${isProfit ? "text-green-400" : "text-red-400"}`}>
                  {item.winRate.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-white/30">
                  Avg R: <span className={item.avgR > 0 ? "text-green-400" : "text-red-400"}>{item.avgR > 0 ? "+" : ""}{item.avgR}</span>
                </span>
                <span className={`text-[10px] font-medium ${isProfit ? "text-green-400" : "text-red-400"}`}>
                  {isProfit ? "+" : ""}{item.totalPnL.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
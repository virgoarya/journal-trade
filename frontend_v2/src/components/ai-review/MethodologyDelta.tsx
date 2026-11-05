"use client";

import { Scale, ArrowUp, ArrowDown, Minus, AlertTriangle } from "lucide-react";

interface Props {
  data: Array<{
    methodology: string;
    backtestWR: number;
    realWR: number;
    delta: number;
    recommendation: string;
  }>;
}

const recommendationConfig: Record<string, { color: string; icon: any; label: string }> = {
  INCREASE_WEIGHT: { color: "text-green-400 bg-green-500/10 border-green-500/20", icon: ArrowUp, label: "Tingkatkan" },
  MAINTAIN: { color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Minus, label: "Pertahankan" },
  DECREASE_WEIGHT: { color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: ArrowDown, label: "Kurangi" },
  DISABLE: { color: "text-red-400 bg-red-500/10 border-red-500/20", icon: AlertTriangle, label: "Nonaktifkan" },
};

export function MethodologyDelta({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-panel p-6 border border-white/5">
        <h3 className="text-sm font-medium text-white/50 mb-4">Methodology: Backtest vs Real</h3>
        <p className="text-xs text-white/30 italic">Tidak ada data methodology yang cukup</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="w-4 h-4 text-accent-gold" />
        <h3 className="text-sm font-medium text-white/80">Methodology: Backtest vs Real</h3>
      </div>

      <div className="space-y-3">
        {data.map((item) => {
          const config = recommendationConfig[item.recommendation] || recommendationConfig.MAINTAIN;
          const Icon = config.icon;
          const isPositive = item.delta > 0;

          return (
            <div key={item.methodology} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white/80">{item.methodology}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${config.color}`}>
                  <Icon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>

              {/* Progress bars */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-16">Backtest</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-gold/60 rounded-full" style={{ width: `${item.backtestWR}%` }} />
                  </div>
                  <span className="text-[10px] text-accent-gold font-mono w-10 text-right">{item.backtestWR}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-16">Real</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isPositive ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${item.realWR}%` }} />
                  </div>
                  <span className={`text-[10px] font-mono w-10 text-right ${isPositive ? "text-green-400" : "text-red-400"}`}>{item.realWR}%</span>
                </div>
              </div>

              {/* Delta badge */}
              <div className="mt-2 flex items-center justify-end">
                <span className={`text-[10px] font-mono font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}>
                  Delta: {isPositive ? "+" : ""}{item.delta}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
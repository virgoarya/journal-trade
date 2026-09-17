"use client";

import { Brain, CheckCircle2, AlertTriangle, Zap, ArrowRight } from "lucide-react";

interface Props {
  data: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    actionItems: Array<{
      priority: "high" | "medium" | "low";
      action: string;
      reason: string;
    }>;
  };
}

const priorityConfig = {
  high: { color: "text-red-400 bg-red-500/10 border-red-500/20", icon: AlertTriangle },
  medium: { color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Zap },
  low: { color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: CheckCircle2 },
};

export function InsightCards({ data }: Props) {
  if (!data || !data.summary) {
    return (
      <div className="glass-panel p-6 border border-white/5">
        <h3 className="text-sm font-medium text-white/50 mb-4">AI Insights</h3>
        <p className="text-xs text-white/30 italic">Analisis AI tidak tersedia</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-accent-gold" />
        <h3 className="text-sm font-medium text-white/80">AI Insights</h3>
      </div>

      {/* Summary */}
      <div className="mb-4 p-3 rounded-lg bg-accent-gold/5 border border-accent-gold/20">
        <p className="text-xs text-white/70 leading-relaxed">{data.summary}</p>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Strengths */}
        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
          <div className="flex items-center gap-1 mb-2">
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-medium text-green-400">Kekuatan</span>
          </div>
          <ul className="space-y-1">
            {data.strengths.length > 0 ? data.strengths.map((s, i) => (
              <li key={i} className="text-[10px] text-white/60 leading-relaxed">• {s}</li>
            )) : (
              <li className="text-[10px] text-white/30 italic">Tidak ada data</li>
            )}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-1 mb-2">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] font-medium text-red-400">Kelemahan</span>
          </div>
          <ul className="space-y-1">
            {data.weaknesses.length > 0 ? data.weaknesses.map((w, i) => (
              <li key={i} className="text-[10px] text-white/60 leading-relaxed">• {w}</li>
            )) : (
              <li className="text-[10px] text-white/30 italic">Tidak ada data</li>
            )}
          </ul>
        </div>
      </div>

      {/* Action Items */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <ArrowRight className="w-3 h-3 text-accent-gold" />
          <span className="text-[10px] font-medium text-white/60">Rekomendasi Tindakan</span>
        </div>
        <div className="space-y-2">
          {data.actionItems.length > 0 ? data.actionItems.map((item, i) => {
            const config = priorityConfig[item.priority] || priorityConfig.low;
            const Icon = config.icon;
            return (
              <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 p-1 rounded ${config.color}`}>
                    <Icon className="w-2.5 h-2.5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-[11px] text-white/80">{item.action}</p>
                    {item.reason && (
                      <p className="text-[10px] text-white/40 mt-0.5">Bukti: {item.reason}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (
            <p className="text-[10px] text-white/30 italic">Tidak ada rekomendasi</p>
          )}
        </div>
      </div>
    </div>
  );
}
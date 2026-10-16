"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { journalService, type PatternData } from "@/services/journal.service";
import { EmotionHeatmap } from "./EmotionHeatmap";
import { TimePerformanceChart } from "./TimePerformanceChart";
import { MethodologyDelta } from "./MethodologyDelta";
import { InsightCards } from "./InsightCards";

interface Props {
  isRefreshing?: boolean;
}

export default function PatternsTab({ isRefreshing = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PatternData | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("month");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await journalService.getPatterns(period);
      
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "Gagal memuat data patterns");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  // Auto-refresh when parent triggers
  useEffect(() => {
    if (isRefreshing) fetchData();
  }, [isRefreshing]);

  if (loading && !data) {
    return (
      <div className="glass-panel p-8 border border-white/5">
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
          <span className="text-sm text-white/50">Menganalisis trading journal...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 border border-red-500/20">
        <div className="flex flex-col items-center justify-center gap-3">
          <span className="text-sm text-red-400">{error}</span>
          <button
            onClick={fetchData}
            className="text-xs text-accent-gold hover:text-accent-gold/80 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector & Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Periode:</span>
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setPeriod("week")}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                period === "week" ? "bg-accent-gold/20 text-accent-gold" : "text-white/40 hover:text-white/60"
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                period === "month" ? "bg-accent-gold/20 text-accent-gold" : "text-white/40 hover:text-white/60"
              }`}
            >
              30 Hari
            </button>
          </div>
        </div>
        
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-white/50 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <EmotionHeatmap data={data?.emotionPatterns || []} />
          <MethodologyDelta data={data?.methodologyDelta || []} />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          <TimePerformanceChart data={data?.timePatterns || []} />
          <InsightCards data={data?.llmInsights || { summary: "", strengths: [], weaknesses: [], actionItems: [] }} />
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback } from "react";
import { aiTradingService, type AIBacktestSkill } from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Layers,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Shield,
  Target,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface SkillDisplayProps {
  onApplySkill?: (skill: AIBacktestSkill) => void;
}

export function SkillDisplay({ onApplySkill }: SkillDisplayProps) {
  const [skill, setSkill] = useState<AIBacktestSkill | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSymbols, setShowSymbols] = useState(true);
  const [showMethodologies, setShowMethodologies] = useState(true);

  const fetchSkill = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiTradingService.getSkill();
      if (res.success && res.data) setSkill(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkill();
  }, [fetchSkill]);

  const handleApply = () => {
    if (skill && onApplySkill) {
      onApplySkill(skill);
      toast.success("AI Skill applied to pipeline configuration");
    }
  };

  if (loading) {
    return <SkeletonLoader type="card" />;
  }

  if (!skill || (!skill.symbolRankings?.length && !skill.methodologyRankings?.length)) {
    return (
      <EmptyState
        type="data"
        title="No AI Skill Data"
        description="No AI backtest skill data available yet. Run a manual backtest to build AI skill."
      />
    );
  }

  const userHasData = skill && (skill.symbolRankings?.length > 0 || skill.methodologyRankings?.length > 0);

  return (
    <div className="glass p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-accent-gold/20 pb-3">
        <h3 className="text-[11px] font-bold text-accent-gold uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          <Sparkles className="w-4 h-4 text-accent-gold" />
          AI Backtest Skill
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={fetchSkill} disabled={loading} className="text-text-muted hover:text-accent-gold transition p-1" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {skill && skill.totalBacktests > 0 && (
            <span className="text-[10px] text-accent-gold-dim bg-bg-input border border-accent-gold/20 px-2 py-0.5 rounded font-mono">
              {skill.totalBacktests} tests
            </span>
          )}
        </div>
      </div>

      {/* No data state */}
      {!userHasData && !loading && (
        <div className="text-[10px] text-text-muted text-center py-3 leading-relaxed font-mono italic">
          No backtest data yet.<br />
          Run a manual backtest to build AI skill.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      )}

      {/* Symbol Rankings */}
      {skill && skill.symbolRankings && skill.symbolRankings.length > 0 && (
        <div className="pt-2 border-t border-accent-gold/10">
          <button
            onClick={() => setShowSymbols(!showSymbols)}
            className="flex items-center justify-between w-full text-[10px] font-bold text-accent-gold-dim uppercase tracking-widest mb-2 hover:text-accent-gold transition"
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Symbol Rankings
            </span>
            {showSymbols ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showSymbols && (
            <div className="space-y-1.5">
              {skill.symbolRankings.slice(0, 6).map((s, i) => {
                const rankColor = i === 0 ? "text-accent-gold drop-shadow-[0_0_4px_rgba(212,175,55,0.6)]" : i === 1 ? "text-text-secondary" : i === 2 ? "text-orange-400" : "text-text-muted";
                const isQualified = s.score >= 50;
                return (
                  <div key={s.symbol} className="bg-bg-input border border-accent-gold/10 rounded px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-bold ${rankColor}`}>#{i + 1}</span>
                        <span className="text-[11px] font-bold text-text-primary font-mono">{s.symbol}</span>
                        {isQualified ? (
                          <CheckCircle className="w-2.5 h-2.5 text-neon-green" />
                        ) : (
                          <AlertCircle className="w-2.5 h-2.5 text-text-muted" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-accent-gold-dim font-mono">{s.totalTrades}t</span>
                        <span className={`text-[9px] font-bold font-mono ${s.totalPnL >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                          {s.totalPnL >= 0 ? "+" : ""}${s.totalPnL.toFixed(0)}
                        </span>
                        <span className={`text-[10px] font-bold font-mono px-1 rounded ${s.score >= 70 ? "bg-neon-green/10 text-neon-green border border-neon-green/30" : s.score >= 50 ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30" : "bg-neon-red/10 text-neon-red border border-neon-red/30"}`}>
                          {s.score}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 text-[9px] text-text-muted mt-1 font-mono uppercase tracking-wider">
                      <span>{s.avgWinRate.toFixed(1)}% WR</span>
                      <span className="opacity-50">|</span>
                      <span>{s.avgProfitFactor.toFixed(2)} PF</span>
                      <span className="opacity-50">|</span>
                      <span className="truncate">BEST: {s.bestMethodology}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}




    </div>
  );
}

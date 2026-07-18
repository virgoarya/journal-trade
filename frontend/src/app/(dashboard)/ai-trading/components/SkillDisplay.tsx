"use client";

import { useState, useEffect, useCallback } from "react";
import {
  aiTradingService,
  type AIBacktestSkill,
  type AutoBacktestSummary,
} from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import {
  Zap,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Layers,
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
  const [autoScanning, setAutoScanning] = useState(false);
  const [autoSummary, setAutoSummary] = useState<AutoBacktestSummary | null>(null);
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

  const handleAutoScan = async () => {
    setAutoScanning(true);
    setAutoSummary(null);
    toast.info("AI Auto-Scan started — this may take several minutes...");

    try {
      const res = await aiTradingService.autoBacktest();
      if (res.success && res.data) {
        setAutoSummary(res.data);
        if (res.data.status === "complete") {
          toast.success(`Scan complete! ${res.data.qualifiedSymbols}/${res.data.totalSymbols} pairs qualified`);
          // Refresh skill data
          fetchSkill();
        } else {
          toast.error(res.data.error || "Auto scan failed");
        }
      } else {
        toast.error(res.error || "Auto backtest failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Auto backtest error");
    } finally {
      setAutoScanning(false);
    }
  };

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
        description="No AI backtest skill data available yet."
        actionText="Run Auto-Scan"
        onAction={handleAutoScan}
      />
    );
  }

  const userHasData = skill && (skill.symbolRankings?.length > 0 || skill.methodologyRankings?.length > 0);

  return (
    <div className="hud-panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-accent-gold/20 pb-2">
        <h3 className="text-[11px] font-bold text-accent-gold uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          <Sparkles className="w-4 h-4 text-accent-gold" />
          AI Backtest Skill
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={fetchSkill} disabled={loading} className="text-text-muted hover:text-accent-gold transition p-1" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {skill && skill.totalBacktests > 0 && (
            <span className="text-[10px] text-accent-gold-dim bg-black/40 border border-accent-gold/20 px-2 py-0.5 rounded font-mono">
              {skill.totalBacktests} tests
            </span>
          )}
        </div>
      </div>

      {/* Auto-Scan Button */}
      <button
        onClick={handleAutoScan}
        disabled={autoScanning}
        className="w-full py-2.5 px-3 bg-black border border-accent-gold/40 hover:bg-accent-gold/10 disabled:bg-black/40 disabled:border-gray-800 disabled:text-gray-600 text-accent-gold text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all shadow-[inset_0_4px_6px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] hover:shadow-[inset_0_4px_6px_rgba(255,255,255,0.05),0_0_15px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2"
      >
        {autoScanning ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Scanning all pairs (0.5% risk)...</>
        ) : (
          <><Zap className="w-4 h-4 fill-current" /> AI Auto-Scan All Pairs</>
        )}
      </button>

      {/* Auto-Scan Progress */}
      {autoSummary && autoSummary.status === "complete" && (
        <div className="bg-neon-green/10 border border-neon-green/30 rounded p-2.5 shadow-[0_0_8px_rgba(57,255,136,0.2)]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neon-green font-bold flex items-center gap-1 uppercase tracking-wider">
              <CheckCircle className="w-3 h-3" /> Ready
            </span>
            <span className="text-neon-green/80">
              {autoSummary.qualifiedSymbols}/{autoSummary.totalSymbols} qualified
            </span>
          </div>
        </div>
      )}

      {/* No data state */}
      {!userHasData && !loading && (
        <div className="text-[10px] text-text-muted text-center py-3 leading-relaxed font-mono italic">
          No backtest data yet.<br />
          Run an auto-scan or manual backtest to build AI skill.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
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
                const rankColor = i === 0 ? "text-accent-gold drop-shadow-[0_0_4px_rgba(212,175,55,0.6)]" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-text-muted";
                const isQualified = s.score >= 50;
                return (
                  <div key={s.symbol} className="bg-black/40 border border-accent-gold/10 rounded px-2.5 py-1.5">
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



      {/* Apply button */}
      {skill && skill.symbolRankings && skill.symbolRankings.length > 0 && (
        <button
          onClick={handleApply}
          className="w-full py-3 bg-accent-gold text-black text-[10px] tracking-widest uppercase font-bold rounded-lg hover:bg-accent-gold/90 transition flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(212,175,55,0.4)] mt-2"
        >
          <Target className="w-4 h-4" />
          Apply Skill to Pipeline
        </button>
      )}
    </div>
  );
}

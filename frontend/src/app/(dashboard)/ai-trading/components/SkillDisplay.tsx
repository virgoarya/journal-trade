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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          AI Backtest Skill
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={fetchSkill} disabled={loading} className="text-gray-500 hover:text-white transition p-1" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {skill && skill.totalBacktests > 0 && (
            <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {skill.totalBacktests} tests
            </span>
          )}
        </div>
      </div>

      {/* Auto-Scan Button */}
      <button
        onClick={handleAutoScan}
        disabled={autoScanning}
        className="w-full py-2 px-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2"
      >
        {autoScanning ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Scanning all pairs (0.5% risk)...</>
        ) : (
          <><Zap className="w-4 h-4" /> AI Auto-Scan All Pairs</>
        )}
      </button>

      {/* Auto-Scan Progress */}
      {autoSummary && autoSummary.status === "complete" && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-400 font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Ready
            </span>
            <span className="text-gray-400">
              {autoSummary.qualifiedSymbols}/{autoSummary.totalSymbols} qualified
            </span>
          </div>
        </div>
      )}

      {/* No data state */}
      {!userHasData && !loading && (
        <div className="text-[10px] text-gray-500 text-center py-3 leading-relaxed">
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
        <div>
          <button
            onClick={() => setShowSymbols(!showSymbols)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              Symbol Rankings
            </span>
            {showSymbols ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showSymbols && (
            <div className="space-y-1.5">
              {skill.symbolRankings.slice(0, 6).map((s, i) => {
                const rankColor = i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-gray-500";
                const isQualified = s.score >= 50;
                return (
                  <div key={s.symbol} className="bg-gray-800/40 rounded px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-bold ${rankColor}`}>#{i + 1}</span>
                        <span className="text-xs font-semibold text-white">{s.symbol}</span>
                        {isQualified ? (
                          <CheckCircle className="w-2.5 h-2.5 text-green-400" />
                        ) : (
                          <AlertCircle className="w-2.5 h-2.5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{s.totalTrades}t</span>
                        <span className={`text-[10px] font-medium ${s.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.totalPnL >= 0 ? "+" : ""}${s.totalPnL.toFixed(0)}
                        </span>
                        <span className={`text-[10px] font-bold ${s.score >= 70 ? "text-green-400" : s.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                          {s.score}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 text-[9px] text-gray-500 mt-0.5">
                      <span>{s.avgWinRate.toFixed(1)}% WR</span>
                      <span>{s.avgProfitFactor.toFixed(2)} PF</span>
                      <span>Best: {s.bestMethodology}</span>
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
          className="w-full py-2 bg-accent-gold text-black text-xs font-semibold rounded-lg hover:bg-accent-gold/90 transition flex items-center justify-center gap-2"
        >
          <Target className="w-3.5 h-3.5" />
          Apply Skill to Pipeline
        </button>
      )}
    </div>
  );
}

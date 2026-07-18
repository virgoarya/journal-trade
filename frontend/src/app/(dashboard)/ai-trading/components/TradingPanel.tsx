"use client";

import { useAiTrading } from "../context/AiTradingContext";
import { Play, Square, Pause, Loader2, Signal, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AIBacktestSkill } from "@/services/ai-trading.service";

interface TradingPanelProps {
  pipelineRunning: boolean;
  pipelinePaused: boolean;
  isStarting: boolean;
  isStopping: boolean;
  skillConfig?: AIBacktestSkill | null;
}

export function TradingPanel({
  pipelineRunning,
  pipelinePaused,
  isStarting,
  isStopping,
  skillConfig,
}: TradingPanelProps) {
  const {
    startPipeline,
    stopPipeline,
    pausePipeline,
    resumePipeline,
    savedPipelineConfig,
    lastAutoBacktestAt,
    pipelineStatus,
    llmMinProviders,
    llmModels,
  } = useAiTrading();

  const handleStart = async () => {
    if (!savedPipelineConfig) {
      toast.error("No backtest configuration applied. Please run a backtest first.");
      return;
    }
    await startPipeline({ useAppliedConfig: true } as any);
  };

  const displayConfig = pipelineRunning || pipelinePaused ? pipelineStatus?.config : savedPipelineConfig;

  // Force LLM to be always active
  const isLlmActive = true;

  const minProviders = pipelineRunning || pipelinePaused 
    ? displayConfig?.llmConsensus?.minProviders 
    : llmMinProviders;

  // Calculate overall grade based on selected symbols
  const getOverallGrade = () => {
    if (!skillConfig || !skillConfig.symbolRankings || skillConfig.symbolRankings.length === 0) return null;
    if (!displayConfig || !displayConfig.symbols || displayConfig.symbols.length === 0) return null;
    
    // Normalize symbols by stripping .i, .a etc (e.g. BTCUSD.i -> BTCUSD)
    const normalizeSym = (s: string) => s.split('.')[0].toUpperCase();
    const displaySyms = displayConfig.symbols.map(normalizeSym);
    
    // Filter rankings for selected symbols
    const selectedRankings = skillConfig.symbolRankings.filter(r => displaySyms.includes(normalizeSym(r.symbol)));
    if (selectedRankings.length === 0) return { grade: "UNRATED" };
    
    const avgWinRate = selectedRankings.reduce((sum, r) => sum + r.avgWinRate, 0) / selectedRankings.length;
    const avgProfitFactor = selectedRankings.reduce((sum, r) => sum + r.avgProfitFactor, 0) / selectedRankings.length;
    const avgRecovery = selectedRankings.reduce((sum, r) => sum + (r.avgRecoveryFactor || 0), 0) / selectedRankings.length;
    const totalTrades = selectedRankings.reduce((sum, r) => sum + r.totalTrades, 0);
    
    let score = 0;
    
    // Win Rate (max 2)
    if (avgWinRate >= 60) score += 2;
    else if (avgWinRate >= 45) score += 1;
    
    // Profit Factor (max 2)
    if (avgProfitFactor >= 2.0) score += 2;
    else if (avgProfitFactor >= 1.5) score += 1;
    
    // Recovery Factor (Proxy for Drawdown/Sharpe) (max 2)
    if (avgRecovery >= 3.0) score += 2;
    else if (avgRecovery >= 1.5) score += 1;
    
    // Total Trades (max 2)
    if (totalTrades >= 50) score += 2;
    else if (totalTrades >= 20) score += 1;
    
    if (score >= 6) return { grade: "A", color: "text-green-400 border-green-400/30 bg-green-400/10" };
    if (score >= 4) return { grade: "B", color: "text-blue-400 border-blue-400/30 bg-blue-400/10" };
    if (score >= 2) return { grade: "C", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" };
    if (score >= 1) return { grade: "D", color: "text-orange-400 border-orange-400/30 bg-orange-400/10" };
    return { grade: "F", color: "text-red-400 border-red-400/30 bg-red-400/10" };
  };

  const gradeInfo = getOverallGrade();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Signal className="w-4 h-4 text-accent-gold" />
          Live Trading Panel
        </h3>
        <div className="flex items-center gap-2">
          {gradeInfo && gradeInfo.grade !== "UNRATED" && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${gradeInfo.color}`} title="AI Config Grade">
              Grade {gradeInfo.grade}
            </span>
          )}
          {(pipelineRunning || pipelinePaused) && (
            <span className="text-[10px] uppercase tracking-widest bg-accent-gold/20 text-accent-gold px-2 py-1 rounded font-semibold">
              Active
            </span>
          )}
        </div>
      </div>

      {displayConfig ? (
        <div className="space-y-4 text-sm text-gray-300">
          <div className="grid grid-cols-2 gap-4 bg-gray-950/50 p-3 rounded-lg border border-gray-800/80">
            <div className="col-span-2">
              <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Trading Pairs</p>
              <div className="flex flex-wrap gap-1.5">
                {(displayConfig.symbols || []).map((s: string) => (
                  <span key={s} className="bg-gray-800 border border-gray-700 text-xs px-2 py-1 rounded text-white font-medium shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Timeframe</p>
              <p className="font-mono text-white bg-gray-800/50 inline-block px-2 py-0.5 rounded">{displayConfig.timeframe || "M15"}</p>
            </div>
            
            <div>
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Risk / Trade</p>
              <p className="font-mono text-white bg-gray-800/50 inline-block px-2 py-0.5 rounded">{displayConfig.maxRiskPerTrade || 1.0}%</p>
            </div>
            
            <div>
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Max Positions</p>
              <p className="font-mono text-white bg-gray-800/50 inline-block px-2 py-0.5 rounded">{displayConfig.maxOpenPositions || 3}</p>
            </div>

            <div>
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Daily Risk Limit</p>
              <p className="font-mono text-white bg-gray-800/50 inline-block px-2 py-0.5 rounded">{displayConfig.maxDailyRisk || 3.0}%</p>
            </div>

            <div className="col-span-2 pt-3 border-t border-gray-800/50">
               <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Active AI Methodologies</p>
               <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set((displayConfig.activeMethodologies || []).map((m: string) => {
                  const mLower = m.toLowerCase();
                  if (["ictcrt", "crt", "ict-crt"].includes(mLower)) return "ICT";
                  return m.toUpperCase();
                }).filter((m: string) => ["SMC", "ICT", "MSNR"].includes(m)))).map((m: string, idx: number) => {
                  const mRank = skillConfig?.methodologyRankings?.find(
                    (rank) => rank.methodology.toLowerCase() === m.toLowerCase()
                  );
                  const verdict = mRank?.verdict;
                  let bgClass = "bg-accent-gold/10";
                  let borderClass = "border-accent-gold/20";
                  let textClass = "text-accent-gold";

                  if (verdict === "KEEP") {
                    bgClass = "bg-green-500/10";
                    borderClass = "border-green-500/20";
                    textClass = "text-green-400";
                  } else if (verdict === "ADJUST") {
                    bgClass = "bg-yellow-500/10";
                    borderClass = "border-yellow-500/20";
                    textClass = "text-yellow-400";
                  } else if (verdict === "DISABLE") {
                    bgClass = "bg-red-500/10";
                    borderClass = "border-red-500/20";
                    textClass = "text-red-400";
                  }

                  return (
                    <span key={m + idx} className={`${bgClass} border ${borderClass} text-[10px] px-2 py-1 rounded ${textClass} uppercase font-semibold`}>
                      {m}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="col-span-2 pt-3 border-t border-gray-800/50 flex flex-col gap-2">
              <div>
                <p className="text-[10px] text-purple-400/70 mb-0.5 uppercase tracking-wider font-semibold">LLM Consensus (ALWAYS ACTIVE)</p>
                <p className="text-[11px] text-gray-400">
                  Requires agreement from {minProviders} models:
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {llmModels.length > 0 ? (
                  llmModels.map((m) => {
                    const isOk = m.status === "active";
                    return (
                      <div key={m.name} className={`flex items-center gap-1.5 px-2 py-1 rounded border ${isOk ? 'bg-purple-500/10 border-purple-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                        <span className={`text-[10px] font-semibold ${isOk ? 'text-purple-300' : 'text-yellow-400'}`}>
                          {m.label}
                        </span>
                        <span className="text-gray-600">|</span>
                        <span className={`text-[9px] uppercase font-bold tracking-wider ${isOk ? 'text-purple-400/80' : 'text-yellow-500/80'}`}>
                          {isOk ? 'ACTIVE' : m.status}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-gray-500 italic">No LLM models available...</span>
                )}
              </div>
            </div>

            {/* Smart Risk Management */}
            {displayConfig.smartRisk?.enabled && (
              <div className="col-span-2 pt-3 border-t border-gray-800/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                  <p className="text-[10px] text-indigo-400/80 uppercase tracking-wider font-semibold">
                    Smart Risk Management {pipelineStatus?.metrics?.smartRisk?.dailyTradingBlocked && <span className="text-red-400">(BLOCKED)</span>}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {displayConfig.smartRisk.drawdownRecovery?.enabled && (
                    <div className="bg-indigo-500/5 rounded p-2 border border-indigo-500/10">
                      <p className="text-[10px] text-gray-400 mb-1">Drawdown Recovery</p>
                      <div className="flex items-end justify-between">
                        <p className="text-xs text-white font-mono">
                          {displayConfig.smartRisk.drawdownRecovery.activationDrawdownPct}% → {displayConfig.smartRisk.drawdownRecovery.riskReductionMultiplier}x
                        </p>
                        {pipelineStatus?.metrics?.smartRisk?.currentDrawdownPct !== undefined && (
                          <span className={`text-[10px] font-mono ${pipelineStatus.metrics.smartRisk.currentDrawdownPct >= displayConfig.smartRisk.drawdownRecovery.activationDrawdownPct ? 'text-red-400' : 'text-gray-500'}`}>
                            Live: {pipelineStatus.metrics.smartRisk.currentDrawdownPct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {displayConfig.smartRisk.capitalPreservation?.enabled && (
                    <div className="bg-indigo-500/5 rounded p-2 border border-indigo-500/10">
                      <p className="text-[10px] text-gray-400 mb-1">Tiered Scaling (Growth)</p>
                      <div className="flex items-end justify-between">
                        <p className="text-xs text-white font-mono">
                          {displayConfig.smartRisk.capitalPreservation.activationGrowthPct}% → {displayConfig.smartRisk.capitalPreservation.riskReductionMultiplier}x
                        </p>
                        {pipelineStatus?.metrics?.smartRisk?.currentGrowthPct !== undefined && (
                          <span className={`text-[10px] font-mono ${pipelineStatus.metrics.smartRisk.currentGrowthPct >= displayConfig.smartRisk.capitalPreservation.activationGrowthPct ? 'text-green-400' : 'text-gray-500'}`}>
                            Live: {pipelineStatus.metrics.smartRisk.currentGrowthPct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {displayConfig.smartRisk.dailyLimits?.enabled && (
                    <div className="col-span-2 bg-indigo-500/5 rounded p-2 border border-indigo-500/10 flex justify-between items-center">
                      <div>
                         <p className="text-[10px] text-gray-400">Daily Limits</p>
                         <p className="text-xs text-white font-mono mt-0.5">
                           +{displayConfig.smartRisk.dailyLimits.profitTargetPct}% / -{displayConfig.smartRisk.dailyLimits.lossLimitPct}%
                         </p>
                      </div>
                      {pipelineStatus?.metrics?.smartRisk && (
                        <div className="text-right">
                          <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Current Multiplier</p>
                          <p className={`text-xs font-mono font-bold ${pipelineStatus.metrics.smartRisk.currentRiskMultiplier < 1 ? 'text-indigo-400' : 'text-gray-400'}`}>
                            {pipelineStatus.metrics.smartRisk.currentRiskMultiplier}x
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {!pipelineRunning && !pipelinePaused && (
            <div className="flex flex-col items-center gap-1.5">
               <p className="text-[11px] text-gray-400 text-center italic opacity-80">
                 * Settings are strictly locked to the applied backtest configuration.
               </p>
               {lastAutoBacktestAt && (
                 <p className="text-[10px] text-green-400/90 font-medium bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
                   ✓ Last Auto-Calibration: {new Date(lastAutoBacktestAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} WIB
                 </p>
               )}
            </div>
          )}
        </div>
      ) : (
        <div className="py-10 bg-gray-900/50 border border-gray-800 border-dashed rounded-xl flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <h4 className="text-gray-300 font-medium mb-1 text-sm">No Configuration</h4>
          <p className="text-xs text-gray-500 max-w-[220px]">
            Please run a backtest and click "Apply to Live Pipeline" to configure trading parameters.
          </p>
        </div>
      )}

      {/* Pipeline Controls */}
      <div className="pt-2 border-t border-gray-800 space-y-2">
        {!pipelineRunning && !pipelinePaused && (
          <button
            onClick={handleStart}
            disabled={isStarting || !savedPipelineConfig}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start Pipeline</span>
              </>
            )}
          </button>
        )}

        {pipelineRunning && (
          <div className="flex gap-2">
            <button
              onClick={pausePipeline}
              className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </button>
            <button
              onClick={stopPipeline}
              disabled={isStopping}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {isStopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
            </button>
          </div>
        )}

        {pipelinePaused && (
          <div className="flex gap-2">
            <button
              onClick={resumePipeline}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </button>
            <button
              onClick={stopPipeline}
              disabled={isStopping}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {isStopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className="hud-panel p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-accent-gold/20 pb-3 relative">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-gold/50 to-transparent"></div>
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-accent-gold drop-shadow-[0_0_4px_rgba(212,175,55,0.4)] flex items-center gap-2">
          <Signal className="w-4 h-4" />
          Live Trading Link
        </h3>
        <div className="flex items-center gap-2">
          {gradeInfo && gradeInfo.grade !== "UNRATED" && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border tracking-wider font-mono ${gradeInfo.color}`} title="AI Config Grade">
              Class {gradeInfo.grade}
            </span>
          )}
          {(pipelineRunning || pipelinePaused) && (
            <span className="text-[9px] uppercase tracking-widest bg-accent-gold/20 text-accent-gold px-2 py-1 rounded font-bold shadow-[0_0_8px_rgba(212,175,55,0.3)] animate-pulse border border-accent-gold/50 font-mono">
              Active Sync
            </span>
          )}
        </div>
      </div>

      {displayConfig ? (
        <div className="space-y-4 text-sm text-text-primary">
          <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-lg border border-accent-gold/10 shadow-inner">
            <div className="col-span-2">
              <p className="text-[9px] text-accent-gold-dim mb-1.5 uppercase tracking-widest">Target Vectors</p>
              <div className="flex flex-wrap gap-1.5">
                {(displayConfig.symbols || []).map((s: string) => (
                  <span key={s} className="bg-accent-gold/5 border border-accent-gold/20 text-xs px-2 py-1 rounded text-accent-gold font-mono font-bold shadow-[0_0_4px_rgba(212,175,55,0.1)]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-[9px] text-accent-gold-dim mb-1 uppercase tracking-widest">Timeframe</p>
              <p className="font-mono font-bold text-text-primary bg-black/60 border border-accent-gold/20 inline-block px-2 py-0.5 rounded shadow-inner">{displayConfig.timeframe || "M15"}</p>
            </div>
            
            <div>
              <p className="text-[9px] text-accent-gold-dim mb-1 uppercase tracking-widest">Risk / Trade</p>
              <p className="font-mono font-bold text-text-primary bg-black/60 border border-accent-gold/20 inline-block px-2 py-0.5 rounded shadow-inner">{displayConfig.maxRiskPerTrade || 1.0}%</p>
            </div>
            
            <div>
              <p className="text-[9px] text-accent-gold-dim mb-1 uppercase tracking-widest">Max Positions</p>
              <p className="font-mono font-bold text-text-primary bg-black/60 border border-accent-gold/20 inline-block px-2 py-0.5 rounded shadow-inner">{displayConfig.maxOpenPositions || 3}</p>
            </div>

            <div>
              <p className="text-[9px] text-accent-gold-dim mb-1 uppercase tracking-widest">Daily Risk Limit</p>
              <p className="font-mono font-bold text-text-primary bg-black/60 border border-accent-gold/20 inline-block px-2 py-0.5 rounded shadow-inner">{displayConfig.maxDailyRisk || 3.0}%</p>
            </div>

            <div className="col-span-2 pt-3 border-t border-accent-gold/10">
               <p className="text-[9px] text-accent-gold-dim mb-2 uppercase tracking-widest">Active Neural Pathways</p>
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
                  let glowClass = "shadow-[0_0_8px_rgba(212,175,55,0.2)]";

                  if (verdict === "KEEP") {
                    bgClass = "bg-neon-green/10";
                    borderClass = "border-neon-green/30";
                    textClass = "text-neon-green";
                    glowClass = "shadow-[0_0_8px_rgba(57,255,136,0.3)]";
                  } else if (verdict === "ADJUST") {
                    bgClass = "bg-yellow-500/10";
                    borderClass = "border-yellow-500/30";
                    textClass = "text-yellow-400";
                    glowClass = "shadow-[0_0_8px_rgba(234,179,8,0.3)]";
                  } else if (verdict === "DISABLE") {
                    bgClass = "bg-neon-red/10";
                    borderClass = "border-neon-red/30";
                    textClass = "text-neon-red";
                    glowClass = "shadow-[0_0_8px_rgba(255,56,100,0.3)]";
                  }

                  return (
                    <span key={m + idx} className={`${bgClass} border ${borderClass} ${glowClass} text-[10px] px-2 py-1 rounded ${textClass} uppercase font-bold tracking-wider font-mono`}>
                      {m}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="col-span-2 pt-3 border-t border-accent-gold/10 flex flex-col gap-2">
              <div>
                <p className="text-[9px] text-[#A855F7] mb-0.5 uppercase tracking-widest font-bold">LLM Consensus Link</p>
                <p className="text-[10px] text-text-muted">
                  Sync nodes req: {minProviders} models
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {llmModels.length > 0 ? (
                  llmModels.map((m) => {
                    const isOk = m.status === "active";
                    return (
                      <div key={m.name} className={`flex items-center gap-1.5 px-2 py-1 rounded border ${isOk ? 'bg-[#A855F7]/10 border-[#A855F7]/30 shadow-[0_0_8px_rgba(168,85,247,0.2)]' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                        <span className={`text-[10px] font-bold font-mono ${isOk ? 'text-[#D8B4FE]' : 'text-yellow-400'}`}>
                          {m.label}
                        </span>
                        <span className="text-text-muted/50">|</span>
                        <span className={`text-[9px] uppercase font-bold tracking-widest ${isOk ? 'text-[#A855F7]' : 'text-yellow-500/80'}`}>
                          {isOk ? 'ONLINE' : m.status}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-text-muted italic">No LLM models available...</span>
                )}
              </div>
            </div>

            {/* Smart Risk Management */}
            {displayConfig.smartRisk?.enabled && (
              <div className="col-span-2 pt-3 border-t border-accent-gold/10">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-accent-gold" />
                  <p className="text-[9px] text-accent-gold uppercase tracking-widest font-bold">
                    Safety Protocols
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-widest ${pipelineStatus?.metrics?.smartRisk?.dailyTradingBlocked ? 'bg-neon-red/10 border-neon-red/30 text-neon-red shadow-[0_0_8px_rgba(255,56,100,0.3)]' : 'bg-neon-green/10 border-neon-green/30 text-neon-green shadow-[0_0_8px_rgba(57,255,136,0.3)]'}`}>
                    {pipelineStatus?.metrics?.smartRisk?.dailyTradingBlocked ? 'BLOCKED' : 'ACTIVE'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {displayConfig.smartRisk.drawdownRecovery?.enabled && (
                    <div className="bg-black/50 rounded p-2 border border-accent-gold/20">
                      <p className="text-[9px] tracking-wider text-text-muted mb-1">Drawdown Rec</p>
                      <div className="flex items-end justify-between">
                        <p className="text-[11px] font-bold text-text-primary font-mono">
                          {displayConfig.smartRisk.drawdownRecovery.activationDrawdownPct}% → {displayConfig.smartRisk.drawdownRecovery.riskReductionMultiplier}x
                        </p>
                        {pipelineStatus?.metrics?.smartRisk?.currentDrawdownPct !== undefined && (
                          <span className={`text-[9px] font-mono font-bold ${pipelineStatus.metrics.smartRisk.currentDrawdownPct >= displayConfig.smartRisk.drawdownRecovery.activationDrawdownPct ? 'text-neon-red drop-shadow-[0_0_4px_rgba(255,56,100,0.5)]' : 'text-text-muted'}`}>
                            Live: {pipelineStatus.metrics.smartRisk.currentDrawdownPct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {displayConfig.smartRisk.capitalPreservation?.enabled && (
                    <div className="bg-black/50 rounded p-2 border border-accent-gold/20">
                      <p className="text-[9px] tracking-wider text-text-muted mb-1">Tiered Scale</p>
                      <div className="flex items-end justify-between">
                        <p className="text-[11px] font-bold text-text-primary font-mono">
                          {displayConfig.smartRisk.capitalPreservation.activationGrowthPct}% → {displayConfig.smartRisk.capitalPreservation.riskReductionMultiplier}x
                        </p>
                        {pipelineStatus?.metrics?.smartRisk?.currentGrowthPct !== undefined && (
                          <span className={`text-[9px] font-mono font-bold ${pipelineStatus.metrics.smartRisk.currentGrowthPct >= displayConfig.smartRisk.capitalPreservation.activationGrowthPct ? 'text-neon-green drop-shadow-[0_0_4px_rgba(57,255,136,0.5)]' : 'text-text-muted'}`}>
                            Live: {pipelineStatus.metrics.smartRisk.currentGrowthPct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {displayConfig.smartRisk.dailyLimits?.enabled && (
                    <div className="col-span-2 bg-black/50 rounded p-2 border border-accent-gold/20 flex justify-between items-center">
                      <div>
                         <p className="text-[9px] tracking-wider text-text-muted">Daily Limits</p>
                         <p className="text-[11px] font-bold text-text-primary font-mono mt-0.5">
                           +{displayConfig.smartRisk.dailyLimits.profitTargetPct}% / -{displayConfig.smartRisk.dailyLimits.lossLimitPct}%
                         </p>
                      </div>
                      {pipelineStatus?.metrics?.smartRisk && (
                        <div className="text-right">
                          <p className="text-[9px] text-accent-gold-dim uppercase tracking-widest mb-0.5">Current Multiplier</p>
                          <p className={`text-[11px] font-mono font-bold ${pipelineStatus.metrics.smartRisk.currentRiskMultiplier < 1 ? 'text-neon-red drop-shadow-[0_0_4px_rgba(255,56,100,0.5)]' : 'text-text-primary'}`}>
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
            <div className="flex flex-col items-center gap-2">
               <p className="text-[10px] text-text-muted text-center font-mono opacity-60">
                 // Settings locked to validated backtest parameters
               </p>
               {lastAutoBacktestAt && (
                 <p className="text-[9px] tracking-widest font-mono text-neon-green font-bold bg-neon-green/10 px-3 py-1.5 rounded border border-neon-green/30 shadow-[0_0_8px_rgba(57,255,136,0.2)]">
                   SYS.CALIBRATED: {new Date(lastAutoBacktestAt).toLocaleTimeString("en-US", { hour12: false })}
                 </p>
               )}
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 bg-black/40 border border-accent-gold/20 border-dashed rounded-xl flex flex-col items-center justify-center text-center shadow-inner">
          <div className="w-12 h-12 rounded-full bg-accent-gold/10 flex items-center justify-center mb-4 border border-accent-gold/30">
            <AlertTriangle className="w-5 h-5 text-accent-gold" />
          </div>
          <h4 className="text-accent-gold font-bold mb-1 text-xs tracking-widest uppercase">No Config Found</h4>
          <p className="text-[10px] text-text-muted max-w-[220px] font-mono">
            Execute backtest simulation to generate trading parameters.
          </p>
        </div>
      )}

      {/* Pipeline Controls (Tactile Switches) */}
      <div className="pt-4 border-t border-accent-gold/20 space-y-3">
        {!pipelineRunning && !pipelinePaused && (
          <button
            onClick={handleStart}
            disabled={isStarting || !savedPipelineConfig}
            className="w-full py-4 bg-black border border-accent-gold/40 hover:bg-accent-gold/10 disabled:bg-black/40 disabled:border-gray-800 disabled:text-gray-600 text-accent-gold text-sm rounded-lg font-bold tracking-widest uppercase transition-all shadow-[inset_0_4px_6px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] hover:shadow-[inset_0_4px_6px_rgba(255,255,255,0.05),0_0_15px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>INIT SYS...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>ENGAGE PIPELINE</span>
              </>
            )}
          </button>
        )}

        {pipelineRunning && (
          <div className="flex gap-3">
            <button
              onClick={pausePipeline}
              className="flex-1 py-4 bg-black border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)] text-sm rounded-lg font-bold tracking-widest uppercase transition-all shadow-[inset_0_4px_6px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center gap-2"
            >
              <Pause className="w-5 h-5 fill-current" />
              <span>PAUSE</span>
            </button>
            <button
              onClick={stopPipeline}
              disabled={isStopping}
              className="flex-1 py-4 bg-black border border-neon-red/50 text-neon-red hover:bg-neon-red/10 hover:shadow-[0_0_15px_rgba(255,56,100,0.4)] disabled:bg-black/40 disabled:border-gray-800 disabled:text-gray-600 text-sm rounded-lg font-bold tracking-widest uppercase transition-all shadow-[inset_0_4px_6px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center gap-2"
            >
              {isStopping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
              <span>HALT</span>
            </button>
          </div>
        )}

        {pipelinePaused && (
          <div className="flex gap-3">
            <button
              onClick={resumePipeline}
              className="flex-1 py-4 bg-black border border-neon-green/50 text-neon-green hover:bg-neon-green/10 hover:shadow-[0_0_15px_rgba(57,255,136,0.4)] text-sm rounded-lg font-bold tracking-widest uppercase transition-all shadow-[inset_0_4px_6px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>RESUME</span>
            </button>
            <button
              onClick={stopPipeline}
              disabled={isStopping}
              className="flex-1 py-4 bg-black border border-neon-red/50 text-neon-red hover:bg-neon-red/10 hover:shadow-[0_0_15px_rgba(255,56,100,0.4)] disabled:bg-black/40 disabled:border-gray-800 disabled:text-gray-600 text-sm rounded-lg font-bold tracking-widest uppercase transition-all shadow-[inset_0_4px_6px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center gap-2"
            >
              {isStopping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
              <span>HALT</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useAiTrading } from "../context/AiTradingContext";
import { Play, Square, Pause, Loader2, Signal, AlertTriangle, ShieldAlert, ShieldX, TriangleAlert } from "lucide-react";
import { SkillDisplay } from "./SkillDisplay";
import { toast } from "sonner";
import { AIBacktestSkill } from "@/services/ai-trading.service";
import { useState, useEffect } from "react";

import { LlmConsensusConfig } from "./LlmConsensusConfig";

interface TradingPanelProps {
  pipelineRunning: boolean;
  pipelinePaused: boolean;
  isStarting: boolean;
  isStopping: boolean;
  skillConfig?: AIBacktestSkill | null;
  // Visualization options
  showContributionIndicators?: boolean;
  onShowContributionIndicatorsChange?: (v: boolean) => void;
  showConsensusPanelByDefault?: boolean;
  onShowConsensusPanelByDefaultChange?: (v: boolean) => void;
  visualizationStyle?: "radar" | "cards" | "table";
  onVisualizationStyleChange?: (v: "radar" | "cards" | "table") => void;
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
    accountInfo,
    setSkillConfig,
    skillVersion,
    showContributionIndicators,
    setShowContributionIndicators,
    showConsensusPanelByDefault,
    setShowConsensusPanelByDefault,
    visualizationStyle,
    setVisualizationStyle,
  } = useAiTrading();

  const handleStart = async () => {
    if (!savedPipelineConfig) {
      toast.error("No backtest configuration applied. Please run a backtest first.");
      return;
    }
    // Clear any lingering circuit breaker alert before starting
    setCircuitBreakerAlert(null);
    await startPipeline({ ...savedPipelineConfig, useAppliedConfig: true });
  };

  // ── Circuit Breaker Alert State ─────────────────────────────────────
  const [circuitBreakerAlert, setCircuitBreakerAlert] = useState<string | null>(null);

  // Watch for circuit breaker reason from backend
  useEffect(() => {
    if (pipelineStatus?.circuitBreakerReason && !pipelineRunning && !pipelinePaused) {
      setCircuitBreakerAlert(pipelineStatus.circuitBreakerReason);
    }
  }, [pipelineStatus?.circuitBreakerReason, pipelineRunning, pipelinePaused]);

  const displayConfig = pipelineRunning || pipelinePaused ? pipelineStatus?.config : savedPipelineConfig;

  // Force LLM to be always active
  const isLlmActive = true;

  const minProviders = pipelineRunning || pipelinePaused
    ? (displayConfig?.llmConsensus?.minProviders ?? llmMinProviders)
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
    <div className="glass p-4 space-y-4 relative">

      {/* ── Circuit Breaker Alert Modal ─────────────────────────────────── */}
      {circuitBreakerAlert && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="relative w-full max-w-md bg-[#0f0a0a] border border-red-500/50 rounded-2xl shadow-[0_0_60px_rgba(255,56,100,0.3)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Danger glow top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-700 via-red-400 to-red-700 animate-pulse" />
            
            <div className="p-6">
              {/* Icon + Title */}
              <div className="flex flex-col items-center text-center gap-3 mb-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl scale-150 animate-pulse" />
                  <ShieldX className="relative w-12 h-12 text-red-400 drop-shadow-[0_0_12px_rgba(255,56,100,0.8)]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-red-400 uppercase tracking-widest font-mono drop-shadow-[0_0_8px_rgba(255,56,100,0.6)]">
                    Circuit Breaker Activated
                  </h2>
                  <p className="text-[11px] text-text-muted mt-1 uppercase tracking-wider">
                    Pipeline Dihentikan Otomatis
                  </p>
                </div>
              </div>

              {/* Reason — parse attribution */}
              {(() => {
                // Parse: "... | AI: $X | Manual Trade: $Y"
                const aiMatch = circuitBreakerAlert.match(/AI:\s*\$([\-+]?[\d.]+)/);
                const manualMatch = circuitBreakerAlert.match(/Manual Trade:\s*\$([\-+]?[\d.]+)/);
                const baseReason = circuitBreakerAlert.split('|')[0].trim();
                const aiPnL = aiMatch ? parseFloat(aiMatch[1]) : null;
                const manualPnL = manualMatch ? parseFloat(manualMatch[1]) : null;
                const manualCaused = manualPnL !== null && aiPnL !== null && Math.abs(manualPnL) > Math.abs(aiPnL);

                return (
                  <>
                    {/* Base reason */}
                    <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <TriangleAlert className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <p className="text-[12px] text-red-300 font-mono leading-relaxed">{baseReason}</p>
                      </div>
                    </div>

                    {/* Trade Attribution Breakdown */}
                    {aiPnL !== null && manualPnL !== null && (
                      <div className="mb-4">
                        <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2 text-center">
                          📊 Kontribusi Kerugian Hari Ini
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {/* AI */}
                          <div className={`rounded-lg p-2.5 text-center border ${aiPnL < 0 ? 'bg-red-950/30 border-red-500/30' : 'bg-neon-green/5 border-neon-green/20'}`}>
                            <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">🤖 AI Trading</p>
                            <p className={`text-[14px] font-bold font-mono ${aiPnL < 0 ? 'text-red-400' : 'text-neon-green'}`}>
                              {aiPnL >= 0 ? '+' : ''}${aiPnL.toFixed(2)}
                            </p>
                          </div>
                          {/* Manual */}
                          <div className={`rounded-lg p-2.5 text-center border ${manualPnL < 0 ? 'bg-orange-950/30 border-orange-500/40' : 'bg-neon-green/5 border-neon-green/20'}`}>
                            <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">👤 Manual Trade</p>
                            <p className={`text-[14px] font-bold font-mono ${manualPnL < 0 ? 'text-orange-400' : 'text-neon-green'}`}>
                              {manualPnL >= 0 ? '+' : ''}${manualPnL.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {/* Culprit banner */}
                        {manualCaused && (
                          <div className="mt-2 bg-orange-950/40 border border-orange-500/40 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-orange-400 font-bold">
                              ⚠️ Manual trade melebihi kontribusi AI — Pipeline AI bukan penyebab utama
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Info box */}
                    <div className="bg-black/50 border border-accent-gold/20 rounded-lg p-3 mb-4 text-center">
                      <p className="text-[10px] text-accent-gold-dim uppercase tracking-widest mb-1">Tindakan Yang Diperlukan</p>
                      <p className="text-[12px] text-text-muted leading-relaxed">
                        Tambahkan <span className="text-accent-gold font-bold">saldo / deposit</span> ke akun trading Anda untuk mengembalikan kapasitas risk, kemudian jalankan ulang pipeline.
                      </p>
                    </div>
                  </>
                );
              })()}

              {/* Balance / equity display */}
              {accountInfo && (
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="bg-black/60 rounded-lg p-2.5 text-center border border-white/5">
                    <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">Balance</p>
                    <p className="text-[13px] font-bold font-mono text-text-primary">${accountInfo.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-black/60 rounded-lg p-2.5 text-center border border-white/5">
                    <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">Equity</p>
                    <p className={`text-[13px] font-bold font-mono ${(accountInfo.equity || 0) < (accountInfo.balance || 0) ? 'text-red-400' : 'text-neon-green'}`}>
                      ${accountInfo.equity?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCircuitBreakerAlert(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted text-[11px] font-bold uppercase tracking-wider transition-all"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    setCircuitBreakerAlert(null);
                    handleStart();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40 text-neon-green text-[11px] font-bold uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(57,255,136,0.2)] hover:shadow-[0_0_20px_rgba(57,255,136,0.4)]"
                >
                  🔄 Jalankan Ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
                  // Chip color = ACTIVE status, not the skill verdict. The AI
                  // skill verdict (computed from live history) is shown as a
                  // small badge — a red chip for an ACTIVE methodology misled
                  // users into thinking it was disabled.
                  return (
                    <span key={m + idx} className="bg-neon-green/10 border border-neon-green/30 shadow-[0_0_8px_rgba(57,255,136,0.25)] text-[10px] px-2 py-1 rounded text-neon-green uppercase font-bold tracking-wider font-mono">
                      {m}
                      {verdict && (
                        <span className={`ml-1.5 text-[8px] px-1 py-0.5 rounded font-bold ${
                          verdict === "KEEP" ? "bg-neon-green/20 text-neon-green"
                          : verdict === "ADJUST" ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-neon-red/20 text-neon-red"
                        }`}>
                          {verdict}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="col-span-2 pt-3 border-t border-accent-gold/10 flex flex-col gap-2">
              <div>
                <p className="text-[9px] text-accent-gold mb-0.5 uppercase tracking-widest font-bold">LLM Nodes</p>
                <p className="text-[10px] text-text-muted">
                  {llmModels.filter(m => m.status === "active").length}/{llmModels.length} active
                </p>
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

                  {displayConfig.maxDailyRisk && (
                    <div className="bg-black/50 rounded p-2 border border-accent-gold/20">
                      <p className="text-[9px] tracking-wider text-text-muted mb-1">Max Daily Risk</p>
                      <p className="text-[11px] font-bold text-red-400 font-mono">
                        Stop at: -{displayConfig.maxDailyRisk}%
                      </p>
                    </div>
                  )}

                  {displayConfig.smartRisk?.globalDrawdownLimit?.enabled && (
                    <div className="bg-black/50 rounded p-2 border border-accent-gold/20">
                      <p className="text-[9px] tracking-wider text-text-muted mb-1">Global Max DD</p>
                      <p className="text-[11px] font-bold text-red-500 font-mono">
                        Hard Stop at: -{displayConfig.smartRisk.globalDrawdownLimit.maxDrawdownPct}%
                      </p>
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

      <SkillDisplay 
        key={skillVersion} 
        server={accountInfo?.server} 
        onApplySkill={(skill) => {
          setSkillConfig(skill);
        }} 
      />

      {/* LLM Visualization Config */}
      <LlmConsensusConfig
        enabled={true}
        threshold={pipelineStatus?.config?.llmConsensus?.threshold ?? 0.7}
        minProviders={minProviders}
        providerTimeoutMs={pipelineStatus?.config?.llmConsensus?.providerTimeoutMs ?? 25000}
        models={llmModels}
        loading={false}
        onToggle={() => {}}
        onThresholdChange={() => {}}
        onMinProvidersChange={() => {}}
        onProviderTimeoutChange={() => {}}
        showContributionIndicators={showContributionIndicators}
        onShowContributionIndicatorsChange={setShowContributionIndicators}
        showConsensusPanelByDefault={showConsensusPanelByDefault}
        onShowConsensusPanelByDefaultChange={setShowConsensusPanelByDefault}
        visualizationStyle={visualizationStyle}
        onVisualizationStyleChange={setVisualizationStyle}
      />

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

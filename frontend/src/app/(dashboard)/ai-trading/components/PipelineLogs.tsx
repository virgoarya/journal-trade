"use client";

import { useState } from "react";
import { type PipelineLog } from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import { ScrollText, Signal, ShoppingCart, AlertTriangle, Activity, BrainCircuit, Layers, Compass } from "lucide-react";

interface PipelineLogsProps {
  logs: PipelineLog[];
  config?: any;
  isLoading?: boolean;
}

const LOG_ICONS: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  INFO: { icon: ScrollText, color: "text-gray-400" },
  SIGNAL: { icon: Signal, color: "text-blue-400" },
  CONFLUENCE: { icon: BrainCircuit, color: "text-purple-400" },
  IPDA: { icon: Compass, color: "text-cyan-400" },
  TRADE: { icon: ShoppingCart, color: "text-green-400" },
  ERROR: { icon: AlertTriangle, color: "text-red-400" },
  TRAILING: { icon: Activity, color: "text-yellow-400" },
};

interface PipelineStage {
  status: "pending" | "active" | "success" | "error" | "passed";
  message?: string;
  time?: number;
  data?: any;
}

interface SymbolTrack {
  symbol: string;
  direction?: "BUY" | "SELL";
  lastUpdateTime: number;
  stages: {
    SIGNAL: PipelineStage;
    CONFLUENCE: PipelineStage;
    EXECUTION: PipelineStage;
    TRAILING: PipelineStage;
  };
}

const renderLogMessage = (msg: string) => {
  if (msg.startsWith("Config updated: {")) {
    try {
      const jsonStr = msg.replace("Config updated: ", "");
      const config = JSON.parse(jsonStr);
      return (
        <div className="flex flex-col gap-1.5 mt-1">
          <span className="opacity-80">Config applied:</span>
          <div className="flex flex-wrap gap-1.5 items-center">
            {config.symbols && config.symbols.length > 0 && (
              <span className="px-2 py-0.5 bg-black/40 border border-current/20 rounded text-[9px] font-mono tracking-wider">
                {config.symbols.length} Symbols
              </span>
            )}
            {config.timeframe && (
              <span className="px-2 py-0.5 bg-black/40 border border-current/20 rounded text-[9px] font-mono tracking-wider">
                {config.timeframe}
              </span>
            )}
            {config.activeMethodologies && config.activeMethodologies.length > 0 && (
              <span className="px-2 py-0.5 bg-black/40 border border-current/20 rounded text-[9px] font-mono tracking-wider uppercase">
                {config.activeMethodologies.join(", ")}
              </span>
            )}
            {config.maxRiskPerTrade !== undefined && (
              <span className="px-2 py-0.5 bg-black/40 border border-current/20 rounded text-[9px] font-mono tracking-wider">
                Risk: {config.maxRiskPerTrade}%
              </span>
            )}
            {config.trailingStop !== undefined && (
              <span className={`px-2 py-0.5 bg-black/40 border border-current/20 rounded text-[9px] font-mono tracking-wider ${config.trailingStop.enabled ? 'opacity-100' : 'opacity-50'}`}>
                Trailing: {config.trailingStop.enabled ? 'ON' : 'OFF'}
              </span>
            )}
          </div>
        </div>
      );
    } catch (e) {
      // fallback
    }
  }
  return msg;
};



export function PipelineLogs({ logs, config, isLoading }: PipelineLogsProps) {
  const [viewMode, setViewMode] = useState<"cards" | "raw">("cards");
  const [filterType, setFilterType] = useState("");
  
  const [selectedStages, setSelectedStages] = useState<Record<string, string>>({});

  const logTypes = ["SIGNAL", "CONFLUENCE", "TRADE", "TRAILING", "ERROR"];

  if (isLoading) {
    return <SkeletonLoader type="list" count={5} />;
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        type="data"
        title="No Pipeline Activity"
        description="No pipeline activity logs available yet."
      />
    );
  }

  const buildTracksFromLogs = (pipelineLogs: PipelineLog[], config: any): SymbolTrack[] => {
    const tracksMap: Record<string, SymbolTrack> = {};
    const activeSymbols = config?.symbols || [];

    for (const sym of activeSymbols) {
      tracksMap[sym] = {
        symbol: sym,
        lastUpdateTime: Date.now(),
        stages: {
          SIGNAL: { status: "pending" },
          CONFLUENCE: { status: "pending" },
          EXECUTION: { status: "pending" },
          TRAILING: { status: "pending" }
        }
      };
    }
    
    const sorted = [...pipelineLogs].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    for (const log of sorted) {
      const isGlobalLog = log.message.startsWith("Pipeline started:") || log.message.startsWith("Config updated:");
      
      let symbol = null;
      if (activeSymbols.length > 0) {
        for (const sym of activeSymbols) {
          if (log.message.includes(sym)) {
            symbol = sym;
            break;
          }
        }
      }
      if (!symbol) {
        const symbolMatch = log.message.match(/\b([A-Z]{5,8})\b/);
        if (symbolMatch && !["SIGNAL", "PIPELINE", "CONFLUENCE", "TRAILING"].includes(symbolMatch[1])) {
          symbol = symbolMatch[1];
        }
      }
      
      let direction: "BUY" | "SELL" | undefined;
      if (log.data?.direction) {
        direction = log.data.direction;
      } else {
        const cleanMsg = log.message.replace(/buy-side|sell-side/gi, "");
        if (/\bbuy\b/i.test(cleanMsg)) direction = "BUY";
        else if (/\bsell\b/i.test(cleanMsg)) direction = "SELL";
      }

      const time = new Date(log.time).getTime();

      const applyStage = (sym: string) => {
        if (!tracksMap[sym] && activeSymbols.length > 0) return;
        
        if (!tracksMap[sym]) {
          tracksMap[sym] = {
            symbol: sym,
            lastUpdateTime: time,
            stages: {
              SIGNAL: { status: "pending" },
              CONFLUENCE: { status: "pending" },
              EXECUTION: { status: "pending" },
              TRAILING: { status: "pending" }
            }
          };
        }

        const track = tracksMap[sym];
        track.lastUpdateTime = time;
        if (direction) track.direction = direction;

        if (log.type === "SIGNAL") {
          if (log.message.includes("NO SIGNAL")) {
            track.stages.SIGNAL = { status: "active", message: log.message, time };
          } else {
            track.stages.SIGNAL = { status: "success", message: log.message, time, data: log.data };
          }
          track.stages.CONFLUENCE = { status: "pending" };
          track.stages.EXECUTION = { status: "pending" };
          track.stages.TRAILING = { status: "pending" };
        } else if (log.type === "CONFLUENCE") {
          let status: "active" | "error" | "success" | "pending" = "active";
          if (log.message.includes("REJECTED") || log.message.includes("NO TRADE") || log.message.includes("SKIP")) {
            status = "error";
          } else if (log.message.includes("APPROVED") || log.message.includes("TRADE APPROVED") || log.message.includes("GOOD")) {
            status = "success";
          } else if (log.message.includes("Initiating")) {
            status = "active";
          }
          
          track.stages.CONFLUENCE = { status, message: log.message, time, data: log.data };
          track.stages.EXECUTION = { status: "pending" };
          track.stages.TRAILING = { status: "pending" };
        } else if (log.type === "TRADE") {
          if (log.message.toLowerCase().includes("pending") || log.message.toLowerCase().includes("limit") || log.message.toLowerCase().includes("stop")) {
            track.stages.EXECUTION = { status: "active", message: log.message, time };
          } else {
            track.stages.EXECUTION = { status: "success", message: log.message, time };
          }
          track.stages.TRAILING = { status: "pending" };
        } else if (log.type === "ERROR") {
          track.stages.EXECUTION = { status: "error", message: log.message, time };
          track.stages.TRAILING = { status: "pending" };
        } else if (log.type === "TRAILING") {
          track.stages.TRAILING = { status: "success", message: log.message, time };
        }
      };

      if (isGlobalLog && activeSymbols.length > 0) {
        activeSymbols.forEach(applyStage);
      } else if (symbol) {
        applyStage(symbol);
      }
    }

    return Object.values(tracksMap).sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
  };

  const tracks = buildTracksFromLogs(logs, config || null);

  const getStepStatus = (
    track: SymbolTrack,
    stepKey: string
  ): { status: "pending" | "active" | "passed" | "success" | "error"; message?: string; time?: number; data?: any } => {
    const { stages } = track;
    
    if (stepKey === "SIGNAL") {
      if (stages.SIGNAL.status === "error") return { ...stages.SIGNAL, status: "error" };
      if (stages.SIGNAL.status === "success") return { ...stages.SIGNAL, status: "success" };
      if (stages.SIGNAL.status === "active") return { ...stages.SIGNAL, status: "active" };
      return { status: "active", message: "Scanning market structure & technical checklist..." };
    }
    
    if (stepKey === "CONFLUENCE") {
      if (stages.CONFLUENCE.status === "error") return { ...stages.CONFLUENCE, status: "error" };
      if (stages.CONFLUENCE.status === "success") return { ...stages.CONFLUENCE, status: "success" };
      if (stages.CONFLUENCE.status === "active") return { ...stages.CONFLUENCE, status: "active" };
      if (stages.SIGNAL.status === "success" && stages.CONFLUENCE.status === "pending") {
         return { status: "active", message: "Evaluating multi-methodology & LLM consensus..." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "EXECUTION") {
      if (stages.EXECUTION.status === "error") return { ...stages.EXECUTION, status: "error" };
      if (stages.EXECUTION.status === "success") return { ...stages.EXECUTION, status: "success" };
      if (stages.EXECUTION.status === "active") return { ...stages.EXECUTION, status: "active" };
      if (stages.CONFLUENCE.status === "success" && stages.EXECUTION.status === "pending") {
         return { status: "active", message: "Risk check passed, preparing MT5 order execution..." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "TRAILING") {
      if (stages.TRAILING.status === "success") return { ...stages.TRAILING, status: "success" };
      if (stages.EXECUTION.status === "success" && stages.TRAILING.status === "pending") {
         return { status: "active", message: "Position open, monitoring ATR trailing stop..." };
      }
      return { status: "pending" };
    }

    return { status: "pending" };
  };

  const STAGES = [
    { key: "SIGNAL", label: "Signal", icon: Signal },
    { key: "CONFLUENCE", label: "Confluence", icon: BrainCircuit },
    { key: "EXECUTION", label: "Exec", icon: ShoppingCart },
    { key: "TRAILING", label: "Trailing", icon: Activity }
  ];

  const filteredRawLogs = filterType
    ? logs.filter(l => l.type === filterType)
    : logs;

  return (
    <div className="glass p-5 overflow-hidden space-y-4">
      <div className="flex items-center justify-between border-b border-accent-gold/20 pb-3">
        <h3 className="text-[11px] font-bold text-accent-gold tracking-widest uppercase flex items-center gap-2 drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          <Layers className="w-4 h-4" />
          Pipeline Circuit
        </h3>
        
        <div className="flex bg-black/40 rounded-lg p-0.5 border border-accent-gold/20 backdrop-blur-md">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition ${
              viewMode === "cards"
                ? "bg-accent-gold/20 text-accent-gold shadow-[inset_0_0_8px_rgba(212,175,55,0.4)] border border-accent-gold/40"
                : "text-text-muted hover:text-accent-gold"
            }`}
          >
            Circuit View
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition ${
              viewMode === "raw"
                ? "bg-accent-gold/20 text-accent-gold shadow-[inset_0_0_8px_rgba(212,175,55,0.4)] border border-accent-gold/40"
                : "text-text-muted hover:text-accent-gold"
            }`}
          >
            Raw Data
          </button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="space-y-4">
          {tracks.map((track) => {
            let latestStepKey = "SIGNAL";
            for (const stage of STAGES) {
              const status = getStepStatus(track, stage.key).status;
              if (status !== "pending") {
                latestStepKey = stage.key;
              }
            }

            const currentSelectedStageKey = selectedStages[track.symbol] || latestStepKey;
            const currentStepDetail = getStepStatus(track, currentSelectedStageKey);

            return (
              <div key={track.symbol} className="bg-black/30 border border-accent-gold/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text-primary tracking-widest font-mono">{track.symbol}</span>
                    {track.direction && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider border ${
                        track.direction === "BUY" ? "bg-neon-green/10 text-neon-green border-neon-green/30" : "bg-neon-red/10 text-neon-red border-neon-red/30"
                      }`}>
                        {track.direction}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-text-muted font-mono">
                    {new Date(track.lastUpdateTime).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>

                <div className="relative flex items-center justify-center gap-5 my-3">
                  {STAGES.map((stage) => {
                    const stepInfo = getStepStatus(track, stage.key);
                    const isSelected = currentSelectedStageKey === stage.key;

                    let nodeClass = "bg-black/60 border-accent-gold/20 text-text-muted/60";
                    let iconColor = "text-text-muted/60";
                    let glowClass = "";

                    if (stepInfo.status === "pending") {
                      nodeClass = "bg-black/60 border-accent-gold/10 text-text-muted/40";
                      iconColor = "text-text-muted/40";
                    } else if (stepInfo.status === "active") {
                      nodeClass = "bg-accent-gold/20 border-accent-gold text-accent-gold cursor-pointer";
                      iconColor = "text-accent-gold";
                      glowClass = "shadow-[0_0_10px_rgba(212,175,55,0.3)]";
                    } else if (stepInfo.status === "success") {
                      nodeClass = "bg-neon-green/10 border-neon-green text-neon-green cursor-pointer";
                      iconColor = "text-neon-green";
                      glowClass = "shadow-[0_0_8px_rgba(57,255,136,0.2)]";
                    } else if (stepInfo.status === "error") {
                      nodeClass = "bg-neon-red/10 border-neon-red text-neon-red cursor-pointer";
                      iconColor = "text-neon-red";
                      glowClass = "shadow-[0_0_8px_rgba(255,56,100,0.2)]";
                    }

                    const StageIcon = stage.icon;

                    return (
                      <div
                        key={stage.key}
                        onClick={() => {
                          if (stepInfo.status !== "pending") {
                            setSelectedStages(prev => ({ ...prev, [track.symbol]: stage.key }));
                          }
                        }}
                        className="flex flex-col items-center gap-1.5 cursor-pointer"
                      >
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${nodeClass} ${glowClass} ${isSelected ? "scale-110" : ""}`}>
                          <StageIcon className={`w-3.5 h-3.5 ${iconColor}`} />
                        </div>
                        <span className={`text-[8px] font-bold tracking-widest uppercase ${isSelected ? (stepInfo.status === 'success' ? 'text-neon-green' : stepInfo.status === 'error' ? 'text-neon-red' : 'text-accent-gold') : "text-text-muted/60"}`}>
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {currentStepDetail && currentStepDetail.message && (
                  <div className={`mt-2 p-2.5 bg-black/60 rounded border font-mono text-[10px] leading-relaxed ${
                    currentStepDetail.status === "error" 
                      ? "border-neon-red/20 text-neon-red" 
                      : currentStepDetail.status === "success" 
                        ? "border-neon-green/20 text-neon-green" 
                        : "border-accent-gold/15 text-accent-gold"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5 text-[8px] uppercase tracking-widest border-b border-current/10 pb-1 opacity-70">
                      <span>{currentSelectedStageKey}</span>
                      {currentStepDetail.time && (
                        <span>{new Date(currentStepDetail.time).toLocaleTimeString([], { hour12: false })}</span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{renderLogMessage(currentStepDetail.message || "")}</div>
                    
                    {currentStepDetail.data?.checklist && (
                      <div className="mt-3 space-y-1.5 border-t border-current/10 pt-2">
                        {currentStepDetail.data.checklist.map((item: any, idx: number) => {
                          let iconColor = "text-neon-green";
                          let textColor = "text-gray-200";
                          if (item.status === "WAITING") {
                            iconColor = "text-yellow-400 animate-pulse";
                            textColor = "text-yellow-300";
                          } else if (item.status === "FAILED") {
                            iconColor = "text-neon-red";
                            textColor = "text-gray-400 line-through opacity-70";
                          }
                          return (
                            <div key={idx} className="flex items-start gap-2 bg-black/20 p-1.5 rounded border border-white/5">
                              <div className={`mt-0.5 ${iconColor}`}>
                                {item.status === "PASSED" ? "✓" : item.status === "WAITING" ? "◷" : "✗"}
                              </div>
                              <div className={textColor}>{item.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 font-mono">
          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-accent-gold/15">
            {["", ...logTypes].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 text-[9px] font-bold rounded uppercase tracking-wider transition ${
                  filterType === type
                    ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/40 shadow-[0_0_8px_rgba(212,175,55,0.3)]"
                    : "bg-black/40 text-text-muted hover:text-white border border-accent-gold/10"
                }`}
              >
                {type || "ALL STAGES"}
              </button>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto bg-black/60 rounded-xl border border-accent-gold/15 divide-y divide-accent-gold/10 shadow-inner">
            {[...filteredRawLogs].reverse().map((log, i) => {
              return (
                <div key={i} className="px-3.5 py-2.5 hover:bg-white/[0.02] transition flex items-start gap-3">
                  <span className="text-[9px] text-text-muted/60 shrink-0 pt-0.5 font-mono">
                    {new Date(log.time).toLocaleTimeString([], { hour12: false })}
                  </span>
                  
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0 uppercase border ${
                    log.type === "SIGNAL" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" :
                    log.type === "CONFLUENCE" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                    log.type === "TRADE" ? "bg-neon-green/10 text-neon-green border-neon-green/30" :
                    log.type === "TRAILING" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                    log.type === "ERROR" ? "bg-neon-red/10 text-neon-red border-neon-red/30" :
                    "bg-gray-800 text-gray-400 border-gray-700"
                  }`}>
                    {log.type}
                  </span>

                  <div className="min-w-0 flex-1 text-xs leading-relaxed text-gray-200 font-mono">
                    {renderLogMessage(log.message)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

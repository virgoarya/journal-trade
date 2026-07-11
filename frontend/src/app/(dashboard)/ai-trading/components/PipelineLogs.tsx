"use client";

import { useState } from "react";
import { type PipelineLog } from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import { ScrollText, Signal, ShoppingCart, AlertTriangle, Activity, BrainCircuit, Layers } from "lucide-react";

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
  TRADE: { icon: ShoppingCart, color: "text-green-400" },
  ERROR: { icon: AlertTriangle, color: "text-red-400" },
  TRAILING: { icon: Activity, color: "text-yellow-400" },
};

interface PipelineStage {
  status: "pending" | "active" | "success" | "error";
  message?: string;
  time?: number;
}

interface SymbolTrack {
  symbol: string;
  direction?: "BUY" | "SELL";
  lastUpdateTime: number;
  stages: {
    INFO: PipelineStage;
    SIGNAL: PipelineStage;
    CONFLUENCE: PipelineStage;
    EXECUTION: PipelineStage;
    TRAILING: PipelineStage;
  };
}

export function PipelineLogs({ logs, config, isLoading }: PipelineLogsProps) {
  const [viewMode, setViewMode] = useState<"cards" | "raw">("cards");
  const [filterType, setFilterType] = useState("");
  
  // State for which step is selected to view details in each symbol card
  // Map of symbol -> stageKey
  const [selectedStages, setSelectedStages] = useState<Record<string, string>>({});

  const logTypes = ["INFO", "SIGNAL", "TRADE", "ERROR", "TRAILING", "CONFLUENCE"];

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

  // Group logs into tracks (Symbol Sessions)
  const buildTracksFromLogs = (pipelineLogs: PipelineLog[], config: any): SymbolTrack[] => {
    const tracksMap: Record<string, SymbolTrack> = {};
    const activeSymbols = config?.symbols || [];

    // Initialize tracks based on active config (from Trading Panel)
    for (const sym of activeSymbols) {
      tracksMap[sym] = {
        symbol: sym,
        lastUpdateTime: Date.now(),
        stages: {
          INFO: { status: "pending" },
          SIGNAL: { status: "pending" },
          CONFLUENCE: { status: "pending" },
          EXECUTION: { status: "pending" },
          TRAILING: { status: "pending" }
        }
      };
    }
    
    // Sort oldest first to build state
    const sorted = [...pipelineLogs].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    for (const log of sorted) {
      // Check if it's a global pipeline start message
      const isGlobalStart = log.message.startsWith("Pipeline started:");
      
      const symbolMatch = log.message.match(/\b(EURUSD|GBPUSD|AUDUSD|USDJPY|USDCAD|USDCHF|XAUUSD|BTCUSD|USTEC|US500)\b/);
      const symbol = symbolMatch ? symbolMatch[1] : null;
      
      let direction: "BUY" | "SELL" | undefined;
      if (/\bBUY\b/i.test(log.message)) direction = "BUY";
      else if (/\bSELL\b/i.test(log.message)) direction = "SELL";

      const time = new Date(log.time).getTime();

      // Function to apply log stage to a specific track
      const applyStage = (sym: string) => {
        if (!tracksMap[sym] && activeSymbols.length > 0) return; // Ignore symbols not in current config
        
        if (!tracksMap[sym]) {
          tracksMap[sym] = {
            symbol: sym,
            lastUpdateTime: time,
            stages: {
              INFO: { status: "pending" },
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

        if (log.type === "INFO") {
          track.stages.INFO = { status: "active", message: log.message, time };
        } else if (log.type === "SIGNAL") {
          track.stages.SIGNAL = { status: "active", message: log.message, time };
        } else if (log.type === "CONFLUENCE") {
          track.stages.CONFLUENCE = { status: "active", message: log.message, time };
        } else if (log.type === "TRADE") {
          track.stages.EXECUTION = { status: "success", message: log.message, time };
        } else if (log.type === "ERROR") {
          track.stages.EXECUTION = { status: "error", message: log.message, time };
        } else if (log.type === "TRAILING") {
          track.stages.TRAILING = { status: "success", message: log.message, time };
        }
      };

      if (isGlobalStart && activeSymbols.length > 0) {
        // Apply global start info to all active configured symbols
        activeSymbols.forEach(applyStage);
      } else if (symbol) {
        // Apply to specific matched symbol
        applyStage(symbol);
      }
    }

    return Object.values(tracksMap).sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
  };

  const tracks = buildTracksFromLogs(logs, config || null);

  const getStepStatus = (
    track: SymbolTrack,
    stepKey: string
  ): { status: "pending" | "active" | "passed" | "success" | "error"; message?: string; time?: number } => {
    const { stages } = track;
    
    if (stepKey === "INFO") {
      if (stages.INFO.status !== "pending") return { status: "passed", ...stages.INFO };
      if (stages.SIGNAL.status !== "pending" || stages.CONFLUENCE.status !== "pending" || stages.EXECUTION.status !== "pending" || stages.TRAILING.status !== "pending") {
        return { status: "passed", message: "Pipeline initialized." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "SIGNAL") {
      if (stages.SIGNAL.status !== "pending") return { status: "passed", ...stages.SIGNAL };
      if (stages.CONFLUENCE.status !== "pending" || stages.EXECUTION.status !== "pending" || stages.TRAILING.status !== "pending") {
        return { status: "passed", message: "Signal detected." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "CONFLUENCE") {
      if (stages.CONFLUENCE.status !== "pending") return { status: "passed", ...stages.CONFLUENCE };
      if (stages.EXECUTION.status !== "pending" || stages.TRAILING.status !== "pending") {
        return { status: "passed", message: "Confluence checks completed." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "EXECUTION") {
      if (stages.EXECUTION.status === "success") return { status: "success", ...stages.EXECUTION };
      if (stages.EXECUTION.status === "error") return { status: "error", ...stages.EXECUTION };
      if (stages.TRAILING.status !== "pending") {
        return { status: "success", message: "Trade executed." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "TRAILING") {
      if (stages.TRAILING.status !== "pending") return { status: "active", ...stages.TRAILING };
      return { status: "pending" };
    }

    return { status: "pending" };
  };

  const STAGES = [
    { key: "INFO", label: "Info", icon: ScrollText },
    { key: "SIGNAL", label: "Signal", icon: Signal },
    { key: "CONFLUENCE", label: "Confluence", icon: BrainCircuit },
    { key: "EXECUTION", label: "Execution", icon: ShoppingCart },
    { key: "TRAILING", label: "Trailing", icon: Activity }
  ];

  const filteredRawLogs = filterType
    ? logs.filter(l => l.type === filterType)
    : logs;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent-gold" />
          Pipeline Activity
        </h3>
        
        {/* Toggle Mode */}
        <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1 text-[10px] font-semibold rounded-md transition ${
              viewMode === "cards"
                ? "bg-accent-gold text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Active Cards
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1 text-[10px] font-semibold rounded-md transition ${
              viewMode === "raw"
                ? "bg-accent-gold text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Raw Logs
          </button>
        </div>
      </div>

      {viewMode === "cards" ? (
        /* Active Cards View */
        <div className="space-y-4">
          {tracks.map((track) => {
            // Find the latest active/passed step in the track to show by default
            let latestStepKey = "INFO";
            for (const stage of STAGES) {
              const status = getStepStatus(track, stage.key).status;
              if (status !== "pending") {
                latestStepKey = stage.key;
              }
            }

            const currentSelectedStageKey = selectedStages[track.symbol] || latestStepKey;
            const currentStepDetail = getStepStatus(track, currentSelectedStageKey);

            return (
              <div key={track.symbol} className="bg-gray-950/40 border border-gray-800 rounded-xl p-4 transition hover:border-gray-700/60">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-white tracking-wider">{track.symbol}</span>
                    {track.direction && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        track.direction === "BUY" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {track.direction}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Updated {new Date(track.lastUpdateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </span>
                </div>

                {/* Horizontal Stepper */}
                <div className="relative flex items-center justify-between px-2 mb-4">
                  {/* Connecting Line */}
                  <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[1px] bg-gray-800 -z-10" />

                  {STAGES.map((stage) => {
                    const stepInfo = getStepStatus(track, stage.key);
                    const isSelected = currentSelectedStageKey === stage.key;
                    
                    let bgClass = "bg-gray-900 border-gray-800 text-gray-600";
                    let iconColor = "text-gray-600";

                    if (stepInfo.status === "passed") {
                      bgClass = "bg-accent-gold/10 border-accent-gold text-accent-gold cursor-pointer";
                      iconColor = "text-accent-gold";
                    } else if (stepInfo.status === "active") {
                      bgClass = "bg-accent-gold/25 border-accent-gold text-accent-gold ring-2 ring-accent-gold/20 animate-pulse cursor-pointer";
                      iconColor = "text-accent-gold";
                    } else if (stepInfo.status === "success") {
                      bgClass = "bg-green-500/15 border-green-500 text-green-400 cursor-pointer";
                      iconColor = "text-green-400";
                    } else if (stepInfo.status === "error") {
                      bgClass = "bg-red-500/15 border-red-500 text-red-400 cursor-pointer";
                      iconColor = "text-red-400";
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
                        className="flex flex-col items-center gap-1.5 z-10"
                      >
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${bgClass} ${
                          isSelected ? "scale-110 shadow-[0_0_10px_rgba(212,175,55,0.15)] border-2" : ""
                        }`}>
                          <StageIcon className={`w-4 h-4 ${iconColor}`} />
                        </div>
                        <span className={`text-[9px] font-semibold tracking-wide ${
                          isSelected ? "text-white" : "text-gray-500"
                        }`}>
                          {stage.key === "EXECUTION" 
                            ? (stepInfo.status === "error" ? "No Trade" : stepInfo.status === "success" ? "Trade" : "Execution")
                            : stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Stage Detail Console */}
                {currentStepDetail && currentStepDetail.message && (
                  <div className={`mt-3 p-3 bg-gray-950 rounded-lg border font-mono text-[11px] leading-relaxed transition ${
                    currentStepDetail.status === "error" 
                      ? "border-red-900/30 text-red-400/90" 
                      : currentStepDetail.status === "success" 
                        ? "border-green-900/30 text-green-400/90" 
                        : "border-gray-800 text-gray-300"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5 opacity-60 text-[9px] uppercase tracking-wider">
                      <span>Detail: {currentSelectedStageKey}</span>
                      {currentStepDetail.time && (
                        <span>{new Date(currentStepDetail.time).toLocaleTimeString([], { hour12: false })}</span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{currentStepDetail.message}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Raw Logs View (Original list) */
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-gray-800/60">
            {["", ...logTypes].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-0.5 text-[9px] rounded font-medium transition ${
                  filterType === type
                    ? "bg-accent-gold text-black"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {type || "All"}
              </button>
            ))}
          </div>

          {/* Logs scrollable area */}
          <div className="max-h-80 overflow-y-auto bg-gray-950/40 rounded-lg border border-gray-800">
            <div className="divide-y divide-gray-800/50">
              {[...filteredRawLogs].reverse().map((log, i) => {
                const meta = LOG_ICONS[log.type] || LOG_ICONS.INFO;
                const Icon = meta.icon;

                return (
                  <div key={i} className="px-4 py-2 hover:bg-gray-800/30 transition">
                    <div className="flex items-start gap-2.5">
                      <Icon className={`w-3.5 h-3.5 mt-0.5 ${meta.color} shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-300">{log.message}</p>
                        <p className="text-[9px] text-gray-600 mt-0.5">
                          {new Date(log.time).toLocaleDateString("en-GB") + " " + new Date(log.time).toLocaleTimeString([], { hour12: false })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

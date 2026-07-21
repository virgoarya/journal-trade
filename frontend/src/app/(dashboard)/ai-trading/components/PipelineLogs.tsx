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

const CircuitTrace = ({ dx, dy, color, delay = "0s", className = "" }: { dx: number; dy: number; color: string; delay?: string; className?: string }) => {
  const w = Math.abs(dx);
  const h = Math.abs(dy);
  
  const animationClass = dx > 0 ? "animate-[circuitFlow_2s_linear_infinite]" : "animate-[circuitFlowReverse_2s_linear_infinite]";

  if (h === 0) {
     return (
       <svg width={w} height={4} className={`absolute pointer-events-none overflow-visible ${className}`} style={{ left: dx > 0 ? 0 : -w, top: -2, zIndex: -5 }}>
         <path d={`M ${dx > 0 ? 0 : w},2 L ${dx > 0 ? w : 0},2`} stroke={color} strokeWidth="2" opacity="0.4" />
         <path d={`M ${dx > 0 ? 0 : w},2 L ${dx > 0 ? w : 0},2`} stroke={color} strokeWidth="2" opacity="1" strokeDasharray="6 40" className={animationClass} style={{ filter: `drop-shadow(0 0 6px ${color})`, animationDelay: delay }} />
         <circle cx={dx > 0 ? w : 0} cy="2" r="4" fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})`, animationDelay: delay }} className="animate-pulse" />
       </svg>
     );
  }

  const startX = dx > 0 ? 0 : w;
  const startY = dy > 0 ? 0 : h;
  const eX = dx > 0 ? w : 0;
  const eY = dy > 0 ? h : 0;
  
  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;
  
  let p = `M ${startX},${startY}`;
  if (w >= h) {
     const straight1 = Math.min(25, (w - h) / 2);
     const px1 = startX + signX * straight1;
     p += ` L ${px1},${startY}`;
     const px2 = px1 + signX * h;
     const py2 = startY + signY * h;
     p += ` L ${px2},${py2}`;
     p += ` L ${eX},${eY}`;
  } else {
     const straightY = (h - w) / 2;
     const py1 = startY + signY * straightY;
     p += ` L ${startX},${py1}`;
     const px2 = startX + signX * w;
     const py2 = py1 + signY * w;
     p += ` L ${px2},${py2}`;
     p += ` L ${eX},${eY}`;
  }
  
  return (
    <svg width={w} height={h} className={`absolute pointer-events-none overflow-visible ${className}`} style={{ left: dx > 0 ? 0 : -w, top: dy > 0 ? 0 : -h, zIndex: -5 }}>
      <path d={p} fill="none" stroke={color} strokeWidth="2" opacity="0.3" />
      <path d={p} fill="none" stroke={color} strokeWidth="2" opacity="1" strokeDasharray="6 40" className={animationClass} style={{ filter: `drop-shadow(0 0 8px ${color})`, animationDelay: delay }} />
      <circle cx={eX} cy={eY} r="3" fill={color} className="animate-pulse" style={{ filter: `drop-shadow(0 0 8px ${color})`, animationDelay: delay }} />
    </svg>
  );
};

const DECORATIVE_TRACES = [
  [{ dx: 85, dy: -16, delay: '0s' }, { dx: 70, dy: 16, delay: '0.2s' }, { dx: 95, dy: -8, delay: '0.4s' }],
  [{ dx: 80, dy: -24, delay: '0.1s' }, { dx: 90, dy: 12, delay: '0.8s' }, { dx: -75, dy: 20, delay: '0.3s' }, { dx: -65, dy: -12, delay: '0.5s' }],
  [{ dx: 85, dy: 20, delay: '0.6s' }, { dx: -80, dy: -16, delay: '0.9s' }, { dx: 95, dy: -12, delay: '0.4s' }, { dx: -70, dy: 8, delay: '0.7s' }],
  [{ dx: -80, dy: 16, delay: '1s' }, { dx: 85, dy: -20, delay: '0.1s' }, { dx: -90, dy: -12, delay: '0.5s' }, { dx: 75, dy: 8, delay: '0.2s' }],
  [{ dx: -95, dy: -16, delay: '0.5s' }, { dx: -75, dy: 24, delay: '0.2s' }, { dx: -85, dy: 12, delay: '0.8s' }]
];

export function PipelineLogs({ logs, config, isLoading }: PipelineLogsProps) {
  const [viewMode, setViewMode] = useState<"cards" | "raw">("cards");
  const [filterType, setFilterType] = useState("");
  
  // State for which step is selected to view details in each symbol card
  // Map of symbol -> stageKey
  const [selectedStages, setSelectedStages] = useState<Record<string, string>>({});

  const logTypes = ["INFO", "SIGNAL", "CONFLUENCE", "TRADE", "TRAILING", "ERROR"];

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
      // Check if it's a global pipeline message (start or config update)
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
      // Fallback to match 5-8 letter uppercase words for indices like US500 or pairs like BTCUSD
      if (!symbol) {
        const symbolMatch = log.message.match(/\b([A-Z]{5,8})\b/);
        if (symbolMatch && !["SIGNAL", "PIPELINE", "CONFLUENCE", "TRAILING"].includes(symbolMatch[1])) {
          symbol = symbolMatch[1];
        }
      }
      
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
          // Siklus baru: reset tahapan berikutnya
          track.stages.CONFLUENCE = { status: "pending" };
          track.stages.EXECUTION = { status: "pending" };
          track.stages.TRAILING = { status: "pending" };
        } else if (log.type === "CONFLUENCE") {
          let status: "active" | "error" | "success" | "pending" = "active";
          if (log.message.includes("NO TRADE") || log.message.includes("SKIP") || log.message.includes("tidak valid") || log.message.includes("dibatalkan")) {
            status = "error";
          } else if (log.message.includes("TRADE") || log.message.includes("GOOD")) {
            status = "success";
          }
          
          track.stages.CONFLUENCE = { status, message: log.message, time };
          track.stages.EXECUTION = { status: "pending" }; // Reset execution
          track.stages.TRAILING = { status: "pending" };
        } else if (log.type === "TRADE") {
          // Check if this is a pending order placement or a filled market order
          if (log.message.toLowerCase().includes("pending") || log.message.toLowerCase().includes("limit") || log.message.toLowerCase().includes("stop")) {
            track.stages.EXECUTION = { status: "active", message: log.message, time }; // Yellow: pending order waiting
          } else {
            track.stages.EXECUTION = { status: "success", message: log.message, time }; // Green: filled/executed
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
        // Apply global info to all active configured symbols
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
      if (stages.INFO.status !== "pending") return { ...stages.INFO, status: "passed" };
      if (stages.SIGNAL.status !== "pending" || stages.CONFLUENCE.status !== "pending" || stages.EXECUTION.status !== "pending" || stages.TRAILING.status !== "pending") {
        return { status: "passed", message: "Pipeline initialized." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "SIGNAL") {
      if (stages.SIGNAL.status === "error") return { ...stages.SIGNAL, status: "error" };
      if (stages.SIGNAL.status === "success") return { ...stages.SIGNAL, status: "success" };
      if (stages.SIGNAL.status !== "pending") return { ...stages.SIGNAL, status: "passed" };
      if (stages.CONFLUENCE.status !== "pending" || stages.EXECUTION.status !== "pending" || stages.TRAILING.status !== "pending") {
        return { status: "passed", message: "Signal detected." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "CONFLUENCE") {
      if (stages.CONFLUENCE.status === "error") return { ...stages.CONFLUENCE, status: "error" };
      if (stages.CONFLUENCE.status === "success") return { ...stages.CONFLUENCE, status: "success" };
      if (stages.CONFLUENCE.status !== "pending") return { ...stages.CONFLUENCE, status: "passed" };
      if (stages.EXECUTION.status !== "pending" || stages.TRAILING.status !== "pending") {
        return { status: "passed", message: "Confluence checks completed." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "EXECUTION") {
      if (stages.EXECUTION.status === "error") return { ...stages.EXECUTION, status: "error" };
      if (stages.EXECUTION.status === "success") return { ...stages.EXECUTION, status: "success" };
      
      // Jika status aktif tapi belum sukses, tandai sebagai 'active' (kuning) untuk pending order
      if (stages.EXECUTION.status === "active") return { ...stages.EXECUTION, status: "active" };

      if (stages.TRAILING.status !== "pending") {
        return { status: "success", message: "Trade executed." };
      }
      return { status: "pending" };
    }
    
    if (stepKey === "TRAILING") {
      if (stages.TRAILING.status !== "pending") return { ...stages.TRAILING, status: "active" };
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
    <div className="glass p-5 overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-accent-gold/20 pb-3">
        <h3 className="text-[11px] font-bold text-accent-gold tracking-widest uppercase flex items-center gap-2 drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          <Layers className="w-4 h-4" />
          Pipeline Circuit
        </h3>
        
        {/* Toggle Mode */}
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
              <div key={track.symbol} className="bg-black/30 border border-accent-gold/10 rounded-xl p-4 transition hover:border-accent-gold/30 hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] group">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-text-primary tracking-widest font-mono drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]">{track.symbol}</span>
                    {track.direction && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border ${
                        track.direction === "BUY" ? "bg-neon-green/10 text-neon-green border-neon-green/30 shadow-[0_0_8px_rgba(57,255,136,0.2)]" : "bg-neon-red/10 text-neon-red border-neon-red/30 shadow-[0_0_8px_rgba(255,56,100,0.2)]"
                      }`}>
                        {track.direction}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-accent-gold-dim font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-pulse"></span>
                    SYNC: {new Date(track.lastUpdateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </span>
                </div>

                {/* Circuit Path Stepper */}
                <div className="relative flex items-start justify-between px-8 mb-2 overflow-x-auto pb-8 pt-6 gap-4">
                  {/* CSS Animation for data flow */}
                  <style dangerouslySetInnerHTML={{__html: `
                    @keyframes circuitFlow {
                      from { stroke-dashoffset: 46; }
                      to { stroke-dashoffset: 0; }
                    }
                    @keyframes circuitFlowReverse {
                      from { stroke-dashoffset: 0; }
                      to { stroke-dashoffset: 46; }
                    }
                  `}} />
                  
                  {/* Animated Circuit Data Vein */}
                  <svg className="absolute left-6 right-6 top-[44px] h-2 -translate-y-1/2 -z-10 pointer-events-none" style={{ width: 'calc(100% - 3rem)', overflow: 'visible' }}>
                    {/* Background Track */}
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#D4AF37" strokeWidth="1" opacity="0.15" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#D4AF37" strokeWidth="1" strokeDasharray="2 4" opacity="0.25" />
                    
                    {/* Active Data Flow Packets */}
                    <line 
                      x1="0" y1="50%" x2="100%" y2="50%" 
                      stroke="#39FF88" strokeWidth="2" 
                      strokeDasharray="6 40" 
                      className="animate-[circuitFlow_1s_linear_infinite]" 
                      style={{ filter: "drop-shadow(0 0 6px rgba(57,255,136,0.8))" }}
                      opacity="0.9"
                    />
                  </svg>

                  {STAGES.map((stage, index) => {
                    const stepInfo = getStepStatus(track, stage.key);
                    const isSelected = currentSelectedStageKey === stage.key;
                    
                    let nodeClass = "bg-black/60 backdrop-blur-md border-accent-gold/20 text-text-muted";
                    let iconColor = "text-text-muted";
                    let glowClass = "";
                    let traceColor = "#00F0FF";

                    if (stepInfo.status === "passed") {
                      nodeClass = "bg-accent-gold/10 backdrop-blur-md border-accent-gold/50 text-accent-gold cursor-pointer";
                      iconColor = "text-accent-gold";
                      traceColor = "#00F0FF";
                    } else if (stepInfo.status === "active") {
                      nodeClass = "bg-accent-gold/20 backdrop-blur-md border-accent-gold text-accent-gold cursor-pointer animate-pulse";
                      iconColor = "text-accent-gold";
                      glowClass = "shadow-[0_0_15px_rgba(212,175,55,0.6)]";
                      traceColor = "#D4AF37";
                    } else if (stepInfo.status === "success") {
                      nodeClass = "bg-neon-green/10 backdrop-blur-md border-neon-green text-neon-green cursor-pointer";
                      iconColor = "text-neon-green";
                      glowClass = "shadow-[0_0_15px_rgba(57,255,136,0.4)]";
                      traceColor = "#39FF88";
                    } else if (stepInfo.status === "error") {
                      nodeClass = "bg-neon-red/10 backdrop-blur-md border-neon-red text-neon-red cursor-pointer";
                      iconColor = "text-neon-red";
                      glowClass = "shadow-[0_0_15px_rgba(255,56,100,0.6)] animate-pulse";
                      traceColor = "#FF3864";
                    }

                    const StageIcon = stage.icon;
                    const traces = DECORATIVE_TRACES[index] || [];

                    return (
                      <div
                        key={stage.key}
                        onClick={() => {
                          if (stepInfo.status !== "pending") {
                            setSelectedStages(prev => ({ ...prev, [track.symbol]: stage.key }));
                          }
                        }}
                        className="flex flex-col items-center gap-2 z-10 relative group-node cursor-pointer"
                      >
                        {/* Intricate Decorative Circuit Branches */}
                        <div className="absolute top-[20px] left-[50%] -z-10">
                          {traces.map((t, i) => (
                            <CircuitTrace key={i} dx={t.dx} dy={t.dy} color={traceColor} delay={t.delay} />
                          ))}
                        </div>

                        <div className="relative">
                          {/* Animated Circuit Ring for Selected Node */}
                          {isSelected && (
                            <div className={`absolute inset-[-6px] rounded-full border border-dashed animate-[spin_4s_linear_infinite] opacity-60 ${
                              stepInfo.status === 'success' ? 'border-neon-green' : stepInfo.status === 'error' ? 'border-neon-red' : 'border-accent-gold'
                            }`} />
                          )}
                          
                          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${nodeClass} ${glowClass} ${
                            isSelected ? "scale-110 shadow-[0_0_20px_currentColor]" : ""
                          }`}>
                            <StageIcon className={`w-4 h-4 ${iconColor}`} />
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold tracking-widest uppercase font-mono ${
                          isSelected ? (stepInfo.status === 'success' ? 'text-neon-green drop-shadow-[0_0_2px_rgba(57,255,136,0.8)]' : stepInfo.status === 'error' ? 'text-neon-red drop-shadow-[0_0_2px_rgba(255,56,100,0.8)]' : 'text-accent-gold drop-shadow-[0_0_2px_rgba(212,175,55,0.8)]') : "text-text-muted/60"
                        }`}>
                          {stage.key === "EXECUTION" 
                            ? (stepInfo.status === "error" ? "Block" : stepInfo.status === "success" ? "Exec" : "Exec")
                            : stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Stage Detail Console */}
                {currentStepDetail && currentStepDetail.message && (
                  <div className={`mt-2 p-3 bg-black/60 rounded border font-mono text-[10px] leading-relaxed transition shadow-inner relative overflow-hidden ${
                    currentStepDetail.status === "error" 
                      ? "border-neon-red/30 text-neon-red" 
                      : currentStepDetail.status === "success" 
                        ? "border-neon-green/30 text-neon-green" 
                        : "border-accent-gold/20 text-accent-gold"
                  }`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/[0.02] pointer-events-none" />
                    <div className="flex items-center justify-between mb-2 opacity-70 text-[9px] uppercase tracking-widest border-b border-current/10 pb-1">
                      <span>{">"} SYS.LOG.{currentSelectedStageKey}</span>
                      {currentStepDetail.time && (
                        <span>{new Date(currentStepDetail.time).toLocaleTimeString([], { hour12: false })}</span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{renderLogMessage(currentStepDetail.message || "")}</div>
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
                        <div className="text-xs text-gray-300 whitespace-pre-wrap">{renderLogMessage(log.message)}</div>
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

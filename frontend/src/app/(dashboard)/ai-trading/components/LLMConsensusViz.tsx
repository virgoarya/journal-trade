"use client";

import { useRef, useMemo, useState, useEffect, Suspense, lazy } from "react";
import { type LLMConsensusResult, type LLMConsensusVote, MODEL_COLORS, type LlmModelNode, ALL_LLM_PROVIDERS } from "../types";
import { SkeletonLoader } from "./SkeletonLoader";
import { ErrorBoundary } from "./ErrorBoundary";
import { BrainCircuit, Cpu, Sparkles, Zap, Box, Terminal, Brain } from "lucide-react";

// ─── Types & Constants ───────────────────────────────────

interface Props {
  votes?: LLMConsensusResult | null;
  modelStatus?: LlmModelNode[];
  threshold?: number;
}

const MODEL_ICONS: Record<string, string> = {
  deepseek: "/deepseek.png",
  gpt: "/gpt.png",
  gemini: "/gemini.png",
  mistral: "/mistral.png",
  nemotron: "/nemotron.png",
  "claude-opus": "/claude.png",
};

// ─── 2D Fallback Component ──────────────────────────────
function Consensus2DFallback({ currentProviders, votes }: { currentProviders: any[], votes: any }) {
  return (
    <div className="flex items-center justify-center h-full p-8 relative">
      {/* CSS Animation for data flow */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dataFlow {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        .data-stream {
          animation: dataFlow 1s linear infinite;
        }
      `}} />
      
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.05)_0%,_transparent_70%)] pointer-events-none"></div>

      <div className="relative">
        {/* Background Radar Scanning Sweep (Perfectly centered behind core) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full pointer-events-none opacity-40 flex items-center justify-center z-0">
          {/* Radar Sweep Animation */}
          <div className="absolute inset-0 rounded-full animate-[spin_4s_linear_infinite]"
               style={{ background: "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(212,175,55,0.4) 360deg)" }}>
          </div>
          
          {/* Concentric Grid Lines */}
          <div className="absolute inset-0 border border-accent-gold/30 rounded-full shadow-[inset_0_0_20px_rgba(212,175,55,0.1)]"></div>
          <div className="absolute inset-0 m-auto w-[360px] h-[360px] border border-accent-gold/20 border-dashed animate-[spin_40s_linear_infinite] rounded-full"></div>
          <div className="absolute inset-0 m-auto w-[280px] h-[280px] border border-accent-gold/10 rounded-full"></div>
          
          {/* Crosshairs */}
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-accent-gold/20 -translate-x-1/2"></div>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-accent-gold/20 -translate-y-1/2"></div>
        </div>

        {/* Global Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
          {currentProviders.map((provider, i) => {
            const angle = (i / currentProviders.length) * Math.PI * 2 - Math.PI / 2;
            const radius = 135;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const vote = votes?.votes ? votes.votes.find((v: any) => v.provider === provider.name) : null;
            const statusColor = !vote ? "#4B5563" : vote.decision === "GOOD" ? "#39FF88" : vote.decision === "BAD" ? "#FF3864" : "#EAB308";
            
            return (
              <g key={`line-${provider.name}`}>
                <line 
                  x1="50%" y1="50%"
                  x2={`calc(50% + ${x}px)`} y2={`calc(50% + ${y}px)`}
                  stroke={statusColor} strokeWidth={vote ? "2" : "1"} opacity={vote ? "0.8" : "0.3"}
                  strokeDasharray={vote ? "4 4" : "2 6"}
                  className="data-stream"
                />
                {vote && (
                  <line 
                    x1="50%" y1="50%"
                    x2={`calc(50% + ${x}px)`} y2={`calc(50% + ${y}px)`}
                    stroke={statusColor} strokeWidth="6" opacity="0.15"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Giant Jarvis Radar GIF (Moved OUT of stacking context so blend mode works on background) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] flex items-center justify-center mix-blend-screen pointer-events-none z-10" 
             style={{ 
               filter: "hue-rotate(215deg) contrast(1.5) saturate(2)"
             }}>
          <img src="/jarvis-core.gif" alt="Core Reactor" className="w-full h-full object-contain opacity-90" />
        </div>



        {/* Global Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
          {currentProviders.map((provider, i) => {
            const angle = (i / currentProviders.length) * Math.PI * 2 - Math.PI / 2;
            const radius = 135;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const vote = votes?.votes ? votes.votes.find((v: any) => v.provider === provider.name) : null;
            const statusColor = !vote ? "#4B5563" : vote.decision === "GOOD" ? "#39FF88" : vote.decision === "BAD" ? "#FF3864" : "#EAB308";
            
            return (
              <g key={`line-${provider.name}`}>
                <line 
                  x1="50%" y1="50%"
                  x2={`calc(50% + ${x}px)`} y2={`calc(50% + ${y}px)`}
                  stroke={statusColor} strokeWidth={vote ? "2" : "1"} opacity={vote ? "0.8" : "0.3"}
                  strokeDasharray={vote ? "4 4" : "2 6"}
                  className="data-stream"
                />
                {vote && (
                  <line 
                    x1="50%" y1="50%"
                    x2={`calc(50% + ${x}px)`} y2={`calc(50% + ${y}px)`}
                    stroke={statusColor} strokeWidth="6" opacity="0.15"
                  />
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Orbiting provider nodes */}
        {currentProviders.map((provider, i) => {
          const angle = (i / currentProviders.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 135; // Increased radius to fit larger core
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const vote = votes?.votes ? votes.votes.find((v: any) => v.provider === provider.name) : null;
          const color = MODEL_COLORS[provider.name] || "#6B7280";
          const statusColor = !vote ? "#4B5563" : vote.decision === "GOOD" ? "#39FF88" : vote.decision === "BAD" ? "#FF3864" : "#EAB308";
          
          return (
              <div key={provider.name} className="absolute z-10" style={{ 
                left: `calc(50% + ${x}px - 40px)`, 
                top: `calc(50% + ${y}px - 40px)` 
              }}>
                {/* Node */}
                <div className="group w-20 h-20 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300 hover:scale-125 hover:z-50 cursor-pointer relative"
                     style={{ boxShadow: `0 0 20px ${statusColor}30, inset 0 0 15px ${statusColor}15` }}>
                  
                  {/* Decorative Tech Rings */}
                  <div className="absolute inset-0 rounded-full border border-solid opacity-30 pointer-events-none" style={{ borderColor: color }}></div>
                  <div className="absolute inset-1 rounded-full border border-dashed opacity-50 animate-[spin_10s_linear_infinite] pointer-events-none" style={{ borderColor: color }}></div>
                  <div className="absolute inset-[-4px] rounded-full border-2 border-dotted border-transparent group-hover:border-current opacity-0 group-hover:opacity-60 group-hover:animate-[spin_4s_linear_infinite] pointer-events-none" style={{ color: statusColor }}></div>

                  {/* Perfectly Blended Logo Orb */}
                  {(() => {
                    const src = MODEL_ICONS[provider.name];
                    if (src) {
                      return (
                        <div className="relative w-14 h-14 flex items-center justify-center transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_currentColor]" style={{ color }}>
                          <img 
                            src={src} 
                            alt={provider.label} 
                            className="w-full h-full object-cover mix-blend-screen opacity-90" 
                            style={{
                              maskImage: "radial-gradient(closest-side, black 70%, transparent 100%)",
                              WebkitMaskImage: "radial-gradient(closest-side, black 70%, transparent 100%)"
                            }}
                          />
                        </div>
                      );
                    }
                    return <BrainCircuit className="w-10 h-10 opacity-90 drop-shadow-[0_0_8px_currentColor] relative z-10" style={{ color }} />;
                  })()}
                


                {/* Reasoning Tooltip */}
                {vote && vote.reasoning && (
                  <div className="absolute top-1/2 left-full ml-3 -translate-y-1/2 w-48 p-2 bg-black/90 border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-[0_0_15px_rgba(0,0,0,0.8)] z-50 text-left"
                       style={{ borderColor: statusColor }}>
                    <p className="text-[9px] font-mono text-text-primary whitespace-pre-wrap leading-relaxed">
                      {vote.reasoning}
                    </p>
                  </div>
                )}
              </div>
              </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── Main Export ─────────────────────────────────────────────

export function LLMConsensusViz({ votes, modelStatus, threshold = 0.5 }: Props) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <SkeletonLoader type="card" />;
  }

  const goodVotes = votes?.goodVotes ?? 0;
  const badVotes = votes?.badVotes ?? 0;
  const skipVotes = votes?.skipVotes ?? 0;
  const totalEffectiveVotes = goodVotes + badVotes;
  const goodRatio = totalEffectiveVotes > 0 ? goodVotes / totalEffectiveVotes : 0;
  const consensusReached = votes?.consensusReached ?? false;

  const verdictStyle = votes ? (
    votes.verdict === "GOOD" ? "bg-neon-green/20 text-neon-green border-neon-green/40 shadow-[0_0_15px_rgba(57,255,136,0.3)]"
    : votes.verdict === "BAD" ? "bg-neon-red/20 text-neon-red border-neon-red/40 shadow-[0_0_15px_rgba(255,56,100,0.3)]"
    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.3)]"
  ) : "bg-black/60 text-text-muted border-accent-gold/20";

  const currentProviders = ALL_LLM_PROVIDERS.map(defaultProvider => {
    const statusFromProps = modelStatus?.find(m => m.name === defaultProvider.name);
    return { ...defaultProvider, status: statusFromProps?.status || defaultProvider.status };
  });

  const activeCount = currentProviders.filter((m) => m.status === "active").length;

  return (
    <div className="hud-panel p-0 overflow-hidden relative flex flex-col h-[500px]">
      {/* Overlay UI */}
      <div className="absolute inset-x-0 top-0 p-4 z-10 pointer-events-none flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-accent-gold uppercase tracking-widest drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
              Neural Consensus
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border tracking-widest transition-all duration-300 font-mono ${verdictStyle}`}>
              {votes?.verdict || "AWAITING DATA"}
            </span>
          </div>
          
          {totalEffectiveVotes > 0 && (
            <div className="bg-black/60 border border-accent-gold/20 p-2 rounded backdrop-blur-sm pointer-events-auto w-48">
              <div className="flex justify-between text-[9px] font-mono mb-1.5 uppercase tracking-wider">
                <span className="text-text-muted">Agreement</span>
                <span className={consensusReached ? "text-neon-green" : "text-neon-red"}>
                  {Math.round(goodRatio * 100)}%
                </span>
              </div>
              <div className="h-1 bg-black rounded-full overflow-hidden border border-gray-800">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${goodRatio * 100}%`,
                    backgroundColor: goodRatio >= threshold ? "#39FF88" : "#FF3864",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-black/60 border border-accent-gold/20 p-2 rounded backdrop-blur-sm pointer-events-auto">
          <div className="flex flex-col items-end gap-1 font-mono text-[9px] uppercase tracking-wider">
            <span className="text-text-muted">Active Nodes: <span className="text-accent-gold">{activeCount}/{ALL_LLM_PROVIDERS.length}</span></span>
            {votes && (
              <span className="text-text-muted">
                Votes: 
                <span className="text-neon-green ml-1">{goodVotes}G</span> /
                <span className="text-neon-red mx-1">{badVotes}B</span> /
                <span className="text-yellow-400">{skipVotes}S</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2D Visualization */}
      <div className="flex-1 w-full h-full bg-black relative overflow-hidden flex items-center justify-center">
        <Consensus2DFallback currentProviders={currentProviders} votes={votes} />
      </div>

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none terminal-scanline opacity-20 mix-blend-overlay"></div>
    </div>
  );
}

"use client";

import { BrainCircuit } from "lucide-react";
import { MODEL_COLORS, type LlmModelNode } from "../types";
import type { LLMConsensusResult } from "../types";

// ─── Constants ───────────────────────────────────────────────────

const MODEL_ICONS: Record<string, string> = {
  deepseek: "/deepseek.png",
  gpt: "/gpt.png",
  gemini: "/gemini.png",
  mistral: "/mistral.png",
  nemotron: "/nemotron.png",
  "claude-opus": "/claude.png",
};

interface Consensus2DFallbackProps {
  currentProviders: LlmModelNode[];
  votes?: LLMConsensusResult | null;
  showIndicators?: boolean;
}

// ─── 2D Fallback Component ─────────────────────────────────────

export function Consensus2DFallback({ currentProviders, votes, showIndicators = true }: Consensus2DFallbackProps) {
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
            const vote = votes?.votes ? votes.votes.find(v => v.provider === provider.name) : null;

            // Check alignment with final consensus
            // SKIP is neutral - calculate alignment only for GOOD/BAD verdicts
            const isAligned = vote && votes && vote.verdict !== "SKIP" && vote.verdict === votes.verdict;
            const statusColor = !vote ? "#4B5563" : vote.verdict === "GOOD" ? "#39FF88" : vote.verdict === "BAD" ? "#FF3864" : "#EAB308";

            const lineOpacity = showIndicators ? (!vote ? "0.3" : isAligned ? "0.9" : "0.15") : "0.3";
            const lineWidth = showIndicators ? (!vote ? "1" : isAligned ? "3" : "1") : "1";

            return (
              <g key={`line-${provider.name}`}>
                <line
                  x1="50%" y1="50%"
                  x2={`calc(50% + ${x}px)`} y2={`calc(50% + ${y}px)`}
                  stroke={statusColor} strokeWidth={lineWidth} opacity={lineOpacity}
                  strokeDasharray={vote ? (isAligned ? "none" : "4 4") : "2 6"}
                  className={isAligned ? "data-stream" : ""}
                />
                {vote && isAligned && (
                  <line
                    x1="50%" y1="50%"
                    x2={`calc(50% + ${x}px)`} y2={`calc(50% + ${y}px)`}
                    stroke={statusColor} strokeWidth="8" opacity="0.1"
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

        {/* Orbiting provider nodes */}
        {currentProviders.map((provider, i) => {
          const angle = (i / currentProviders.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 135; // Increased radius to fit larger core
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const vote = votes?.votes ? votes.votes.find(v => v.provider === provider.name) : null;
          const color = MODEL_COLORS[provider.name] || "#6B7280";

          // Check alignment with final consensus
          // SKIP is neutral - calculate alignment only for GOOD/BAD verdicts
          const isAligned = vote && votes && vote.verdict !== "SKIP" && vote.verdict === votes.verdict;
          const statusColor = !vote ? "#4B5563" : vote.verdict === "GOOD" ? "#39FF88" : vote.verdict === "BAD" ? "#FF3864" : "#EAB308";

          const nodeGlowOpacity = !vote ? "30" : isAligned ? "60" : "10";
          const nodeGlowIntensity = !vote ? "15" : isAligned ? "25" : "5";

          return (
              <div key={provider.name} className="absolute z-10" style={{
                left: `calc(50% + ${x}px - 40px)`,
                top: `calc(50% + ${y}px - 40px)`
              }}>
                {/* Node */}
                <div className="group w-20 h-20 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300 hover:scale-125 hover:z-50 cursor-pointer relative"
                     style={{ boxShadow: showIndicators ? `0 0 20px ${statusColor}${nodeGlowOpacity}, inset 0 0 15px ${statusColor}${nodeGlowIntensity}` : "" }}>


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
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[8px] font-bold ${vote.verdict === "SKIP" ? "text-yellow-400" : isAligned ? "text-neon-green" : "text-neon-red"}`}>
                        {vote.verdict === "SKIP" ? "⊘ Skipped" : isAligned ? "✓ Contributed" : "✗ Overruled"}
                      </span>
                    </div>
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

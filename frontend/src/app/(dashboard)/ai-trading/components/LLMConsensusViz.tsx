"use client";

import { type LLMConsensusResult, type LLMConsensusVote } from "@/services/ai-trading.service";
import { Zap, ZapOff } from "lucide-react";

interface ModelNode {
  name: string;
  label: string;
  model: string;
  status: "active" | "hibernasi";
}

interface Props {
  votes?: LLMConsensusResult | null;
  modelStatus?: ModelNode[];
  threshold?: number;
}

const MODEL_COLORS: Record<string, string> = {
  deepseek: "#8B5CF6",     // violet
  qwen: "#3B82F6",         // blue
  gemini: "#10B981",       // emerald
  mistral: "#F59E0B",      // amber
  nemotron: "#EF4444",     // red
  "claude-opus": "#D4AF37", // gold
};

const VERDICT_COLORS: Record<string, string> = {
  GOOD: "#22C55E",
  BAD: "#EF4444",
  SKIP: "#EAB308",
};

const NODES = [
  { name: "deepseek", label: "DeepSeek", angle: -90 },     // top
  { name: "qwen", label: "Qwen", angle: -30 },             // top-right
  { name: "gemini", label: "Gemini", angle: 30 },           // bottom-right
  { name: "mistral", label: "Mistral", angle: 90 },         // bottom
  { name: "nemotron", label: "Nemotron", angle: 150 },      // bottom-left
  { name: "claude-opus", label: "Claude", angle: 210 },     // top-left
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function getVoteForModel(votes: LLMConsensusVote[], name: string): LLMConsensusVote | undefined {
  return votes.find((v) => v.provider === name);
}

export function LLMConsensusViz({ votes, modelStatus, threshold = 0.5 }: Props) {
  const cx = 150, cy = 150, orbitR = 100, centerR = 22;
  const goodRatio = votes && votes.totalVotes > 0 ? votes.goodVotes / (votes.goodVotes + votes.badVotes) : 0;
  const verdictColor = votes ? VERDICT_COLORS[votes.verdict] || "#6B7280" : "#6B7280";
  const activeCount = modelStatus?.filter((m) => m.status === "active").length ?? 6;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">AI Consensus</span>
          {votes && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              votes.verdict === "GOOD" ? "bg-green-500/20 text-green-400" :
              votes.verdict === "BAD" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
            }`}>
              {votes.verdict}
            </span>
          )}
        </div>
        <span className="text-[9px] text-gray-600">{activeCount}/6 active</span>
      </div>

      {/* SVG Canvas */}
      <svg viewBox="0 0 300 300" className="w-full h-full" style={{ maxHeight: 210 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="centerGlow">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Orbit ring */}
        <circle cx={cx} cy={cy} r={orbitR} fill="none" stroke="#1f2937" strokeWidth="1" strokeDasharray="4,4" />

        {/* Threshold ring */}
        <circle cx={cx} cy={cy} r={40} fill="none" stroke={verdictColor} strokeWidth="1.5" strokeDasharray="3,3" opacity={0.5} />
        <text x={cx} y={cy - 46} textAnchor="middle" fill="#6B7280" fontSize="7">{Math.round(goodRatio * 100)}%</text>

        {/* Connection lines — from active voting nodes to center */}
        {votes?.votes.map((v) => {
          const node = NODES.find((n) => n.name === v.provider);
          if (!node) return null;
          const start = polarToCartesian(cx, cy, orbitR - 14, node.angle);
          const color = VERDICT_COLORS[v.verdict] || "#6B7280";
          return (
            <line
              key={v.provider}
              x1={start.x} y1={start.y} x2={cx} y2={cy}
              stroke={color} strokeWidth="2" opacity="0.6"
              className="consensus-beam"
            />
          );
        })}

        {/* Model nodes */}
        {NODES.map((node) => {
          const pos = polarToCartesian(cx, cy, orbitR, node.angle);
          const model = modelStatus?.find((m) => m.name === node.name);
          const isActive = model ? model.status === "active" : true;
          const vote = votes ? getVoteForModel(votes.votes, node.name) : undefined;
          const nodeColor = MODEL_COLORS[node.name] || "#6B7280";

          return (
            <g key={node.name} opacity={isActive ? 1 : 0.4}>
              {/* Node circle */}
              <circle cx={pos.x} cy={pos.y} r={14} fill="#111827" stroke={vote ? VERDICT_COLORS[vote.verdict] : nodeColor} strokeWidth="2" filter="url(#glow)" />
              {/* Status dot inside */}
              <circle cx={pos.x} cy={pos.y} r={4} fill={isActive ? "#22C55E" : "#EAB308"} />
              {/* Label */}
              <text x={pos.x} y={pos.y + 26} textAnchor="middle" fill={isActive ? "#9CA3AF" : "#6B7280"} fontSize="7" fontWeight="500">
                {node.label}
              </text>
              {/* Verdict text under label */}
              {vote && (
                <text x={pos.x} y={pos.y + 36} textAnchor="middle" fill={VERDICT_COLORS[vote.verdict]} fontSize="6" fontWeight="bold">
                  {vote.verdict}
                </text>
              )}
            </g>
          );
        })}

        {/* Center — MT5 node */}
        <circle cx={cx} cy={cy} r={centerR} fill="#111827" stroke="#D4AF37" strokeWidth="2.5" filter="url(#centerGlow)" />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill="#D4AF37" fontSize="7" fontWeight="bold">MT5</text>

        {/* Good/Bad/Total text */}
        {votes && (
          <text x={cx} y={cy + 50} textAnchor="middle" fill="#6B7280" fontSize="7">
            <tspan fill="#22C55E">{votes.goodVotes}</tspan>G / <tspan fill="#EF4444">{votes.badVotes}</tspan>B / <tspan fill="#EAB308">{votes.skipVotes}</tspan>S
          </text>
        )}
      </svg>

      {/* Bottom legend — only shown when pipeline running */}
      {modelStatus && modelStatus.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 pb-1 justify-center">
          {modelStatus.map((m) => (
            <span key={m.name} className="flex items-center gap-1 text-[8px] text-gray-500">
              {m.status === "active" ? (
                <Zap className="w-2.5 h-2.5 text-green-400" />
              ) : (
                <ZapOff className="w-2.5 h-2.5 text-yellow-500" />
              )}
              {m.label}:{m.status === "active" ? " OK" : " zzz"}
            </span>
          ))}
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes beamPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.9; }
        }
        .consensus-beam {
          animation: beamPulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

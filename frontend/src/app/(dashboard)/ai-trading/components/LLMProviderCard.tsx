"use client";

import { type LLMConsensusVote, type LLMConsensusResult, MODEL_COLORS, VERDICT_STYLES, type LlmModelNode } from "../types";
import { LLMProviderLogo } from "./llm-logos";
import { Zap, ZapOff, Clock, AlertCircle } from "lucide-react";
import { parseReasoningPoints } from "../utils/reasoningParser";

// ─── Types ───────────────────────────────────────────────────────────

interface LLMProviderCardProps {
  provider: LlmModelNode;
  vote?: LLMConsensusVote | null;
  color: string;
  votes?: LLMConsensusResult | null;
}

interface ReasoningSectionProps {
  reasoning: string;
  isAligned?: boolean | null;
  verdict?: string;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// ─── Component ───────────────────────────────────────────────────────

export function LLMProviderCard({ provider, vote, color, votes }: LLMProviderCardProps) {
  const isActive = provider.status === "active";
  const verdictStyle = vote ? VERDICT_STYLES[vote.verdict] : null;

  // Check if this provider's vote aligns with the final consensus verdict
  // ponytail: SKIP excluded from alignment — neutral verdict
  const isAligned = vote && votes && vote.verdict !== "SKIP" && vote.verdict === votes.verdict;

  return (
    <div
      className={`
        bg-gray-900/80 border rounded-xl p-3 transition-all duration-200
        ${isActive ? "hover:bg-gray-800/80 hover:border-gray-700" : "opacity-50"}
        ${vote && verdictStyle ? `border-l-2` : "border-gray-800"}
      `}
      style={vote && isActive ? { borderLeftColor: color } : undefined}
    >
      {/* Row 1: Logo + Provider info + Status */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <LLMProviderLogo provider={provider.name} size={36} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white truncate">{provider.label}</p>
            {isActive ? (
              <Zap className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            ) : (
              <ZapOff className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-[10px] text-gray-500 truncate mt-0.5">{provider.model}</p>
        </div>
      </div>

      {/* Row 2: Verdict badge + Latency */}
      <div className="flex items-center justify-between mt-3">
        {vote && verdictStyle ? (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${verdictStyle.bg} ${verdictStyle.text} ${verdictStyle.border}`}>
            {verdictStyle.label}
          </span>
        ) : (
          <span className="text-[10px] text-gray-600 flex items-center gap-1">
            {isActive ? (
              <>
                <span className="inline-block w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" />
                Waiting...
              </>
            ) : (
              provider.status === "hibernasi" ? "Rate Limited" :
              provider.status === "circuit_open" ? "Error/Timeout" :
              "Inactive"
            )}
          </span>
        )}

        {vote && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Clock className="w-3 h-3" />
            {formatLatency(vote.latencyMs)}
          </span>
        )}
      </div>

      {/* Row 3: Error OR Reasoning */}
      {vote?.error ? (
        <div className="mt-2 flex items-start gap-1.5 text-[10px] text-red-400 bg-red-500/10 rounded-lg p-2">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{vote.error}</span>
        </div>
      ) : vote?.reasoning ? (
        <ReasoningSection reasoning={vote.reasoning} isAligned={isAligned} verdict={vote.verdict} />
      ) : null}
    </div>
  );
}

// ─── Supporting Components ─────────────────────────────────────────

function ReasoningSection({ reasoning, isAligned, verdict }: ReasoningSectionProps) {
  const points = parseReasoningPoints(reasoning);

  // Determine contribution label: SKIP is neutral, not overruled
  const contributionLabel = verdict === "SKIP"
    ? "⊘ Skipped"
    : isAligned
      ? "✓ Contributed"
      : "✗ Overruled";
  const contributionColor = verdict === "SKIP"
    ? "text-yellow-400"
    : isAligned
      ? "text-neon-green"
      : "text-neon-red";

  if (points.length === 0) {
    return (
      <div className="mt-2 group">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-gray-500">Reasoning</span>
          {verdict !== undefined && (
            <span className={`text-[9px] font-bold ${contributionColor}`}>
              {contributionLabel}
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed bg-gray-900/50 rounded-lg p-2 border border-gray-800/50">
          {reasoning}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {/* Contribution indicator + Category tags */}
      <div className="flex items-center gap-2 mb-1">
        {verdict !== undefined && (
          <span className={`text-[9px] font-bold ${contributionColor}`}>
            {contributionLabel}
          </span>
        )}
        <div className="flex flex-wrap gap-1">
          {points.flatMap(p => p.categories).filter((v, i, a) => a.indexOf(v) === i).map((cat, i) => (
            <span
              key={i}
              className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${cat === "SMC" ? "bg-purple-500/20 text-purple-400" : cat === "ICT" ? "bg-blue-500/20 text-blue-300" : cat === "MSNR" ? "bg-orange-500/20 text-orange-300" : cat === "Risk/Reward" ? "bg-green-500/20 text-green-300" : cat === "Fundamental" ? "bg-yellow-500/20 text-yellow-300" : cat === "Structure" ? "bg-cyan-500/20 text-cyan-300" : "bg-gray-500/20 text-gray-300"}`}
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Structured reasoning points */}
      <div className="max-h-40 overflow-y-auto">
        {points.map((point, i) => (
          <div key={i} className="flex items-start gap-2 pb-1 border-b border-gray-800/30 last:border-b-0">
            {/* Bullet point indicator */}
            <span className="text-[10px] text-gray-500 mt-0.5 flex-shrink-0">•</span>

            {/* Category icons */}
            {point.categories.length > 0 && (
              <div className="flex gap-0.5 flex-shrink-0">
                {point.categories.map((cat, j) => (
                  <span
                    key={j}
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${cat === "SMC" ? "bg-purple-400" : cat === "ICT" ? "bg-blue-300" : cat === "MSNR" ? "bg-orange-300" : cat === "Risk/Reward" ? "bg-green-300" : cat === "Fundamental" ? "bg-yellow-300" : cat === "Structure" ? "bg-cyan-300" : "bg-gray-400"}`}
                  />
                ))}
              </div>
            )}

            {/* Reasoning text */}
            <span className="flex-1 min-w-0 text-[10px] text-gray-300">
              {point.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

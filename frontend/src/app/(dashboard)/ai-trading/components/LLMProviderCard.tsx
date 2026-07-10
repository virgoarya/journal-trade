"use client";

import { type LLMConsensusVote, MODEL_COLORS, VERDICT_STYLES, type LlmModelNode } from "../types";
import { LLMProviderLogo } from "./llm-logos";
import { Zap, ZapOff, Clock, AlertCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface LLMProviderCardProps {
  provider: LlmModelNode;
  vote?: LLMConsensusVote | null;
  color: string;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// ─── Component ───────────────────────────────────────────────────────

export function LLMProviderCard({ provider, vote, color }: LLMProviderCardProps) {
  const isActive = provider.status === "active";
  const verdictStyle = vote ? VERDICT_STYLES[vote.verdict] : null;

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
        <details className="mt-2 group">
          <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-400 transition-colors select-none">
            Reasoning
          </summary>
          <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed bg-gray-900/50 rounded-lg p-2 border border-gray-800/50">
            {vote.reasoning}
          </p>
        </details>
      ) : null}
    </div>
  );
}
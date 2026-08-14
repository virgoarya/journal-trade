"use client";

import { type LLMConsensusResult, MODEL_COLORS, type LlmModelNode, ALL_LLM_PROVIDERS } from "../types";
import { LLMProviderCard } from "./LLMProviderCard";

interface Props {
  votes: LLMConsensusResult | null;
  modelStatus: LlmModelNode[];
  threshold: number;
  isOpen: boolean;
  onClose: () => void;
}

export function LLMConsensusBreakdown({ votes, modelStatus, threshold, isOpen, onClose }: Props) {
  if (!isOpen || !votes) return null;

  const goodVotes = votes.goodVotes ?? 0;
  const badVotes = votes.badVotes ?? 0;
  const skipVotes = votes.skipVotes ?? 0;
  const totalEffectiveVotes = goodVotes + badVotes;
  const goodRatio = totalEffectiveVotes > 0 ? goodVotes / totalEffectiveVotes : 0;
  const consensusReached = votes.consensusReached ?? false;

  const currentProviders = ALL_LLM_PROVIDERS.map(defaultProvider => {
    const statusFromProps = modelStatus?.find(m => m.name === defaultProvider.name);
    return { ...defaultProvider, status: statusFromProps?.status || defaultProvider.status };
  });

  return (
    <div className="glass border-t border-accent-gold/20 p-4 mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-accent-gold">Consensus Breakdown</h3>
        <button
          onClick={onClose}
          className="text-[10px] text-gray-500 hover:text-white transition-colors"
        >
          Close
        </button>
      </div>

      {/* Consensus Math */}
      <div className="text-[9px] text-gray-400 mb-3 font-mono">
        <span className="text-accent-gold">{goodVotes}</span> Good / <span className="text-accent-gold">{badVotes}</span> Bad / <span className="text-accent-gold">{skipVotes}</span> Skip → <span className="text-accent-gold">{Math.round(goodRatio * 100)}%</span> ≥ <span className="text-accent-gold">{Math.round(threshold * 100)}%</span> = <span className={`font-bold ${votes.verdict === "GOOD" ? "text-neon-green" : votes.verdict === "BAD" ? "text-neon-red" : "text-yellow-400"}`}>{votes.verdict}</span>
      </div>

      {/* Threshold indicator */}
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-3 border border-gray-700">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out relative"
          style={{
            width: `${goodRatio * 100}%`,
            backgroundColor: goodRatio >= threshold ? "#39FF88" : "#FF3864",
          }}
        >
          <div className="absolute top-[-10px] left-[70%] transform -translate-x-1/2 w-px h-2 bg-accent-gold"></div>
          <span className="absolute top-[-16px] left-[70%] transform -translate-x-1/2 text-[8px] text-accent-gold whitespace-nowrap">
            {Math.round(threshold * 100)}% threshold
          </span>
        </div>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2 mt-2">
        {currentProviders.map(provider => {
          const vote = votes?.votes?.find(v => v.provider === provider.name);
          if (!vote) return null;
          return (
            <LLMProviderCard
              key={provider.name}
              provider={provider}
              vote={vote}
              color={MODEL_COLORS[provider.name] || "#6B7280"}
              votes={votes}
            />
          );
        })}
      </div>
    </div>
  );
}
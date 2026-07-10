"use client";

import { type LLMConsensusResult, type LLMConsensusVote, MODEL_COLORS, VERDICT_STYLES, type LlmModelNode, ALL_LLM_PROVIDERS } from "../types";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import { LLMProviderCard } from "./LLMProviderCard";

// ─── Types & Constants (unchanged) ───────────────────────────────────

interface Props {
  votes?: LLMConsensusResult | null;
  modelStatus?: LlmModelNode[];
  threshold?: number;
}

function getVoteForModel(votes: LLMConsensusVote[], name: string): LLMConsensusVote | undefined {
  return votes.find((v) => v.provider === name);
}

// ─── Component Rewrite ───────────────────────────────────────────────

export function LLMConsensusViz({ votes, modelStatus, threshold = 0.5 }: Props) {
  if (!votes && !modelStatus) {
    return <SkeletonLoader type="card" />;
  }

  if (!votes) {
    return (
      <EmptyState
        type="llm"
        title="No LLM Votes"
        description="No LLM consensus data available yet."
      />
    );
  }

  const goodVotes = votes?.goodVotes ?? 0;
  const badVotes = votes?.badVotes ?? 0;
  const skipVotes = votes?.skipVotes ?? 0;
  const totalVotes = goodVotes + badVotes + skipVotes;
  const totalEffectiveVotes = goodVotes + badVotes; // Only count good/bad for ratio

  const goodRatio = totalEffectiveVotes > 0 ? goodVotes / totalEffectiveVotes : 0;
  const consensusReached = votes?.consensusReached ?? false;

  const verdictStyle = votes ? (
    votes.verdict === "GOOD" ? "bg-green-500/20 text-green-400 border-green-500/25"
    : votes.verdict === "BAD" ? "bg-red-500/20 text-red-400 border-red-500/25"
    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/25"
  ) : "bg-gray-700/20 text-gray-400 border-gray-700/25";

  // Use modelStatus to override default active status if provided
  const currentProviders = ALL_LLM_PROVIDERS.map(defaultProvider => {
    const statusFromProps = modelStatus?.find(m => m.name === defaultProvider.name);
    return { ...defaultProvider, status: statusFromProps?.status || defaultProvider.status };
  });

  const activeCount = currentProviders.filter((m) => m.status === "active").length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 font-sans">
      {/* Header section */}
      <div className="flex items-center justify-between">
        {/* Left: Title + Overall Verdict */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Consensus</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors duration-300 ${verdictStyle}`}>
            {votes?.verdict || "N/A"}
          </span>
        </div>
        {/* Right: Vote Counts + Active Status */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            <span className="text-green-400 font-medium">{goodVotes}G</span> /
            <span className="text-red-400 font-medium"> {badVotes}B</span> /
            <span className="text-yellow-400 font-medium"> {skipVotes}S</span>
          </span>
          <span className="text-gray-600">• {activeCount}/{ALL_LLM_PROVIDERS.length} active</span>
        </div>
      </div>

      {/* Consensus progress bar */}
      {totalEffectiveVotes > 0 && (
        <div className="space-y-1">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out motion-safe:animate-in fade-in"
              style={{
                width: `${goodRatio * 100}%`,
                backgroundColor: goodRatio >= threshold ? "#22C55E" : "#EAB308",
              }}
            />
          </div>
          <div className="text-[10px] text-gray-500 flex justify-between px-1">
            <span>{Math.round(goodRatio * 100)}% Favorable</span>
            <span className={consensusReached ? "text-green-400" : "text-red-400"}>
              {consensusReached ? "Consensus Reached" : "No Consensus"}
            </span>
          </div>
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {currentProviders.map((provider) => {
          const vote = votes ? getVoteForModel(votes.votes, provider.name) : null;
          return (
            <LLMProviderCard
              key={provider.name}
              provider={provider}
              vote={vote}
              color={MODEL_COLORS[provider.name] || "#6B7280"}
            />
          );
        })}
      </div>
    </div>
  );
}

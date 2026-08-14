"use client";

import { useRef, useMemo, useState, useEffect, Suspense, lazy } from "react";
import { type LLMConsensusResult, type LLMConsensusVote, MODEL_COLORS, type LlmModelNode, ALL_LLM_PROVIDERS } from "../types";
import { SkeletonLoader } from "./SkeletonLoader";
import { ErrorBoundary } from "./ErrorBoundary";
import { LLMProviderCard } from "./LLMProviderCard";
import { Consensus2DFallback } from "./Consensus2DFallback";
import { BrainCircuit, Cpu, Sparkles, Zap, Box, Terminal, Brain, History, LayoutGrid, List, Globe } from "lucide-react";
import { useAiTrading } from "../context/AiTradingContext";
import { LLMConsensusHistory } from "./LLMConsensusHistory";

// ─── Types & Constants ───────────────────────────────────

interface Props {
  votes?: LLMConsensusResult | null;
  modelStatus?: LlmModelNode[];
  threshold?: number;
}

// ─── Main Export ─────────────────────────────────────────────

export function LLMConsensusViz({ votes, modelStatus, threshold = 0.5 }: Props) {
  const {
    showContributionIndicators,
    showConsensusPanelByDefault,
    visualizationStyle
  } = useAiTrading();

  const [mounted, setMounted] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"viz" | "history">("viz");
  const [isPanelOpen, setIsPanelOpen] = useState(showConsensusPanelByDefault);

  // Auto-open panel if set in config
  useEffect(() => {
    setIsPanelOpen(showConsensusPanelByDefault);
  }, [showConsensusPanelByDefault]);

  // Mock data for testing
  const mockVotes: LLMConsensusResult = {
    verdict: "GOOD",
    votes: [
      { provider: "gemini", modelLabel: "Gemini 2.5 Flash", verdict: "GOOD", reasoning: "SMC indicates strong bullish momentum.\nICT shows high institutional interest.\nMSNR suggests potential breakout.", latencyMs: 120, error: undefined },
      { provider: "mistral", modelLabel: "Mistral Large", verdict: "BAD", reasoning: "SMC shows weak price action.\nICT indicates low volume.\nMSNR suggests potential reversal.", latencyMs: 150, error: undefined },
      { provider: "gpt", modelLabel: "GPT OSS 120B", verdict: "GOOD", reasoning: "SMC shows strong trend continuation.\nICT indicates high liquidity.\nMSNR suggests potential continuation.", latencyMs: 180, error: undefined },
      { provider: "deepseek", modelLabel: "DeepSeek V4", verdict: "SKIP", reasoning: "Insufficient data points for reliable analysis.", latencyMs: 200, error: undefined },
      { provider: "nemotron", modelLabel: "Nemotron 3 Ultra", verdict: "GOOD", reasoning: "SMC shows strong trend continuation.\nICT indicates high liquidity.\nMSNR suggests potential continuation.", latencyMs: 220, error: undefined },
      { provider: "claude-opus", modelLabel: "Claude Opus 4.7", verdict: "GOOD", reasoning: "SMC shows strong trend continuation.\nICT indicates high liquidity.\nMSNR suggests potential continuation.", latencyMs: 250, error: undefined }
    ],
    totalVotes: 6,
    goodVotes: 4,
    badVotes: 1,
    skipVotes: 1,
    consensusReached: true,
    details: "Consensus reached with 4 GOOD votes out of 5 effective votes (70% threshold)"
  };

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <SkeletonLoader type="card" />;
  }

  // Use mock data for testing
  const useMockData = process.env.NODE_ENV === 'development' && false;
  const testVotes = useMockData ? mockVotes : votes;

  const goodVotes = testVotes?.goodVotes ?? 0;
  const badVotes = testVotes?.badVotes ?? 0;
  const skipVotes = testVotes?.skipVotes ?? 0;
  const totalEffectiveVotes = goodVotes + badVotes;
  const goodRatio = totalEffectiveVotes > 0 ? goodVotes / totalEffectiveVotes : 0;
  const consensusReached = testVotes?.consensusReached ?? false;

  const verdictStyle = testVotes ? (
    testVotes.verdict === "GOOD" ? "bg-neon-green/20 text-neon-green border-neon-green/40 shadow-[0_0_15px_rgba(57,255,136,0.3)]"
    : testVotes.verdict === "BAD" ? "bg-neon-red/20 text-neon-red border-neon-red/40 shadow-[0_0_15px_rgba(255,56,100,0.3)]"
    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.3)]"
  ) : "bg-black/60 text-text-muted border-accent-gold/20";

  const currentProviders = ALL_LLM_PROVIDERS.map(defaultProvider => {
    const statusFromProps = modelStatus?.find(m => m.name === defaultProvider.name);
    return { ...defaultProvider, status: statusFromProps?.status || defaultProvider.status };
  });

  const activeCount = currentProviders.filter((m) => m.status === "active").length;

  return (
    <div className="glass p-0 overflow-hidden relative flex flex-col h-[500px]">
      {/* Overlay UI */}
      <div className="absolute inset-x-0 top-0 p-4 z-10 flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-accent-gold uppercase tracking-widest drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
              Neural Consensus
            </span>
            <div className="flex items-center gap-1 pointer-events-auto">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border tracking-widest transition-all duration-300 font-mono ${verdictStyle}`}
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                    style={{ cursor: 'pointer' }}>
                {testVotes?.verdict || "AWAITING DATA"}
              </span>
              <div className="flex bg-black/60 rounded border border-accent-gold/20 p-0.5 ml-2">
                <button
                  onClick={() => setActiveSubTab("viz")}
                  className={`p-1 rounded transition ${activeSubTab === "viz" ? "bg-accent-gold/20 text-accent-gold" : "text-gray-500 hover:text-gray-300"}`}
                  title="Consensus Radar"
                >
                  <Globe className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setActiveSubTab("history")}
                  className={`p-1 rounded transition ${activeSubTab === "history" ? "bg-accent-gold/20 text-accent-gold" : "text-gray-500 hover:text-gray-300"}`}
                  title="Vote History"
                >
                  <History className="w-3 h-3" />
                </button>
              </div>
            </div>
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
            {testVotes && (
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

      {/* 2D Visualization OR History */}
      <div className="flex-1 w-full h-full bg-black relative overflow-hidden flex items-center justify-center">
        {activeSubTab === "viz" ? (
          visualizationStyle === "radar" ? (
            <Consensus2DFallback currentProviders={currentProviders} votes={testVotes} showIndicators={showContributionIndicators} />
          ) : visualizationStyle === "cards" ? (
            <div className="w-full h-full p-4 pt-28 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {currentProviders.map(provider => {
                  const vote = testVotes?.votes?.find(v => v.provider === provider.name);
                  if (!vote) return null;
                  return (
                    <LLMProviderCard
                      key={provider.name}
                      provider={provider}
                      vote={vote}
                      color={MODEL_COLORS[provider.name] || "#6B7280"}
                      votes={testVotes}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="w-full h-full p-4 pt-28 overflow-y-auto">
              <LLMConsensusHistory />
            </div>
          )
        ) : (
          <div className="w-full h-full p-4 pt-28 overflow-y-auto">
            <LLMConsensusHistory />
          </div>
        )}
      </div>

      {/* Consensus Breakdown Panel */}
      {isPanelOpen && testVotes && (
        <div className="absolute inset-x-0 bottom-0 bg-black/95 border-t border-accent-gold/20 p-4 max-h-[45%] overflow-y-auto z-50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-accent-gold">Consensus Breakdown</h3>
            <button
              onClick={() => setIsPanelOpen(false)}
              className="text-[10px] text-gray-500 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>

          {/* Consensus Math */}
          <div className="text-[9px] text-gray-400 mb-3 font-mono">
            <span className="text-accent-gold">{goodVotes}</span> Good / <span className="text-accent-gold">{badVotes}</span> Bad / <span className="text-accent-gold">{skipVotes}</span> Skip → <span className="text-accent-gold">{Math.round(goodRatio * 100)}%</span> ≥ <span className="text-accent-gold">{Math.round(threshold * 100)}%</span> = <span className={`font-bold ${testVotes.verdict === "GOOD" ? "text-neon-green" : testVotes.verdict === "BAD" ? "text-neon-red" : "text-yellow-400"}`}>{testVotes.verdict}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {currentProviders.map(provider => {
              const vote = testVotes?.votes?.find(v => v.provider === provider.name);
              if (!vote) return null;
              return (
                <LLMProviderCard
                  key={provider.name}
                  provider={provider}
                  vote={vote}
                  color={MODEL_COLORS[provider.name] || "#6B7280"}
                  votes={testVotes}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none terminal-scanline opacity-20 mix-blend-overlay"></div>
    </div>
  );
}

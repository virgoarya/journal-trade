"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Shield, TrendingUp, AlertTriangle } from "lucide-react";
import type { AgentConsensusResult, AgentVote } from "@/services/ai-trading.service";

// ─── Types & Constants ───────────────────────────────────

interface Props {
  agentConsensus?: AgentConsensusResult | null;
  threshold?: number;
}

interface PersonaConfig {
  id: string;
  label: string;
  emoji: string;
  description: string;
  icon: typeof Shield;
}

const PERSONAS: PersonaConfig[] = [
  {
    id: "hawk",
    label: "Hawk",
    emoji: "🦅",
    description: "Risk Agent — Capital Preservation",
    icon: Shield,
  },
  {
    id: "dove",
    label: "Dove",
    emoji: "🕊️",
    description: "Opportunity Agent — Momentum & Breakouts",
    icon: TrendingUp,
  },
  {
    id: "contrarian",
    label: "Contrarian",
    emoji: "🦇",
    description: "Skeptic Agent — Anomaly Detection",
    icon: AlertTriangle,
  },
];

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  GOOD: {
    bg: "bg-neon-green/20",
    text: "text-neon-green",
    border: "border-neon-green/40",
    glow: "shadow-[0_0_15px_rgba(57,255,136,0.3)]",
  },
  BAD: {
    bg: "bg-neon-red/20",
    text: "text-neon-red",
    border: "border-neon-red/40",
    glow: "shadow-[0_0_15px_rgba(255,56,100,0.3)]",
  },
  SKIP: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    border: "border-yellow-500/40",
    glow: "shadow-[0_0_15px_rgba(234,179,8,0.3)]",
  },
};

const BIAS_STYLES: Record<string, { text: string; bg: string }> = {
  BULLISH: { text: "text-neon-green", bg: "bg-neon-green/10" },
  BEARISH: { text: "text-neon-red", bg: "bg-neon-red/10" },
  NEUTRAL: { text: "text-yellow-400", bg: "bg-yellow-500/10" },
};

// ─── Helper Functions ─────────────────────────────────────

function getPersonaConfig(personaId: string): PersonaConfig {
  return PERSONAS.find((p) => p.id === personaId) || {
    id: personaId,
    label: personaId.charAt(0).toUpperCase() + personaId.slice(1),
    emoji: "🤖",
    description: "Agent",
    icon: Shield,
  };
}

function getBiasStyle(bias: string) {
  return BIAS_STYLES[bias] || { text: "text-text-muted", bg: "bg-white/5" };
}

function getVerdictStyle(verdict: string) {
  return VERDICT_STYLES[verdict] || VERDICT_STYLES.SKIP;
}

// ─── Sub-Components ──────────────────────────────────────

function ConsensusMeter({ score, threshold }: { score: number; threshold: number }) {
  const percentage = Math.round(score * 100);
  const thresholdPercent = Math.round(threshold * 100);
  const isGood = score >= threshold;

  return (
    <div className="space-y-2" role="meter" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Consensus score: ${percentage}%`}>
      <div className="flex justify-between text-xs">
        <span className="text-text-muted">Consensus Score</span>
        <span className={isGood ? "text-neon-green" : "text-neon-red"}>{percentage}%</span>
      </div>
      <div className="h-2 bg-black/60 rounded-full border border-accent-gold/20 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isGood ? "bg-neon-green" : "bg-neon-red"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>0%</span>
        <span className="text-accent-gold">Threshold: {thresholdPercent}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function AgentCard({ vote, defaultOpen = false }: { vote: AgentVote; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const persona = getPersonaConfig(vote.persona);
  const biasStyle = getBiasStyle(vote.bias);
  const Icon = persona.icon;

  return (
    <div className="glass rounded-lg overflow-hidden">
      <button
        className="w-full p-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`${persona.label} agent: ${vote.bias}`}
      >
        <span className="text-xl" aria-hidden="true">{persona.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white">{persona.label}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${biasStyle.bg} ${biasStyle.text}`}>
              {vote.bias}
            </span>
          </div>
          <p className="text-[10px] text-text-muted truncate">{persona.description}</p>
        </div>
        <Icon className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5">
          <p className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
            {vote.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────

export function AgentBreakdown({ agentConsensus, threshold = 0.6 }: Props) {
  if (!agentConsensus) {
    return (
      <div className="glass rounded-lg p-4 text-center">
        <p className="text-text-muted text-sm">No agent consensus data available</p>
        <p className="text-text-muted text-xs mt-1">Start the pipeline to see agent analysis</p>
      </div>
    );
  }

  const verdictStyle = getVerdictStyle(agentConsensus.verdict);
  const consensusScore = agentConsensus.totalVotes > 0
    ? agentConsensus.goodVotes / agentConsensus.totalVotes
    : 0;

  // Sort votes to match persona order (hawk, dove, contrarian)
  const sortedVotes = [...agentConsensus.votes].sort((a, b) => {
    const aIndex = PERSONAS.findIndex((p) => p.id === a.persona);
    const bIndex = PERSONAS.findIndex((p) => p.id === b.persona);
    return aIndex - bIndex;
  });

  return (
    <div className="glass rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-accent-gold uppercase tracking-widest">
            Agent Consensus
          </span>
        </div>
        <span
          className={`text-xs font-bold px-2 py-1 rounded border ${verdictStyle.bg} ${verdictStyle.text} ${verdictStyle.border} ${verdictStyle.glow}`}
          aria-label={`Verdict: ${agentConsensus.verdict}`}
        >
          {agentConsensus.verdict}
        </span>
      </div>

      {/* Consensus Meter */}
      <ConsensusMeter score={consensusScore} threshold={threshold} />

      {/* Agent Cards */}
      <div className="space-y-2" role="list" aria-label="Agent breakdown">
        {sortedVotes.map((vote, index) => (
          <AgentCard
            key={vote.persona}
            vote={vote}
            defaultOpen={index === 0}
          />
        ))}
      </div>

      {/* Consensus Text */}
      {agentConsensus.consensus && (
        <div className="border-t border-white/5 pt-3">
          <p className="text-[10px] font-bold text-accent-gold uppercase tracking-widest mb-1">
            Consensus
          </p>
          <p className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
            {agentConsensus.consensus}
          </p>
        </div>
      )}
    </div>
  );
}

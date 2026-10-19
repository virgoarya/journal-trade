"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Shield, TrendingUp, AlertTriangle } from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
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

function AgentRadarChart({ votes }: { votes: AgentVote[] }) {
  const data = votes.map((vote) => {
    const persona = getPersonaConfig(vote.persona);
    const biasValue = vote.bias === "BULLISH" ? 80 : vote.bias === "BEARISH" ? 20 : 50;
    return {
      agent: persona.label,
      bias: biasValue,
      fullMark: 100,
    };
  });

  return (
    <div className="h-48 w-full" role="img" aria-label="Agent bias radar chart">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#D4AF37" strokeOpacity={0.2} />
          <PolarAngleAxis dataKey="agent" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Agent Bias"
            dataKey="bias"
            stroke="#D4AF37"
            fill="#D4AF37"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConfidenceMeter({ vote }: { vote: AgentVote }) {
  const confidence = vote.bias === "BULLISH" ? 80 : vote.bias === "BEARISH" ? 20 : 50;
  const percentage = Math.round(confidence);
  const colorClass = vote.bias === "BULLISH" ? "bg-neon-green" : vote.bias === "BEARISH" ? "bg-neon-red" : "bg-yellow-500";

  return (
    <div className="space-y-1" role="meter" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${vote.persona} confidence: ${percentage}%`}>
      <div className="flex justify-between text-[10px]">
        <span className="text-text-muted">Confidence</span>
        <span className="text-text-muted">{percentage}%</span>
      </div>
      <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function VoteDistribution({ votes }: { votes: AgentVote[] }) {
  const weights: Record<string, number> = { hawk: 1.5, dove: 1.0, contrarian: 1.0 };
  const totalWeight = votes.reduce((sum, v) => sum + (weights[v.persona] || 1), 0);

  return (
    <div className="space-y-2" role="list" aria-label="Vote distribution by agent">
      <p className="text-[10px] font-bold text-accent-gold uppercase tracking-widest">Vote Distribution</p>
      {votes.map((vote) => {
        const weight = weights[vote.persona] || 1;
        const share = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
        const persona = getPersonaConfig(vote.persona);
        const biasStyle = getBiasStyle(vote.bias);

        return (
          <div key={vote.persona} className="flex items-center gap-2" role="listitem">
            <span className="text-sm w-6 text-center" aria-hidden="true">{persona.emoji}</span>
            <div className="flex-1">
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-text-muted">{persona.label} (×{weight})</span>
                <span className={biasStyle.text}>{Math.round(share)}%</span>
              </div>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${biasStyle.bg}`}
                  style={{ width: `${share}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
          <ConfidenceMeter vote={vote} />
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

      {/* Radar Chart — Agent Bias Visualization */}
      <div className="border-t border-white/5 pt-3">
        <p className="text-[10px] font-bold text-accent-gold uppercase tracking-widest mb-2">
          Agent Bias Radar
        </p>
        <AgentRadarChart votes={sortedVotes} />
      </div>

      {/* Vote Distribution — Weighted Voting Visualization */}
      <div className="border-t border-white/5 pt-3">
        <VoteDistribution votes={sortedVotes} />
      </div>

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

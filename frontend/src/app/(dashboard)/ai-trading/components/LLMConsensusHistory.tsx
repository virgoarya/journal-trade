"use client";

import { type LLMConsensusResult } from "../types";

interface LLMConsensusEntry {
  timestamp: string;
  symbol: string;
  verdict: "GOOD" | "BAD" | "SKIP";
  agreement: number;
  totalVotes: number;
  goodVotes: number;
  badVotes: number;
  skipVotes: number;
}

interface Props {
  history?: LLMConsensusEntry[];
  maxDisplay?: number;
}

// Mock history for demonstration
const MOCK_HISTORY: LLMConsensusEntry[] = [
  {
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    symbol: "XAUUSD",
    verdict: "GOOD",
    agreement: 80,
    totalVotes: 5,
    goodVotes: 4,
    badVotes: 1,
    skipVotes: 0,
  },
  {
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    symbol: "EURUSD",
    verdict: "BAD",
    agreement: 60,
    totalVotes: 5,
    goodVotes: 3,
    badVotes: 2,
    skipVotes: 0,
  },
  {
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    symbol: "GBPUSD",
    verdict: "GOOD",
    agreement: 100,
    totalVotes: 4,
    goodVotes: 4,
    badVotes: 0,
    skipVotes: 0,
  },
];

export function LLMConsensusHistory({ history, maxDisplay = 10 }: Props) {
  const entries = history && history.length > 0 ? history : MOCK_HISTORY;
  const displayEntries = entries.slice(0, maxDisplay);

  if (displayEntries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 font-mono text-xs">
        No consensus history yet
      </div>
    );
  }

  const getVerdictLabel = (verdict: "GOOD" | "BAD" | "SKIP") => {
    switch (verdict) {
      case "GOOD": return (
        <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-neon-green/20 text-neon-green border border-neon-green/40">
          ✓ GOOD
        </span>
      );
      case "BAD": return (
        <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-neon-red/20 text-neon-red border border-neon-red/40">
          ✗ BAD
        </span>
      );
      case "SKIP": return (
        <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
          ⊘ SKIP
        </span>
      );
    }
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-1">
      {/* Table Header */}
      <div className="grid grid-cols-5 gap-2 px-2 pb-1.5 text-[9px] text-gray-500 uppercase tracking-wider font-mono border-b border-gray-800/50">
        <div className="text-left">Time</div>
        <div className="text-left">Symbol</div>
        <div className="text-center">Verdict</div>
        <div className="text-right">Agreement</div>
        <div className="text-center">Votes</div>
      </div>

      {displayEntries.map((entry) => {
        const agreementColor = entry.agreement >= 70 ? "bg-neon-green" : entry.agreement >= 50 ? "bg-yellow-400" : "bg-neon-red";
        const agreementText = entry.agreement >= 70 ? "text-neon-green" : entry.agreement >= 50 ? "text-yellow-400" : "text-neon-red";

        return (
          <div
            key={entry.timestamp}
            className="grid grid-cols-5 gap-2 px-2 py-1.5 rounded-lg bg-gray-800/20 hover:bg-gray-700/30 transition-colors border border-gray-800/30"
          >
            {/* Time */}
            <div className="text-[8px] text-gray-400 font-mono">
              {formatTime(entry.timestamp)}
            </div>

            {/* Symbol */}
            <div className="font-mono text-xs text-accent-gold truncate">
              {entry.symbol}
            </div>

            {/* Verdict */}
            <div className="flex justify-center">
              {getVerdictLabel(entry.verdict)}
            </div>

            {/* Agreement */}
            <div className="flex items-center justify-end gap-1 text-right">
              <div className="w-16 h-1 rounded-full bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${entry.agreement}%`,
                    backgroundColor: entry.agreement >= 70 ? "#39FF88" : entry.agreement >= 50 ? "#EAB308" : "#FF3864",
                  }}
                />
              </div>
              <span className={`text-[8px] font-bold ${agreementText}`}>{entry.agreement}%</span>
            </div>

            {/* Votes */}
            <div className="flex justify-center gap-1 text-xs">
              <span className="text-neon-green font-mono">G{entry.goodVotes}</span>
              <span className="text-neon-red font-mono">B{entry.badVotes}</span>
              <span className="text-yellow-400 font-mono">S{entry.skipVotes}</span>
            </div>
          </div>
        );
      })}

      {entries.length > maxDisplay && (
        <div className="text-center text-gray-500 text-[9px] font-mono pt-2">
          +{entries.length - maxDisplay} more entries
        </div>
      )}
    </div>
  );
}
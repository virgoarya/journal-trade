"use client";

import { Brain, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import type {
  ConfluenceResult,
  MarketStructureSummary,
  MethodologyName,
} from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import { METHODOLOGY_LABELS, METHODOLOGY_COLORS } from "../types";

interface Props {
  confluence: ConfluenceResult;
  marketStructure?: MarketStructureSummary;
  symbol?: string;
}

/**
 * Display panel for methodology confluence breakdown.
 * Shows which methodologies are agreeing, their confidence scores,
 * the primary methodology, and market structure context.
 */
export function MethodologyConfluence({ confluence, marketStructure, symbol }: Props) {
  if (!confluence) {
    return <SkeletonLoader type="card" />;
  }

  if (!confluence.finalSignal) {
    return (
      <EmptyState
        type="data"
        title="No Methodology Data"
        description="No methodology confluence data available yet."
      />
    );
  }

  const finalSignal = confluence.finalSignal;

  // ── Market Structure Badges ────────────────────────────────────────

  const trendColor = (dir: string) => {
    switch (dir) {
      case "BULL": return "text-green-400 border-green-500/30 bg-green-500/10";
      case "BEAR": return "text-red-400 border-red-500/30 bg-red-500/10";
      default: return "text-gray-400 border-gray-500/30 bg-gray-500/10";
    }
  };

  const priceActionLabel = (pa: string) => {
    switch (pa) {
      case "EXPANSION_BULL": return "Bullish Expansion";
      case "EXPANSION_BEAR": return "Bearish Expansion";
      case "CONTRACTION": return "Contraction";
      default: return "Ranging";
    }
  };

  return (
    <div className="hud-panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold text-accent-gold flex items-center gap-2 uppercase tracking-widest drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
            <Brain className="w-4 h-4" />
            Methodology Confluence {symbol ? <span className="text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/30">{symbol}</span> : ""}
          </h3>
        {confluence.conflictDetected && (
          <span className="text-[10px] text-yellow-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Conflict
          </span>
        )}
      </div>

      {/* Market Structure Summary */}
      {marketStructure && (
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${trendColor(marketStructure.trend.direction)}`}>
            {marketStructure.trend.direction === "BULL" ? "Bull" : marketStructure.trend.direction === "BEAR" ? "Bear" : "Sideways"} ({marketStructure.trend.strength}%)
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent-gold/20 bg-black/30 text-text-muted font-mono">
            {priceActionLabel(marketStructure.recentPriceAction)}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent-gold/20 bg-black/30 text-text-muted font-mono">
            {marketStructure.orderBlocksCount} OB
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent-gold/20 bg-black/30 text-text-muted font-mono">
            {marketStructure.fvgCount} FVG
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent-gold/20 bg-black/30 text-text-muted font-mono">
            {marketStructure.liquidityZonesCount} Liq
          </span>
        </div>
      )}

      {/* Final Signal */}
      {finalSignal ? (
        <div className="bg-black/40 border border-accent-gold/10 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {finalSignal.direction === "BUY" ? (
                <TrendingUp className="w-4 h-4 text-neon-green" />
              ) : (
                <TrendingDown className="w-4 h-4 text-neon-red" />
              )}
              <span className={`text-sm font-bold font-mono ${
                finalSignal.direction === "BUY" ? "text-neon-green" : "text-neon-red"
              }`}>
                {finalSignal.direction}
              </span>
              <span className="text-lg font-bold text-white">
                {finalSignal.confidence}%
              </span>
            </div>
            <span className="text-[10px] text-text-muted font-mono">
              Score: {finalSignal.confluenceScore}%
            </span>
          </div>

          {/* Agree count */}
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1">
              {finalSignal.agreeingSignals.slice(0, 5).map((sig, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full border border-gray-900"
                  style={{
                    backgroundColor: METHODOLOGY_COLORS[sig.methodology as MethodologyName] || "#6B7280",
                  }}
                  title={`${METHODOLOGY_LABELS[sig.methodology as MethodologyName] || sig.methodology}: ${sig.confidence}%`}
                />
              ))}
            </div>
            <span className="text-[10px] text-text-muted font-mono">
              {finalSignal.totalAgreeing}/{Object.keys(confluence.methodologyBreakdown).length} methodologies agreeing
            </span>
          </div>

          {/* Primary methodology */}
          <div className="text-[10px] text-text-muted">
            Primary:{" "}
            <span
              className="font-medium font-mono"
              style={{ color: METHODOLOGY_COLORS[finalSignal.primaryMethodology] || "#6B7280" }}
            >
              {METHODOLOGY_LABELS[finalSignal.primaryMethodology] || finalSignal.primaryMethodology}
            </span>
          </div>

          {/* Entry/SL/TP */}
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <div>
              <span className="text-accent-gold-dim">Entry</span>
              <p className="text-text-primary font-mono">{finalSignal.entry.toFixed(5)}</p>
            </div>
            <div>
              <span className="text-accent-gold-dim">SL</span>
              <p className="text-neon-red font-mono">{finalSignal.sl.toFixed(5)}</p>
            </div>
            <div>
              <span className="text-accent-gold-dim">TP</span>
              <p className="text-neon-green font-mono">{finalSignal.tp.toFixed(5)}</p>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 leading-tight">
            {confluence.reason}
          </p>
        </div>
      ) : (
        <div className="bg-black/40 border border-accent-gold/10 rounded-lg p-3">
          <div className="flex items-center gap-2 text-text-muted">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-mono">{confluence.reason}</span>
          </div>
        </div>
      )}

      {/* Individual Methodology Breakdown */}
      {Object.keys(confluence.methodologyBreakdown).length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] text-accent-gold-dim uppercase tracking-widest font-mono">Individual Signals</span>
          {Object.entries(confluence.methodologyBreakdown).map(([key, data]) => {
            const method = key as MethodologyName;
            const color = METHODOLOGY_COLORS[method] || "#6B7280";
            return (
              <div key={key} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="flex-1 text-[10px] text-text-muted truncate flex items-center gap-1 font-mono">
                  {METHODOLOGY_LABELS[method] || method}
                  {data.direction === "BUY" && <span title="Sinyal BUY"><TrendingUp className="w-3 h-3 text-neon-green" /></span>}
                  {data.direction === "SELL" && <span title="Sinyal SELL"><TrendingDown className="w-3 h-3 text-neon-red" /></span>}
                </span>
                {/* Confidence bar */}
                <div className="w-16 h-1.5 bg-black rounded-full overflow-hidden flex-shrink-0 border border-accent-gold/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${data.confidence}%`,
                      backgroundColor: color,
                      opacity: data.confidence > 0 ? 1 : 0.2,
                    }}
                  />
                </div>
                <span className="w-6 text-right text-[10px] font-mono" style={{ color }}>
                  {data.confidence > 0 ? `${data.confidence}%` : "—"}
                </span>
                <span className="text-[9px] text-text-muted w-10 text-right font-mono">
                  ×{data.weight.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

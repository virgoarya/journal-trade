"use client";

import React, { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Shield, TrendingUp } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

interface RiskMetric {
  subject: string;
  score: number;
  fullMark: 100;
}

const RISK_LABELS: Record<string, string> = {
  inflation: "Inflation Risk",
  rateHike: "Rate Hike",
  geopolitics: "Geopolitics",
  supplyChain: "Supply Chain",
  liquidityDrain: "Liquidity Drain",
};

// Custom tooltip for Recharts radar
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { subject, score } = payload[0]?.payload ?? {};
  const color =
    score >= 70 ? "#ef4444" : score >= 45 ? "#f59e0b" : "#22c55e";
  return (
    <div className="glass border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono shadow-lg">
      <p className="text-text-muted">{subject}</p>
      <p style={{ color }} className="font-bold text-sm">
        {score}/100
      </p>
    </div>
  );
}

function riskColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 45) return "#f59e0b";
  return "#22c55e";
}

function riskLabel(score: number): string {
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MODERATE";
  return "LOW";
}

export function GeoRiskRadarPanel() {
  const { liquidity, currentRegime } = useMacroTerminal();

  // Derive dynamic scores from context data
  const metrics = useMemo<RiskMetric[]>(() => {
    const isDraining = liquidity?.status === "DRAINING";
    const regimeLower = (currentRegime ?? "").toLowerCase();

    const liquidityDrain = isDraining
      ? Math.min(100, 50 + Math.abs(liquidity?.change ?? 0) * 5)
      : Math.max(10, 30 - Math.abs(liquidity?.change ?? 0) * 3);

    const inflation =
      regimeLower.includes("stagflation") || regimeLower.includes("reflation")
        ? 78
        : regimeLower.includes("deflation")
        ? 22
        : 52;

    const rateHike =
      regimeLower.includes("stagflation")
        ? 82
        : regimeLower.includes("goldilocks")
        ? 18
        : 55;

    return [
      { subject: RISK_LABELS.inflation, score: Math.round(inflation), fullMark: 100 },
      { subject: RISK_LABELS.rateHike, score: Math.round(rateHike), fullMark: 100 },
      { subject: RISK_LABELS.geopolitics, score: 62, fullMark: 100 }, // Static until news pipeline
      { subject: RISK_LABELS.supplyChain, score: 38, fullMark: 100 },
      { subject: RISK_LABELS.liquidityDrain, score: Math.round(liquidityDrain), fullMark: 100 },
    ];
  }, [liquidity, currentRegime]);

  const overallScore = Math.round(
    metrics.reduce((acc, m) => acc + m.score, 0) / metrics.length
  );

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-bg-void p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent-gold" />
          <span className="text-xs font-mono font-bold text-text-primary tracking-widest uppercase">
            Geo-Risk Radar
          </span>
        </div>
        {/* Overall risk badge */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono font-bold"
          style={{
            borderColor: riskColor(overallScore) + "50",
            color: riskColor(overallScore),
            backgroundColor: riskColor(overallScore) + "15",
          }}
        >
          <TrendingUp className="w-3 h-3" />
          {riskLabel(overallScore)} · {overallScore}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={metrics} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
            <PolarGrid stroke="#2a2a3a" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "#888899", fontSize: 10, fontFamily: "monospace" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Risk Score"
              dataKey="score"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.18}
              strokeWidth={2}
              dot={{ fill: "#f59e0b", r: 3 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk breakdown list */}
      <div className="grid grid-cols-1 gap-1 mt-2 shrink-0">
        {metrics.map((m) => (
          <div key={m.subject} className="flex items-center justify-between text-xs font-mono">
            <span className="text-text-muted truncate">{m.subject}</span>
            <div className="flex items-center gap-2">
              {/* Mini bar */}
              <div className="w-16 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${m.score}%`,
                    backgroundColor: riskColor(m.score),
                  }}
                />
              </div>
              <span style={{ color: riskColor(m.score) }} className="w-6 text-right font-bold">
                {m.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

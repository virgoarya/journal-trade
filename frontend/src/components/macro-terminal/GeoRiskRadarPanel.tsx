"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  Activity,
  Zap,
  TrendingDown,
  Gauge,
  Droplets,
} from "lucide-react";

// ── Interfaces ──────────────────────────────────────────────────────────────

interface GeoRiskScores {
  inflation: number;
  rateHike: number;
  geopolitics: number;
  supplyChain: number;
  liquidityDrain: number;
}

interface GeoRiskData {
  scores: GeoRiskScores;
  raw: {
    cpi_yoy: number | null;
    fedfunds_rate: number | null;
    vix: number | null;
    vixSource?: "yahoo" | "fred" | null;
    globalPmi: number | null;
    pmiSource?: "calendar_db" | "dbnomics" | "trading_economics" | "ipman_synthetic" | null;
    onRrpBalance: number | null;
  };
  fetchedAt: string;
  fromCache: boolean;
}

// ── Metric Configuration ────────────────────────────────────────────────────

const METRIC_CONFIG = [
  {
    key: "inflation" as const,
    label: "Inflation",
    icon: TrendingDown,
    rawKey: "cpi_yoy",
    rawFormat: (v: number) => `${v.toFixed(1)}%`,
    rawLabel: "CPI YoY",
    context: (v: number | null) => {
      if (v === null) return "N/A";
      if (v > 5) return "Hot — well above 2% target";
      if (v > 3) return "Elevated — above Fed target";
      if (v > 2) return "Near target";
      return "Below target — disinflation";
    },
  },
  {
    key: "rateHike" as const,
    label: "Rate Hike",
    icon: Gauge,
    rawKey: "fedfunds_rate",
    rawFormat: (v: number) => `${v.toFixed(2)}%`,
    rawLabel: "Fed Funds",
    context: (v: number | null) => {
      if (v === null) return "N/A";
      if (v >= 5) return "Restrictive territory";
      if (v >= 4) return "Moderately tight";
      if (v >= 2.5) return "Neutral zone";
      return "Accommodative";
    },
  },
  {
    key: "geopolitics" as const,
    label: "Geopolitical/Vol",
    icon: Activity,
    rawKey: "vix",
    rawFormat: (v: number) => v.toFixed(1),
    rawLabel: "VIX",
    context: (v: number | null) => {
      if (v === null) return "N/A";
      if (v >= 30) return "Fear — extreme vol regime";
      if (v >= 20) return "Elevated — risk caution";
      if (v >= 15) return "Normal — slight caution";
      return "Calm — low vol regime";
    },
  },
  {
    key: "supplyChain" as const,
    label: "Supply Chain",
    icon: Zap,
    rawKey: "globalPmi",
    rawFormat: (v: number) => v.toFixed(1),
    rawLabel: "ISM PMI",
    context: (v: number | null) => {
      if (v === null) return "N/A";
      if (v >= 55) return "Strong expansion";
      if (v >= 50) return "Expansion — healthy";
      if (v >= 45) return "Contraction — stress";
      return "Deep contraction — risk";
    },
  },
  {
    key: "liquidityDrain" as const,
    label: "Liquidity Drain",
    icon: Droplets,
    rawKey: "onRrpBalance",
    rawFormat: (v: number) => `$${v.toFixed(1)}B`,
    rawLabel: "ON RRP",
    context: (v: number | null) => {
      if (v === null) return "N/A";
      if (v < 10) return "Depleted — no buffer left";
      if (v < 100) return "Near depletion";
      if (v < 500) return "Draining — watch reserves";
      return "Ample — liquidity buffer intact";
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function riskColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 45) return "#f59e0b";
  return "#22c55e";
}

function riskBg(score: number): string {
  if (score >= 70) return "rgba(239,68,68,0.08)";
  if (score >= 45) return "rgba(245,158,11,0.06)";
  return "rgba(34,197,94,0.06)";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function riskLabel(score: number): string {
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MODERATE";
  return "LOW";
}

function riskPosture(
  score: number,
  topDriver: string,
): "DEFENSIVE" | "NEUTRAL" | "RISK-ON" | "HEDGE-ONLY" {
  if (score >= 70) return "DEFENSIVE";
  if (score >= 55)
    return topDriver === "liquidityDrain" || topDriver === "rateHike"
      ? "HEDGE-ONLY"
      : "NEUTRAL";
  if (score < 35) return "RISK-ON";
  return "NEUTRAL";
}

const POSTURE_META: Record<
  string,
  { desc: string; action: string; color: string }
> = {
  DEFENSIVE: {
    desc: "Multiple risk vectors elevated. Reduce exposure, prioritize capital preservation.",
    action: "DE-RISK POSITIONS",
    color: "#ef4444",
  },
  "HEDGE-ONLY": {
    desc: "Structural headwind from rates or liquidity. Only enter with hedged structures.",
    action: "HEDGED ENTRIES ONLY",
    color: "#f59e0b",
  },
  NEUTRAL: {
    desc: "Mixed signals across macro landscape. Be selective, favor quality setups.",
    action: "SELECTIVE EXPOSURE",
    color: "#64748b",
  },
  "RISK-ON": {
    desc: "Macro conditions favorable. Green light for directional risk and momentum plays.",
    action: "ADD RISK EXPOSURE",
    color: "#22c55e",
  },
};

function keyToLabel(key: string): string {
  const map: Record<string, string> = {
    inflation: "Inflation",
    rateHike: "Rate Hike",
    geopolitics: "Geopolitical/Vol",
    supplyChain: "Supply Chain",
    liquidityDrain: "Liquidity Drain",
  };
  return map[key] ?? key;
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { subject?: string; score?: number; context?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const { subject, score, context } = payload[0]?.payload ?? {};
  const normalizedScore = Number(score ?? 0);
  return (
    <div
      className="border rounded-lg px-3 py-2 text-xs font-mono shadow-xl backdrop-blur-md"
      style={{
        backgroundColor: "rgba(15,15,25,0.92)",
        borderColor: riskColor(normalizedScore) + "40",
      }}
    >
      <p className="text-text-muted text-[10px]">{subject}</p>
      <p
        style={{ color: riskColor(normalizedScore) }}
        className="font-bold text-sm"
      >
        {normalizedScore} / 100
        <span className="ml-1.5 text-[9px] font-normal opacity-70">
          {riskLabel(normalizedScore)}
        </span>
      </p>
      {context && (
        <p className="text-[9px] text-text-muted mt-0.5 max-w-[160px]">{context}</p>
      )}
    </div>
  );
}

function RingGauge({ score, size = 56 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = riskColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e1e2e"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-black text-xl leading-none"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-[8px] font-mono text-text-muted uppercase tracking-wider">
          / 100
        </span>
      </div>
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="flex flex-col h-full w-full glass-panel overflow-hidden relative p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3.5 h-3.5 bg-surface-elevated rounded" />
        <div className="w-28 h-3 bg-surface-elevated rounded" />
      </div>
      <div className="flex gap-3 mb-3">
        <div className="w-[72px] h-[72px] bg-surface-elevated rounded-full" />
        <div className="flex-1 space-y-2 py-2">
          <div className="w-full h-2 bg-surface-elevated rounded" />
          <div className="w-3/4 h-2 bg-surface-elevated rounded" />
          <div className="w-1/2 h-2 bg-surface-elevated rounded" />
        </div>
      </div>
      <div className="flex-1 bg-surface-elevated/30 rounded-lg" />
      <div className="space-y-2 mt-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-surface-elevated/40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function GeoRiskRadarPanel() {
  const [data, setData] = useState<GeoRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/v1/geo-risk");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!json.success) throw new Error(json.error ?? "Unknown error");
      setData(json.data);
      setLastUpdated(
        new Date(json.data.fetchedAt).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const forceRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setError(null);
    try {
      const resp = await fetch("/api/v1/geo-risk/refresh", { method: "POST" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!json.success) throw new Error(json.error ?? "Force refresh gagal");
      setData(json.data);
      setLastUpdated(
        new Date(json.data.fetchedAt).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const { radarData, overallScore, dominantRisk, posture, sortedMetrics } =
    useMemo(() => {
      if (!data) {
        return {
          radarData: [],
          overallScore: 0,
          dominantRisk: null as [string, number] | null,
          posture: "NEUTRAL" as const,
          sortedMetrics: [] as Array<{
            key: string;
            score: number;
            config: (typeof METRIC_CONFIG)[number];
          }>,
        };
      }

      const rd = METRIC_CONFIG.map((m) => ({
        subject: m.label,
        score: data.scores[m.key],
        fullMark: 100,
        context: m.context(
          data.raw[m.rawKey as keyof typeof data.raw] as number | null,
        ),
      }));

      const overall = Math.round(
        Object.values(data.scores).reduce((acc, v) => acc + v, 0) /
          Object.values(data.scores).length,
      );

      const dominant = Object.entries(data.scores).sort(
        (a, b) => b[1] - a[1],
      )[0] as [string, number];

      const post = riskPosture(overall, dominant[0]);

      const sorted = Object.entries(data.scores)
        .sort((a, b) => b[1] - a[1])
        .map(([key, score]) => ({
          key,
          score,
          config: METRIC_CONFIG.find((m) => m.key === key)!,
        }));

      return {
        radarData: rd,
        overallScore: overall,
        dominantRisk: dominant,
        posture: post,
        sortedMetrics: sorted,
      };
    }, [data]);

  if (loading && !data) return <SkeletonPanel />;

  const postureMeta = POSTURE_META[posture];

  return (
    <div className="flex flex-col h-full w-full glass-panel overflow-hidden relative">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-1.5 pb-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Shield size={14} className="text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[13px] whitespace-nowrap">
            Geo-Risk Radar
          </h2>
          {/* Source badges */}
          <div className="flex items-center gap-1">
            {data && (
              <span
                className="text-[9px] font-mono px-1 py-px rounded"
                style={{
                  backgroundColor: data.fromCache ? "#1e293b" : "#14532d30",
                  color: data.fromCache ? "#64748b" : "#22c55e",
                }}
              >
                {data.fromCache ? "CACHE" : "LIVE"}
              </span>
            )}
            {data?.raw?.vixSource && (
              <span
                className="text-[9px] font-mono px-1 py-px rounded border border-border-subtle/50"
                style={{
                  color:
                    data.raw.vixSource === "yahoo" ? "#22c55e" : "#f59e0b",
                }}
              >
                VIX:{data.raw.vixSource.toUpperCase()}
              </span>
            )}
            {data?.raw?.pmiSource && (
              <span
                className="text-[9px] font-mono px-1 py-px rounded border border-border-subtle/50"
                style={{
                  color:
                    data.raw.pmiSource === "calendar_db"
                      ? "#ec4899" // Pink color for Calendar
                      : data.raw.pmiSource === "dbnomics"
                        ? "#22c55e"
                        : data.raw.pmiSource === "trading_economics"
                          ? "#3b82f6"
                          : "#f59e0b",
                }}
              >
                PMI:
                {data.raw.pmiSource === "calendar_db"
                  ? "CALENDAR"
                  : data.raw.pmiSource === "dbnomics"
                    ? "ISM"
                    : data.raw.pmiSource === "trading_economics"
                      ? "TE"
                      : "SYNTH"}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={forceRefresh}
          disabled={loading || refreshing}
          className="p-1 rounded text-text-muted hover:text-accent-gold transition-colors disabled:opacity-40"
          title="Force refresh (bypass cache)"
        >
          <RefreshCw
            className={`w-3 h-3 ${loading || refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="flex items-center gap-2 text-xs font-mono text-data-loss bg-data-loss/10 border-y border-data-loss/20 px-4 py-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* ── Scrollable Content (aiming for no scroll) ─────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-1.5">
        {data && dominantRisk && (
          <>
            {/* ── Score + Posture Hero ──────────────────────────────── */}
            <div className="flex items-center gap-3 mt-0 mb-1.5">
              {/* Ring Gauge */}
              <RingGauge score={overallScore} />

              {/* Posture info */}
              <div className="flex-1 min-w-0 py-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[13px] font-mono font-black uppercase tracking-wider"
                    style={{ color: postureMeta.color }}
                  >
                    {posture}
                  </span>
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm font-bold"
                    style={{
                      backgroundColor: postureMeta.color + "18",
                      color: postureMeta.color,
                      border: `1px solid ${postureMeta.color}30`,
                    }}
                  >
                    {postureMeta.action}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-text-muted leading-tight mt-0.5">
                  {postureMeta.desc}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-mono text-text-muted uppercase">
                    Top Driver:
                  </span>
                  <span
                    className="text-[11px] font-mono font-bold"
                    style={{ color: riskColor(dominantRisk[1]) }}
                  >
                    {keyToLabel(dominantRisk[0])} ({dominantRisk[1]})
                  </span>
                </div>
              </div>
            </div>

            {/* ── Radar Chart ──────────────────────────────────────── */}
            <div className="h-[315px] min-w-0 mb-1 relative flex-1">
              {/* Risk zone legend */}
              <div className="absolute top-1 right-1 flex items-center gap-2 z-10">
                <span className="flex items-center gap-1 text-[9px] font-mono text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block" />{" "}
                  &lt;45
                </span>
                <span className="flex items-center gap-1 text-[9px] font-mono text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" />{" "}
                  45-69
                </span>
                <span className="flex items-center gap-1 text-[9px] font-mono text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" />{" "}
                  ≥70
                </span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={radarData}
                  cx="50%"
                  cy="55%"
                  outerRadius="105%"
                  margin={{ top: 25, right: 12, bottom: 5, left: 12 }}
                >
                  <PolarGrid stroke="#2a2a3a" strokeDasharray="3 3" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={({ x, y, payload }: any) => {
                      const item = radarData.find(
                        (d) => d.subject === payload.value,
                      );
                      const score = item?.score ?? 0;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            textAnchor="middle"
                            fill={riskColor(score)}
                            fontSize={10}
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {payload.value}
                          </text>
                          <text
                            x={0}
                            y={12}
                            textAnchor="middle"
                            fill="#555566"
                            fontSize={9}
                            fontFamily="monospace"
                          >
                            {score}/100
                          </text>
                        </g>
                      );
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Radar
                    name="Risk Score"
                    dataKey="score"
                    stroke={riskColor(overallScore)}
                    fill={riskColor(overallScore)}
                    fillOpacity={0.12}
                    strokeWidth={2}
                    dot={{
                      fill: riskColor(overallScore),
                      r: 3,
                      strokeWidth: 1,
                      stroke: "#0d0d14",
                    }}
                    animationDuration={800}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Metric Detail Cards ──────────────────────────────── */}
            <div className="space-y-0.5 shrink-0 mt-5">
              {sortedMetrics.map(({ key, score, config }) => {
                const rawVal = data.raw[
                  config.rawKey as keyof typeof data.raw
                ] as number | null;
                const Icon = config.icon;
                const contextText = config.context(rawVal);

                return (
                  <div
                    key={key}
                    className="rounded-lg border p-1.5 transition-all duration-300"
                    style={{
                      borderColor: riskColor(score) + "25",
                      backgroundColor: riskBg(score),
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Icon
                          size={13}
                          style={{ color: riskColor(score) }}
                          className="flex-shrink-0"
                        />
                        <span className="text-[13px] font-mono font-bold text-text-primary">
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {rawVal !== null && (
                          <span className="text-[10px] font-mono text-text-muted">
                            {config.rawLabel}:{" "}
                            <span className="text-[11px] font-bold text-text-primary">
                              {config.rawFormat(rawVal)}
                            </span>
                          </span>
                        )}
                        <span
                          className="text-xs font-mono font-black min-w-[24px] text-right"
                          style={{ color: riskColor(score) }}
                        >
                          {score}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1 bg-surface-elevated/60 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${score}%`,
                          backgroundColor: riskColor(score),
                          boxShadow: `0 0 6px ${riskColor(score)}50`,
                        }}
                      />
                    </div>
                    {/* Context line */}
                    <p className="text-[10px] font-mono text-text-muted leading-snug mt-1">
                      {contextText}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!data && !loading && (
          <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">
            No data available
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {lastUpdated && (
        <div className="px-4 pt-1 pb-1 border-t border-border-subtle/40 shrink-0">
          <p className="text-[9px] font-mono text-text-muted text-right">
            Updated {lastUpdated} · 1h cache · FRED + Yahoo + DBnomics
          </p>
        </div>
      )}
    </div>
  );
}

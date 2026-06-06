"use client";

import React, { useState, useEffect } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Shield, TrendingUp, RefreshCw, AlertTriangle } from "lucide-react";

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
    globalPmi: number | null;
    onRrpBalance: number | null;
  };
  fetchedAt: string;
  fromCache: boolean;
}

const METRIC_CONFIG = [
  { key: "inflation" as const, label: "Inflation Risk", rawKey: "cpi_yoy", rawSuffix: "% YoY" },
  { key: "rateHike" as const, label: "Rate Hike", rawKey: "fedfunds_rate", rawSuffix: "%" },
  { key: "geopolitics" as const, label: "Geopolitics", rawKey: "vix", rawSuffix: " VIX" },
  { key: "supplyChain" as const, label: "Supply Chain", rawKey: "globalPmi", rawSuffix: " PMI" },
  { key: "liquidityDrain" as const, label: "Liquidity Drain", rawKey: "onRrpBalance", rawSuffix: "B ON RRP" },
];

function riskColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 45) return "#f59e0b";
  return "#22c55e";
}

function riskLabel(score: number): string {
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MOD";
  return "LOW";
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { subject, score } = payload[0]?.payload ?? {};
  return (
    <div className="glass border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono shadow-lg">
      <p className="text-text-muted">{subject}</p>
      <p style={{ color: riskColor(score) }} className="font-bold text-sm">
        {score} / 100
      </p>
    </div>
  );
}

function SkeletonBar() {
  return (
    <div className="flex items-center justify-between text-xs font-mono">
      <div className="w-24 h-2 bg-surface-elevated rounded animate-pulse" />
      <div className="w-16 h-1.5 bg-surface-elevated rounded-full animate-pulse ml-auto mr-2" />
      <div className="w-5 h-2 bg-surface-elevated rounded animate-pulse" />
    </div>
  );
}

export function GeoRiskRadarPanel() {
  const [data, setData] = useState<GeoRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/v1/geo-risk");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!json.success) throw new Error(json.error ?? "Unknown error");
      setData(json.data);
      setLastUpdated(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      setError(err.message ?? "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 minutes to pick up new DB cache
    const interval = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const radarData = data
    ? METRIC_CONFIG.map((m) => ({
        subject: m.label,
        score: data.scores[m.key],
        fullMark: 100,
      }))
    : [];

  const overallScore = data
    ? Math.round(
        Object.values(data.scores).reduce((acc, v) => acc + v, 0) /
          Object.values(data.scores).length
      )
    : 0;

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-bg-void p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent-gold" />
          <span className="text-xs font-mono font-bold text-text-primary tracking-widest uppercase">
            Geo-Risk Radar
          </span>
          {data && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: data.fromCache ? "#1e293b" : "#14532d30",
                color: data.fromCache ? "#64748b" : "#22c55e",
              }}
            >
              {data.fromCache ? "CACHED" : "LIVE"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {data && !loading && (
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
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 rounded text-text-muted hover:text-accent-gold transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 text-xs font-mono text-data-loss bg-data-loss/10 border border-data-loss/20 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      )}

      {/* Radar Chart */}
      <div className="flex-1 min-h-0">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono animate-pulse">
            Fetching FRED API data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 4, right: 24, bottom: 4, left: 24 }}>
              <PolarGrid stroke="#2a2a3a" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#888899", fontSize: 9, fontFamily: "monospace" }}
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
                animationDuration={800}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown list */}
      <div className="grid grid-cols-1 gap-1.5 mt-2 shrink-0">
        {loading && !data
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonBar key={i} />)
          : METRIC_CONFIG.map((m) => {
              const score = data?.scores[m.key] ?? 0;
              const rawVal = data?.raw[m.rawKey as keyof typeof data.raw];
              return (
                <div key={m.key} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-text-muted truncate mr-2">{m.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {rawVal !== null && rawVal !== undefined && (
                      <span className="text-[9px] text-text-muted hidden xl:inline">
                        {rawVal.toFixed(2)}{m.rawSuffix}
                      </span>
                    )}
                    <div className="w-14 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${score}%`, backgroundColor: riskColor(score) }}
                      />
                    </div>
                    <span style={{ color: riskColor(score) }} className="w-5 text-right font-bold">
                      {score}
                    </span>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Footer: last updated */}
      {lastUpdated && (
        <p className="text-[9px] font-mono text-text-muted mt-2 text-right shrink-0">
          Updated {lastUpdated} · 12h cache · FRED API
        </p>
      )}
    </div>
  );
}

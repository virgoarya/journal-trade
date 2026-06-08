"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Activity, RefreshCw, AlertTriangle, Info } from "lucide-react";

interface QuantData {
  y3m: number | null;
  y2y: number | null;
  y5: number | null;
  y10: number | null;
  y30: number | null;
  spread10y3m: number | null;
  spread10y2y: number | null;
  spread30y5y: number | null;
  prevSpread10y3m: number | null;
  prevSpread10y2y: number | null;
  prevSpread30y5y: number | null;
  inverted: boolean;
  vix: number | null;
  regime: string;
}

interface QuantResponse {
  data: QuantData;
  fetchedAt: string;
  fromCache: boolean;
}

function SkeletonPulse() {
  return <div className="w-full h-full bg-surface-elevated animate-pulse rounded-md" />;
}

function classifyRegime(data: QuantData | null | undefined): string {
  if (!data || data.spread30y5y == null || data.prevSpread30y5y == null) return "Baseline";

  const delta30y5y = data.spread30y5y - data.prevSpread30y5y;

  if (delta30y5y > 0.5) return "Bull Steepener";
  if (delta30y5y < -0.5) return "Bull Flattener";
  return "Baseline";
}

export function YieldCurvePanel() {
  const [resp, setResp] = useState<QuantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/quant/snapshot");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal fetch data");
      const d = json.data;
      const normalized: QuantData = {
        y3m: d?.y3m ?? null,
        y2y: d?.y2y ?? null,
        y5: d?.y5 ?? null,
        y10: d?.y10 ?? null,
        y30: d?.y30 ?? null,
        spread10y3m: d?.spread10y3m ?? null,
        spread10y2y: d?.spread10y2y ?? null,
        spread30y5y: d?.spread30y5y ?? null,
        prevSpread10y3m: d?.prevSpread10y3m ?? null,
        prevSpread10y2y: d?.prevSpread10y2y ?? null,
        prevSpread30y5y: d?.prevSpread30y5y ?? null,
        inverted: d?.inverted ?? false,
        vix: d?.vix ?? null,
        regime: d?.regime ?? "UNKNOWN",
      };
      setResp({ ...json, data: normalized });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const forceRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/quant/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal force refresh");
      const d = json.data;
      const normalized: QuantData = {
        y3m: d?.y3m ?? null,
        y2y: d?.y2y ?? null,
        y5: d?.y5 ?? null,
        y10: d?.y10 ?? null,
        y30: d?.y30 ?? null,
        spread10y3m: d?.spread10y3m ?? null,
        spread10y2y: d?.spread10y2y ?? null,
        spread30y5y: d?.spread30y5y ?? null,
        prevSpread10y3m: d?.prevSpread10y3m ?? null,
        prevSpread10y2y: d?.prevSpread10y2y ?? null,
        prevSpread30y5y: d?.prevSpread30y5y ?? null,
        inverted: d?.inverted ?? false,
        vix: d?.vix ?? null,
        regime: d?.regime ?? "UNKNOWN",
      };
      setResp({ ...json, data: normalized });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const data = resp?.data;
  const regime = data ? classifyRegime(data) : "Baseline";
  const regimeColor = {
    Baseline: "#94a3b8",
    "Bull Steepener": "#2ecc71",
    "Bull Flattener": "#f1c40f",
    "Bear Flattener": "#e74c3c",
    "Bear Steepener": "#8b0000",
  }[regime] || "#94a3b8";

  const spreadColor = data?.inverted ? "#ef4444" : "#22c55e";

  let recessionProb = 0;
  if (data?.spread10y2y != null && data?.vix != null) {
    const sp = data.spread10y2y / 100;
    recessionProb = Math.round((Math.exp(-0.5333 - 0.633 * sp) / (1 + Math.exp(-0.5333 - 0.633 * sp))) * 100);
  }

  const chartData = data && data.y3m != null && data.y2y != null && data.y5 != null && data.y10 != null && data.y30 != null
    ? [
        { tenor: "3M", yield: data.y3m },
        { tenor: "2Y", yield: data.y2y },
        { tenor: "5Y", yield: data.y5 },
        { tenor: "10Y", yield: data.y10 },
        { tenor: "30Y", yield: data.y30 },
      ]
    : [];

  const lastUpdated = resp?.fetchedAt
    ? new Date(resp.fetchedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-bg-void p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-gold" />
          <div>
            <h3 className="text-[10px] sm:text-xs font-bold tracking-widest text-text-primary uppercase">
              US Treasury Yield Curve
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: regimeColor, borderColor: regimeColor + "40", backgroundColor: regimeColor + "15" }}>
                {regime}
              </span>
              {resp && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: resp.fromCache ? "#1e293b" : "#14532d30", color: resp.fromCache ? "#64748b" : "#22c55e" }}>
                  {resp.fromCache ? "CACHED" : "LIVE"}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={forceRefresh} disabled={loading || refreshing} className="p-1 rounded text-text-muted hover:text-accent-gold transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3 h-3 ${loading || refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && !loading && (
        <div className="text-xs font-mono text-data-loss bg-data-loss/10 border border-data-loss/20 rounded px-2 py-1 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}

      <div className="flex gap-3 mb-3 shrink-0">
        <div className="flex-1 glass border border-border-subtle rounded-lg p-3">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1">10Y - 3M Spread</p>
          {loading && !data ? <div className="h-6 w-20"><SkeletonPulse /></div> : (
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold font-mono" style={{ color: spreadColor }}>
                {data?.spread10y3m != null ? (data.spread10y3m! > 0 ? "+" : "") + data.spread10y3m : "\u2014"} bps
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 glass border border-border-subtle rounded-lg p-3">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1 flex items-center gap-1">Recession Prob <Info className="w-3 h-3 text-text-muted/50" /></p>
          {loading && !data ? <div className="h-6 w-20"><SkeletonPulse /></div> : (
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold font-mono text-text-primary">{recessionProb}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full"><span className="text-xs font-mono text-text-muted animate-pulse">Loading...</span></div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <defs>
                <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e74c3c" />
                  <stop offset="50%" stopColor="#f1c40f" />
                  <stop offset="100%" stopColor="#2ecc71" />
                </linearGradient>
              </defs>
              <XAxis dataKey="tenor" tick={{ fill: "#888899", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: "#888899", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
              <Tooltip cursor={{ stroke: "#ffffff10", strokeWidth: 1 }} content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="glass border border-border-subtle rounded px-2 py-1 text-xs font-mono">
                      <span className="text-accent-gold font-bold">{payload[0].payload.tenor}: </span>
                      <span className="text-accent-gold font-bold">{payload[0].value.toFixed(2)}%</span>
                    </div>
                  );
                }
                return null;
              }} />
              <Line type="monotone" dataKey="yield" stroke="url(#yieldGradient)" strokeWidth={4} dot={{ r: 6, stroke: "#09090b", strokeWidth: 2, fill: "url(#yieldGradient)" }} activeDot={{ r: 8, stroke: "#fff", strokeWidth: 2 }} animationDuration={500} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">No data available</div>
        )}
      </div>

      {lastUpdated && (
        <p className="text-[9px] font-mono text-text-muted mt-2 text-right shrink-0">
          Updated {lastUpdated} - Yahoo Finance + FRED
        </p>
      )}
    </div>
  );
}

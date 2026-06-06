"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Activity, RefreshCw, AlertTriangle, TrendingDown, Info } from "lucide-react";

interface QuantData {
  y2: number | null;
  y5: number | null;
  y10: number | null;
  spread2y10y: number | null;
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
      setResp(json);
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
      setResp(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60 * 60 * 1000); // 1h
    return () => clearInterval(interval);
  }, []);

  const data = resp?.data;

  // Recharts data
  const chartData = data
    ? [
        { name: "2Y", yield: data.y2 ?? 0 },
        { name: "5Y", yield: data.y5 ?? 0 },
        { name: "10Y", yield: data.y10 ?? 0 },
      ]
    : [];

  const isInverted = data?.inverted ?? false;
  const spreadColor = isInverted ? "#ef4444" : "#22c55e"; // red if inverted, green if normal

  // NY Fed proxy probability (very rough approximation for 10Y-2Y)
  let recessionProb = 0;
  if (data?.spread2y10y !== null && data?.spread2y10y !== undefined) {
    // Formula: e^(-0.5 - 0.6*spread) / (1 + e^(...))  (spread in %)
    const spreadPct = data.spread2y10y / 100;
    const exponent = -0.5333 - 0.633 * spreadPct;
    recessionProb = Math.round((Math.exp(exponent) / (1 + Math.exp(exponent))) * 100);
  }

  const lastUpdated = resp?.fetchedAt
    ? new Date(resp.fetchedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-bg-void p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-gold" />
          <span className="text-xs font-mono font-bold text-text-primary tracking-widest uppercase">
            US Treasury Yield Curve
          </span>
          {resp && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: resp.fromCache ? "#1e293b" : "#14532d30",
                color: resp.fromCache ? "#64748b" : "#22c55e",
              }}
            >
              {resp.fromCache ? "CACHED" : "LIVE"}
            </span>
          )}
        </div>
        <button
          onClick={forceRefresh}
          disabled={loading || refreshing}
          className="p-1 rounded text-text-muted hover:text-accent-gold transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading || refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && !loading && (
        <div className="text-xs font-mono text-data-loss bg-data-loss/10 border border-data-loss/20 rounded px-2 py-1 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* Top: Spread & Probability */}
        <div className="flex gap-3 mb-4 shrink-0">
          <div className="flex-1 glass border border-border-subtle rounded-lg p-3">
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1">
              10Y - 2Y Spread
            </p>
            {loading && !data ? (
              <div className="h-6 w-20"><SkeletonPulse /></div>
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold font-mono" style={{ color: spreadColor }}>
                  {data?.spread2y10y !== null ? (data?.spread2y10y! > 0 ? "+" : "") + data?.spread2y10y : "—"} bps
                </span>
                <span className="text-[10px] font-mono mb-1" style={{ color: spreadColor }}>
                  {isInverted ? "INVERTED" : "NORMAL"}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 glass border border-border-subtle rounded-lg p-3">
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
              Recession Prob <Info className="w-3 h-3 text-text-muted/50" />
            </p>
            {loading && !data ? (
              <div className="h-6 w-20"><SkeletonPulse /></div>
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold font-mono text-text-primary">
                  {recessionProb}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Bar Chart */}
        <div className="flex-1 min-h-0 relative">
          {loading && !data ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-mono text-text-muted animate-pulse">Loading Chart...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#888899", fontSize: 10, fontFamily: "monospace" }} 
                  dy={10}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#888899", fontSize: 10, fontFamily: "monospace" }} 
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  cursor={{ fill: "#ffffff05" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="glass border border-border-subtle rounded px-2 py-1 text-xs font-mono">
                          <span className="text-text-muted">{payload[0].payload.name}: </span>
                          <span className="text-accent-gold font-bold">{payload[0].value}%</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="yield" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => {
                    // Color gradient logic: if inverted, 2Y is highest (red). If normal, 10Y is highest.
                    let fill = "#3b82f6"; // default blue
                    if (isInverted) {
                      if (index === 0) fill = "#ef4444"; // 2Y red
                      if (index === 1) fill = "#f59e0b"; // 5Y orange
                      if (index === 2) fill = "#22c55e"; // 10Y green
                    } else {
                      if (index === 0) fill = "#64748b"; // 2Y muted
                      if (index === 1) fill = "#3b82f6"; // 5Y blue
                      if (index === 2) fill = "#10b981"; // 10Y green
                    }
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {lastUpdated && (
        <p className="text-[9px] font-mono text-text-muted mt-3 text-right shrink-0">
          Updated {lastUpdated} · FRED API (DGS2, DGS5, DGS10)
        </p>
      )}
    </div>
  );
}

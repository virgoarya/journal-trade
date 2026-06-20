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
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  Info,
  Database,
} from "lucide-react";

interface QuantData {
  y3m: number | null;
  y2y: number | null;
  y5: number | null;
  y30: number | null;
  histY3m: number | null;
  histY2y: number | null;
  histY5: number | null;
  histY10: number | null;
  histY30: number | null;
  spread10y3m: number | null;
  spread10y2y: number | null;
  spread30y5y: number | null;
  spread30y3m: number | null;
  inverted: boolean;
  vix: number | null;
  vixSource?: "yahoo" | "fred" | null;
  regime: string;
  curveRegime: string;
}

interface QuantResponse {
  data: QuantData;
  fetchedAt: string;
  fromCache: boolean;
}

interface YieldPoint {
  tenor: string;
  yield: number;
  historical?: number;
}

function buildHistoricalCurve(data: QuantData): YieldPoint[] {
  const tenors: Array<keyof Pick<QuantData, "y3m" | "y2y" | "y5" | "y10" | "y30">> = [
    "y3m",
    "y2y",
    "y5",
    "y10",
    "y30",
  ];
  const histKeys: Array<keyof Pick<QuantData, "histY3m" | "histY2y" | "histY5" | "histY10" | "histY30">> = [
    "histY3m",
    "histY2y",
    "histY5",
    "histY10",
    "histY30",
  ];
  const labels = ["3M", "2Y", "5Y", "10Y", "30Y"];

  const points: YieldPoint[] = [];
  tenors.forEach((tenor, index) => {
    const current = data[tenor];
    const hist = data[histKeys[index]];
    if (typeof current === "number") {
      points.push({
        tenor: labels[index],
        yield: Number(current.toFixed(2)),
        historical: typeof hist === "number" ? Number(hist.toFixed(2)) : undefined,
      });
    }
  });

  return points;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}


function StatCard({
  label,
  value,
  sub,
  tone = "#94a3b8",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="flex-1 glass border border-border-subtle rounded-lg p-3">
      <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold font-mono" style={{ color: tone }}>
          {value}
        </span>
      </div>
      {sub && (
        <p className="text-[9px] text-text-muted font-mono mt-1">{sub}</p>
      )}
    </div>
  );
}

type RawQuantData = Partial<QuantData> & {
  [key: string]: unknown;
};

export function YieldCurvePanel() {
  const [resp, setResp] = useState<QuantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const normalize = (d: RawQuantData): QuantData => ({
    y3m: toNullableNumber(d?.y3m),
    y2y: toNullableNumber(d?.y2y),
    y5: toNullableNumber(d?.y5),
    y10: toNullableNumber(d?.y10),
    y30: toNullableNumber(d?.y30),
    histY3m: toNullableNumber(d?.histY3m),
    histY2y: toNullableNumber(d?.histY2y),
    histY5: toNullableNumber(d?.histY5),
    histY10: toNullableNumber(d?.histY10),
    histY30: toNullableNumber(d?.histY30),
    spread10y3m: toNullableNumber(d?.spread10y3m),
    spread10y2y: toNullableNumber(d?.spread10y2y),
    spread30y5y: toNullableNumber(d?.spread30y5y),
    spread30y3m: toNullableNumber(d?.spread30y3m),
    inverted: Boolean(d?.inverted),
    vix: toNullableNumber(d?.vix),
    vixSource: d?.vixSource ?? null,
    regime: d?.regime ?? "UNKNOWN",
    curveRegime: d?.curveRegime ?? "UNKNOWN",
  });

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/v1/quant/snapshot", {
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal fetch data");
      setResp({ ...json, data: normalize(json.data) });
      setRetryCount(0);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);

      // Retry logic with exponential backoff
      if (retryCount < 3) {
        const backoff = Math.min(1000 * 2 ** retryCount, 10000);
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          fetchData(isRefresh);
        }, backoff);
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const forceRefresh = async () => {
    await fetchData(true);
  };

  useEffect(() => {
    let cancelled = false;
    fetchData();

    const interval = setInterval(() => {
      if (!cancelled) fetchData();
    }, 3 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const data = resp?.data;
  const regime =
    data?.curveRegime && data.curveRegime !== "UNKNOWN"
      ? data.curveRegime
      : "Baseline";
  const displayRegime =
    data?.inverted && regime !== "Inverted" ? `${regime} / Inverted` : regime;
  const regimeColor =
    {
      Baseline: "#94a3b8",
      "Bull Steepener": "#2ecc71",
      "Bull Flattener": "#f1c40f",
      "Bear Flattener": "#e74c3c",
      "Bear Steepener": "#8b0000",
      Inverted: "#ef4444",
    }[regime] || "#94a3b8";

  const spreadColor = data?.inverted ? "#ef4444" : "#22c55e";
  const spread10y3m =
    data?.spread10y3m != null
      ? data.spread10y3m
      : data?.y10 != null && data?.y3m != null
        ? Number(((data.y10 - data.y3m) * 100).toFixed(0))
        : null;
  const spread10y2y =
    data?.spread10y2y != null
      ? data.spread10y2y
      : data?.y10 != null && data?.y2y != null
        ? Number(((data.y10 - data.y2y) * 100).toFixed(0))
        : null;
  const vixValue = data?.vix ?? null;
  const vixColor =
    vixValue === null
      ? "#94a3b8"
      : vixValue >= 20
        ? "#f97316"
        : vixValue >= 15
          ? "#f59e0b"
          : "#22c55e";

  let recessionProb = 0;
  if (spread10y2y != null) {
    const sp = spread10y2y / 100;
    const base =
      Math.exp(-0.5333 - 0.633 * sp) / (1 + Math.exp(-0.5333 - 0.633 * sp));
    const vixAdjustment =
      vixValue != null ? Math.max(0, vixValue - 15) * 0.012 : 0;
    recessionProb = Math.round(Math.min(99, (base + vixAdjustment) * 100));
  }

  const chartData: YieldPoint[] =
    data && data.y5 != null && data.y10 != null && data.y30 != null
      ? buildHistoricalCurve(data)
      : [];

  const lastUpdated = resp?.fetchedAt
    ? new Date(resp.fetchedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-bg-void p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-gold" />
          <div>
            <h3 className="text-[10px] sm:text-xs font-bold tracking-widest text-text-primary uppercase">
              US Treasury Yield Curve
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                style={{
                  color: regimeColor,
                  borderColor: regimeColor + "40",
                  backgroundColor: regimeColor + "15",
                }}
              >
                {displayRegime}
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
              {data?.vixSource && (
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border-subtle"
                  style={{
                    color: data.vixSource === "yahoo" ? "#22c55e" : "#f59e0b",
                  }}
                >
                  VIX {data.vixSource.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={forceRefresh}
          disabled={loading || refreshing}
          className="p-1 rounded text-text-muted hover:text-accent-gold transition-colors disabled:opacity-40"
        >
          <RefreshCw
            className={`w-3 h-3 ${loading || refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {error && !loading && (
        <div className="text-xs font-mono text-data-loss bg-data-loss/10 border border-data-loss/20 rounded px-2 py-1 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 shrink-0">
        <StatCard
          label="10Y - 3M Spread"
          value={
            spread10y3m != null
              ? `${spread10y3m > 0 ? "+" : ""}${spread10y3m} bps`
              : "—"
          }
          tone={spreadColor}
        />
        <StatCard
          label="10Y - 2Y Spread"
          value={
            spread10y2y != null
              ? `${spread10y2y > 0 ? "+" : ""}${spread10y2y} bps`
              : "—"
          }
          tone={data?.inverted ? "#ef4444" : "#22c55e"}
        />
        <StatCard
          label="VIX Source"
          value={data?.vix != null ? data.vix.toFixed(1) : "—"}
          sub={data?.vixSource ? data.vixSource.toUpperCase() : "N/A"}
          tone={vixColor}
        />
        <StatCard
          label="Recession Prob"
          value={`${recessionProb}%`}
          sub="10Y-2Y proxy + VIX stress"
          tone={
            recessionProb >= 40
              ? "#ef4444"
              : recessionProb >= 25
                ? "#f59e0b"
                : "#22c55e"
          }
        />
      </div>



      <div className="grid grid-cols-4 gap-2 mb-3 shrink-0">
        <div className="rounded border border-border-subtle bg-surface-elevated/20 p-2 text-center">
          <div className="text-[8px] text-text-muted font-mono uppercase">
            2Y
          </div>
          <div className="text-xs font-mono font-bold text-text-primary">
            {data?.y2y != null ? `${data.y2y.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-surface-elevated/20 p-2 text-center">
          <div className="text-[8px] text-text-muted font-mono uppercase">
            5Y
          </div>
          <div className="text-xs font-mono font-bold text-text-primary">
            {data?.y5 != null ? `${data.y5.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-surface-elevated/20 p-2 text-center">
          <div className="text-[8px] text-text-muted font-mono uppercase">
            10Y
          </div>
          <div className="text-xs font-mono font-bold text-text-primary">
            {data?.y10 != null ? `${data.y10.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-surface-elevated/20 p-2 text-center">
          <div className="text-[8px] text-text-muted font-mono uppercase">
            30Y
          </div>
          <div className="text-xs font-mono font-bold text-text-primary">
            {data?.y30 != null ? `${data.y30.toFixed(2)}%` : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest">
          Yield Curve / Historical Overlay
        </span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-0.5 bg-gradient-to-r from-data-loss via-data-warning to-data-profit rounded-full" />
            LIVE
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-px border-t border-dashed border-border-subtle" />
            HISTORICAL
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-[220px]">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs font-mono text-text-muted animate-pulse">
              Loading...
            </span>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, bottom: 10, left: -20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <defs>
                <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e74c3c" />
                  <stop offset="50%" stopColor="#f1c40f" />
                  <stop offset="100%" stopColor="#2ecc71" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="tenor"
                tick={{
                  fill: "#888899",
                  fontSize: 10,
                  fontFamily: "monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{
                  fill: "#888899",
                  fontSize: 10,
                  fontFamily: "monospace",
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                cursor={{ stroke: "#ffffff10", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const value = Number(payload[0].value ?? 0);
                    return (
                      <div className="glass border border-border-subtle rounded px-2 py-1 text-xs font-mono">
                        <span className="text-accent-gold font-bold">
                          {payload[0].payload.tenor}:{" "}
                        </span>
                        <span className="text-accent-gold font-bold">
                          {value.toFixed(2)}%
                        </span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#6B7280"
                strokeDasharray="6 6"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="yield"
                stroke="url(#yieldGradient)"
                strokeWidth={4}
                dot={{
                  r: 6,
                  stroke: "#09090b",
                  strokeWidth: 2,
                  fill: "url(#yieldGradient)",
                }}
                activeDot={{ r: 8, stroke: "#fff", strokeWidth: 2 }}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">
            No data available
          </div>
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

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
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

interface QuantData {
  y3m: number | null;
  y2y: number | null;
  y5: number | null;
  y10: number | null;
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
    "y3m", "y2y", "y5", "y10", "y30",
  ];
  const histKeys: Array<keyof Pick<QuantData, "histY3m" | "histY2y" | "histY5" | "histY10" | "histY30">> = [
    "histY3m", "histY2y", "histY5", "histY10", "histY30",
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

/**
 * RecessionGauge — gauge setengah lingkaran (SVG) untuk probabilitas resesi.
 *
 * Fitur:
 * - Busur terisi mengikuti nilai probabilitas (0–99%)
 * - Zona warna: hijau (<25%), amber (25–40%), merah (>=40%)
 * - Interaktif: hover menampilkan rincian perhitungan (base + VIX adjustment)
 * - Accessible: role="img" + aria-label deskriptif
 */
function RecessionGauge({
  value,
  baseProb,
  vixAdj,
  spread10y2y,
  vix,
  hovered,
  onHover,
}: {
  value: number;
  baseProb: number;
  vixAdj: number;
  spread10y2y: number | null;
  vix: number | null;
  hovered: boolean;
  onHover: (v: boolean) => void;
}) {
  const tone = value >= 40 ? "#ef4444" : value >= 25 ? "#f59e0b" : "#22c55e";
  const label = value >= 60 ? "Tinggi" : value >= 40 ? "Waspada" : value >= 25 ? "Sedang" : "Rendah";

  // Geometri busur setengah lingkaran
  const R = 34;
  const CX = 44;
  const CY = 40;
  const CIRC = Math.PI * R; // panjang busur 180°
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * CIRC;

  return (
    <div
      className="relative flex flex-col h-full glass border border-border-subtle rounded-lg p-3 cursor-help transition-colors"
      style={hovered ? { borderColor: tone + "70", backgroundColor: tone + "12" } : {}}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      tabIndex={0}
      role="img"
      aria-label={`Recession probability ${value}% — ${label}. Kontribusi spread 10Y-2Y ${baseProb.toFixed(1)}%, penyesuaian VIX ${vixAdj.toFixed(1)}%.`}
    >
      <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1 leading-none">
        Recession Prob
      </p>

      <div className="flex items-center gap-2 flex-1 min-h-0">
        {/* Gauge SVG */}
        <svg viewBox="0 0 88 50" className="w-[60px] h-[35px] shrink-0" aria-hidden>
          {/* Track */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke="#2a2a3a"
            strokeWidth={7}
            strokeLinecap="round"
          />
          {/* Zona ambang (penanda 25% & 40%) */}
          {[25, 40].map((mark) => {
            const a = Math.PI * (1 - mark / 100);
            const x1 = CX + Math.cos(a) * (R - 4.5);
            const y1 = CY - Math.sin(a) * (R - 4.5);
            const x2 = CX + Math.cos(a) * (R + 4.5);
            const y2 = CY - Math.sin(a) * (R + 4.5);
            return (
              <line
                key={mark}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={mark === 25 ? "#f59e0b" : "#ef4444"}
                strokeWidth={1}
                opacity={0.5}
              />
            );
          })}
          {/* Progress */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke={tone}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC}`}
            style={{ transition: "stroke-dasharray .5s ease, stroke .3s ease" }}
          />
          {/* Needle */}
          {(() => {
            const a = Math.PI * (1 - pct / 100);
            const nx = CX + Math.cos(a) * (R - 8);
            const ny = CY - Math.sin(a) * (R - 8);
            return (
              <g style={{ transition: "all .5s ease" }}>
                <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={tone} strokeWidth={1.6} strokeLinecap="round" />
                <circle cx={CX} cy={CY} r={2.6} fill={tone} />
              </g>
            );
          })()}
          {/* Nilai di tengah bawah busur */}
          <text
            x={CX} y={CY - 6}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill={tone}
            fontFamily="ui-monospace, monospace"
          >
            {value}%
          </text>
        </svg>

        {/* Label status */}
        <div className="min-w-0">
          <div className="text-[10px] font-mono font-bold leading-none" style={{ color: tone }}>
            {label}
          </div>
          <div className="text-[8px] font-mono text-text-muted leading-tight mt-1">
            {spread10y2y != null ? `${spread10y2y > 0 ? "+" : ""}${spread10y2y} bps` : "—"}
            <br />
            VIX {vix != null ? vix.toFixed(1) : "—"}
          </div>
        </div>
      </div>

      {/* Tooltip rincian perhitungan */}
      {hovered && (
        <div className="absolute right-0 top-full mt-2 z-40 w-52 pointer-events-none">
          <div className="w-2 h-2 glass border-l border-t border-border-subtle rotate-45 ml-auto mr-8 -mb-1" aria-hidden />
          <div className="glass border border-border-subtle rounded-lg px-2.5 py-2 shadow-xl text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold text-text-primary">
                Recession Prob
              </span>
              <span className="text-[10px] font-mono font-bold" style={{ color: tone }}>
                {value}%
              </span>
            </div>
            <div className="space-y-1 text-[9px] font-mono">
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-muted">Spread 10Y-2Y</span>
                <span className="text-text-secondary tabular-nums">
                  {spread10y2y != null ? `${spread10y2y > 0 ? "+" : ""}${spread10y2y} bps` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-muted">→ kontribusi</span>
                <span className="text-text-primary font-bold tabular-nums">
                  {baseProb.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-muted">VIX stress</span>
                <span className="text-text-secondary tabular-nums">
                  {vix != null ? vix.toFixed(1) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-muted">→ tambahan</span>
                <span className="text-text-primary font-bold tabular-nums">
                  +{vixAdj.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border-subtle/50 pt-1">
                <span className="text-text-muted">Total</span>
                <span className="font-bold tabular-nums" style={{ color: tone }}>
                  {value}%
                </span>
              </div>
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-border-subtle/50 flex items-center justify-between text-[8px] font-mono text-text-muted">
              <span>&lt;25 Rendah</span>
              <span>25–40 Sedang</span>
              <span>&ge;40 Waspada</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  subTitle,
  tone = "#94a3b8",
}: {
  label: string;
  value: string;
  sub?: string;
  /** Teks lengkap untuk atribut title — dipakai saat `sub` dipendekkan. */
  subTitle?: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-lg p-3">
      <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1 leading-none">
        {label}
      </p>
      <div className="flex items-end gap-2 flex-1 min-w-0">
        <span className="text-xl font-bold font-mono leading-none tabular-nums" style={{ color: tone }}>
          {value}
        </span>
      </div>
      {/* Subteks 1 baris. JANGAN pakai line-clamp (memotong jadi ellipsis di
          layar sempit) — biarkan wrap ke 2 baris dengan tinggi terkunci,
          dan pakai title agar teks lengkap tetap bisa dilihat saat hover. */}
      {sub && (
        <p
          className="text-[9px] text-text-muted font-mono mt-1 leading-tight min-h-[11px]"
          title={subTitle || sub}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

type RawQuantData = Partial<QuantData> & {
  [key: string]: unknown;
};

interface YieldCurvePanelProps {
  className?: string;
}

export function YieldCurvePanel({ className }: YieldCurvePanelProps) {
  const [resp, setResp] = useState<QuantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // Tenor yang sedang di-hover — untuk menampilkan detail delta di tooltip
  const [hoveredTenor, setHoveredTenor] = useState<string | null>(null);
  // Gauge recession prob sedang di-hover (menampilkan rincian perhitungan)
  const [recessionHover, setRecessionHover] = useState(false);

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
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal fetch data");
      setResp({ ...json, data: normalize(json.data) });
      setRetryCount(0);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);

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

  // ─── Recession probability ───
  // Model: logistik dari spread 10Y-2Y + penyesuaian stres VIX.
  // Komponen disimpan terpisah supaya gauge bisa menampilkan rinciannya.
  let recessionProb = 0;
  let recessionBaseProb = 0; // kontribusi murni dari spread 10Y-2Y
  let recessionVixAdj = 0;   // tambahan dari VIX stress (dalam persen)
  if (spread10y2y != null) {
    const sp = spread10y2y / 100;
    const base =
      Math.exp(-0.5333 - 0.633 * sp) / (1 + Math.exp(-0.5333 - 0.633 * sp));
    recessionBaseProb = base * 100;
    recessionVixAdj =
      vixValue != null ? Math.max(0, vixValue - 15) * 0.012 * 100 : 0;
    recessionProb = Math.round(
      Math.min(99, recessionBaseProb + recessionVixAdj)
    );
  }

  const chartData: YieldPoint[] =
    data && data.y3m != null && data.y5 != null && data.y10 != null
      ? buildHistoricalCurve(data)
      : [];

  // ─── Delta tenor: current vs historical (untuk arrow naik/turun) ───
  // Sumber: FRED DGS* (current) vs observasi ~1 bulan lalu (historical).
  const TENOR_META: Array<{
    label: string;
    curKey: keyof QuantData;
    histKey: keyof QuantData;
  }> = [
    { label: "3M", curKey: "y3m", histKey: "histY3m" },
    { label: "2Y", curKey: "y2y", histKey: "histY2y" },
    { label: "5Y", curKey: "y5", histKey: "histY5" },
    { label: "10Y", curKey: "y10", histKey: "histY10" },
    { label: "30Y", curKey: "y30", histKey: "histY30" },
  ];

  const tenorRows = TENOR_META.map(({ label, curKey, histKey }) => {
    const cur = data?.[curKey] as number | null | undefined;
    const hist = data?.[histKey] as number | null | undefined;
    const hasBoth =
      typeof cur === "number" && typeof hist === "number" && Number.isFinite(cur) && Number.isFinite(hist);
    const deltaBps = hasBoth ? Math.round((cur - hist) * 100) : null;
    const dir: "up" | "down" | "flat" | null =
      deltaBps === null ? null : deltaBps > 1 ? "up" : deltaBps < -1 ? "down" : "flat";
    return { label, cur, hist, deltaBps, dir };
  });

  const lastUpdated = resp?.fetchedAt
    ? new Date(resp.fetchedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className={`flex flex-col h-full w-full glass overflow-hidden relative p-4 ${className || ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-accent-gold" />
          <div>
            <h3 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs">
              US Treasury Yield Curve
            </h3>
            <div className="flex items-center gap-2 mt-2">
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
          title="Refresh data"
          className="p-1.5 rounded-md border border-border-subtle text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-colors disabled:opacity-40 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading || refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="text-xs font-mono text-data-loss bg-data-loss/10 border border-data-loss/20 rounded px-2 py-1 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 shrink-0">
        <StatCard
          label="10Y - 3M Spread"
          value={spread10y3m != null ? `${spread10y3m > 0 ? "+" : ""}${spread10y3m} bps` : "\u2014"}
          sub={spread10y3m != null ? (spread10y3m < 0 ? "Kontraksi" : "Ekspansi") : "\u2014"}
          subTitle={`Fed Recession Gauge \u00b7 ${spread10y3m != null ? (spread10y3m < 0 ? "Kontraksi" : "Ekspansi") : "data belum tersedia"}`}
          tone={spread10y3m != null && spread10y3m < 0 ? "#ef4444" : "#22c55e"}
        />
        <StatCard
          label="10Y - 2Y Spread"
          value={spread10y2y != null ? `${spread10y2y > 0 ? "+" : ""}${spread10y2y} bps` : "\u2014"}
          sub={spread10y2y != null ? (spread10y2y < 0 ? "Kontraksi" : "Ekspansi") : "\u2014"}
          subTitle={`Leading Indicator \u00b7 ${spread10y2y != null ? (spread10y2y < 0 ? "Kontraksi" : "Ekspansi") : "data belum tersedia"}`}
          tone={spread10y2y != null && spread10y2y < 0 ? "#ef4444" : "#22c55e"}
        />
        <StatCard
          label="VIX"
          value={data?.vix != null ? data.vix.toFixed(1) : "\u2014"}
          sub={data?.vix != null ? (data.vix >= 20 ? "Elevated" : data.vix >= 15 ? "Normal" : "Calm") : "\u2014"}
          subTitle={`${data?.vix != null ? (data.vix >= 20 ? "Elevated" : data.vix >= 15 ? "Normal" : "Calm") : "data belum tersedia"} \u00b7 sumber ${data?.vixSource ? data.vixSource.toUpperCase() : "N/A"}`}
          tone={vixColor}
        />
        <RecessionGauge
          value={recessionProb}
          baseProb={recessionBaseProb}
          vixAdj={recessionVixAdj}
          spread10y2y={spread10y2y}
          vix={vixValue}
          hovered={recessionHover}
          onHover={setRecessionHover}
        />
      </div>

      {/* Yield Tenors — dengan arrow naik/turun + tooltip interaktif */}
      <div className="grid grid-cols-5 gap-2 mb-3 shrink-0">
        {tenorRows.map(({ label, cur, hist, deltaBps, dir }, idx) => {
          const isHovered = hoveredTenor === label;
          // Warna mengikuti arah pergerakan: naik = merah (yield tinggi = tekanan),
          // turun = hijau, flat = netral.
          const tone =
            dir === "up" ? "#ef4444" : dir === "down" ? "#22c55e" : "#94a3b8";
          const ArrowIcon =
            dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
          // Kartu tepi: geser tooltip agar tidak keluar batas panel (overflow-hidden).
          const isFirst = idx === 0;
          const isLast = idx === tenorRows.length - 1;
          const tipPos = isFirst
            ? "left-0"
            : isLast
              ? "right-0"
              : "left-1/2 -translate-x-1/2";
          const arrowPos = isFirst ? "ml-7" : isLast ? "mr-7 ml-auto" : "mx-auto";

          return (
            <div
              key={label}
              className="relative rounded border border-border-subtle glass px-2 py-1.5 text-center flex flex-col justify-center min-h-[52px] cursor-help transition-colors"
              style={isHovered ? { borderColor: tone + "70", backgroundColor: tone + "12" } : {}}
              onMouseEnter={() => setHoveredTenor(label)}
              onMouseLeave={() => setHoveredTenor(null)}
              onFocus={() => setHoveredTenor(label)}
              onBlur={() => setHoveredTenor(null)}
              tabIndex={0}
              role="button"
              aria-label={`Tenor ${label}: ${cur != null ? cur.toFixed(2) + "%" : "tidak tersedia"}, ${
                deltaBps != null
                  ? `${deltaBps > 0 ? "naik" : deltaBps < 0 ? "turun" : "flat"} ${Math.abs(deltaBps)} bps vs 1 bulan lalu`
                  : "data historis tidak tersedia"
              }`}
            >
              <div className="text-[8px] text-text-muted font-mono uppercase tracking-wider leading-none">
                {label}
              </div>

              <div className="flex items-center justify-center gap-1 mt-1 leading-none">
                <span className="text-xs font-mono font-bold text-text-primary tabular-nums">
                  {cur != null ? `${Number(cur).toFixed(2)}%` : "\u2014"}
                </span>
                {dir && <ArrowIcon size={10} style={{ color: tone }} className="shrink-0" />}
              </div>

              {/* Delta kecil di bawah — selalu terlihat */}
              {deltaBps != null && (
                <div
                  className="text-[8px] font-mono mt-0.5 leading-none tabular-nums"
                  style={{ color: tone }}
                >
                  {deltaBps > 0 ? "+" : ""}
                  {deltaBps} bps
                </div>
              )}

              {/* Tooltip detail saat hover — membuka KE BAWAH agar tidak menabrak
                  baris stat card di atas, dan tepi kartu digeser agar tidak terpotong */}
              {isHovered && (
                <div
                  className={`absolute top-full mt-2 z-40 w-44 pointer-events-none ${tipPos}`}
                >
                  {/* Panah penunjuk (menghadap ke atas, ke arah kartu) */}
                  <div
                    className={`w-2 h-2 glass border-l border-t border-border-subtle rotate-45 -mb-1 ${arrowPos}`}
                    aria-hidden
                  />
                  <div className="glass border border-border-subtle rounded-lg px-2.5 py-2 shadow-xl text-left">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-text-primary">
                        {label}
                      </span>
                      <ArrowIcon size={11} style={{ color: tone }} />
                    </div>
                    <div className="space-y-1 text-[9px] font-mono">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-text-muted">Sekarang</span>
                        <span className="text-text-primary font-bold tabular-nums">
                          {cur != null ? `${Number(cur).toFixed(2)}%` : "\u2014"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-text-muted">1 bln lalu</span>
                        <span className="text-text-secondary tabular-nums">
                          {hist != null ? `${Number(hist).toFixed(2)}%` : "\u2014"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-border-subtle/50 pt-1">
                        <span className="text-text-muted">Perubahan</span>
                        <span className="font-bold tabular-nums" style={{ color: tone }}>
                          {deltaBps != null
                            ? `${deltaBps > 0 ? "+" : ""}${deltaBps} bps`
                            : "\u2014"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart Legend */}
      <div className="flex items-center justify-between mb-1.5 shrink-0">
        <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest">
          Yield Curve / Historical Overlay
        </span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-0.5 bg-gradient-to-r from-data-loss via-data-warning to-data-profit rounded-full" />
            LIVE
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-px border-t-2 border-dashed border-slate-400" />
            HISTORICAL
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[190px] w-full">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs font-mono text-text-muted animate-pulse">Loading...</span>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={190}
            initialDimension={{ width: 520, height: 210 }}
          >
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
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
                tick={{ fill: "#cbd5e1", fontSize: 11, fontFamily: "monospace", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#cbd5e1", fontSize: 11, fontFamily: "monospace", fontWeight: 500 }}
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
                        <span className="text-accent-gold font-bold">{payload[0].payload.tenor}: </span>
                        <span className="text-accent-gold font-bold">{value.toFixed(2)}%</span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#94a3b8"
                strokeDasharray="5 5"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#94a3b8", stroke: "none" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="yield"
                stroke="url(#yieldGradient)"
                strokeWidth={3}
                dot={{ r: 5, stroke: "#09090b", strokeWidth: 2, fill: "url(#yieldGradient)" }}
                activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }}
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

      {/* Footer */}
      {lastUpdated && (
        <p className="text-[9px] font-mono text-text-muted mt-2 text-right shrink-0">
          Updated {lastUpdated} · Sumber: FRED
        </p>
      )}
    </div>
  );
}
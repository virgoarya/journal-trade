"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Minimize2, Maximize2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { clsx } from "clsx";

export interface SignalDataPoint {
  timestamp: string | number;
  price: number;
  signal?: "buy" | "sell" | "wait";
  confidence?: number;
  pnl?: number;
}

export interface SignalChartProps {
  data: SignalDataPoint[];
  symbol: string;
  timeframe: string;
  currentPrice?: number;
  height?: number;
  showSignals?: boolean;
  className?: string;
  onTimeframeChange?: (tf: string) => void;
  timeframes?: string[];
  compact?: boolean;
}

const COLORS = {
  grid: "rgba(255, 255, 255, 0.03)",
  text: "#94A3B8",
  line: "#D4AF37",
  areaStart: "rgba(212, 175, 55, 0.15)",
  areaEnd: "rgba(212, 175, 55, 0)",
  buy: "#39FF88",
  sell: "#FF3864",
  buyBg: "rgba(57, 255, 136, 0.1)",
  sellBg: "rgba(255, 56, 100, 0.1)",
  tooltipBg: "rgba(21, 21, 32, 0.95)",
  tooltipBorder: "rgba(212, 175, 55, 0.3)",
};

export function SignalChart({
  data,
  symbol,
  timeframe,
  currentPrice,
  height = 300,
  showSignals = true,
  className,
  onTimeframeChange,
  timeframes = ["M1", "M5", "M15", "H1", "H4", "D1"],
  compact = false,
}: SignalChartProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const chartData = useMemo(() => {
    if (!data.length) return [];
    return data.map((d, i) => ({
      ...d,
      index: i,
      ts: typeof d.timestamp === "string"
        ? d.timestamp
        : new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
  }, [data]);

  const priceRange = useMemo(() => {
    if (!chartData.length) return { min: 0, max: 100 };
    const prices = chartData.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min) * 0.05 || 1;
    return { min: min - pad, max: max + pad };
  }, [chartData]);

  const latestSignal = useMemo(() => {
    if (!showSignals) return null;
    return [...chartData].reverse().find((d) => d.signal && d.signal !== "wait");
  }, [chartData, showSignals]);

  const fmt = (p: number) => {
    if (symbol.includes("JPY")) return p.toFixed(3);
    if (symbol.includes("XAU") || symbol.includes("BTC")) return p.toFixed(2);
    return p.toFixed(5);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0].payload;
    const sColor = pt.signal === "buy" ? COLORS.buy : pt.signal === "sell" ? COLORS.sell : COLORS.text;
    const sLabel = pt.signal === "buy" ? "BUY" : pt.signal === "sell" ? "SELL" : "WAIT";

    return (
      <div
        style={{
          backgroundColor: COLORS.tooltipBg,
          border: `1px solid ${COLORS.tooltipBorder}`,
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          padding: "12px 16px",
        }}
        className="font-mono"
      >
        <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2 gap-3">
          <span className="text-[10px] text-text-muted uppercase">{symbol} {timeframe}</span>
          <span className="text-[10px] font-bold" style={{ color: sColor }}>{sLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div>
            <span className="text-text-muted">Price </span>
            <span className="font-bold text-text-primary">{fmt(pt.price)}</span>
          </div>
          <div>
            <span className="text-text-muted">Time </span>
            <span className="font-bold text-text-primary">{pt.ts}</span>
          </div>
          {pt.confidence !== undefined && (
            <div>
              <span className="text-text-muted">Confidence </span>
              <span className="font-bold text-accent-gold">{pt.confidence}%</span>
            </div>
          )}
          {pt.pnl !== undefined && (
            <div>
              <span className="text-text-muted">PnL </span>
              <span className="font-bold" style={{ color: pt.pnl >= 0 ? COLORS.buy : COLORS.sell }}>
                {pt.pnl >= 0 ? "+" : ""}${pt.pnl.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!chartData.length) {
    return (
      <div className={clsx("glass p-4 flex items-center justify-center border border-white/5 rounded-2xl", className)} style={{ height }}>
        <div className="text-center text-text-muted">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-accent-gold/50" />
          <p className="text-xs font-mono uppercase">No data</p>
          <p className="text-[10px] mt-1">{symbol} {timeframe}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "glass relative overflow-hidden border border-white/5 rounded-2xl",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0",
        className
      )}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.areaStart} />
          <stop offset="100%" stopColor={COLORS.areaEnd} />
        </linearGradient>
      </defs>

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-accent-gold animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-accent-gold">{symbol}</span>
          <span className="text-text-muted">|</span>
          <span className="text-[10px] font-mono text-text-secondary">{timeframe}</span>
          {latestSignal && (
            <span
              className={clsx(
                "px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase",
                latestSignal.signal === "buy"
                  ? "bg-neon-green/20 text-neon-green"
                  : "bg-neon-red/20 text-neon-red"
              )}
            >
              {latestSignal.signal === "buy" ? "BUY" : "SELL"} SIGNAL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 pointer-events-auto">
          <select
            value={timeframe}
            onChange={(e) => onTimeframeChange?.(e.target.value)}
            className="bg-bg-surface/80 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 appearance-none cursor-pointer"
          >
            {timeframes.map((tf) => (
              <option key={tf} value={tf} className="bg-bg-surface text-text-primary">{tf}</option>
            ))}
          </select>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 bg-bg-surface/80 border border-white/10 rounded-lg text-text-muted hover:text-accent-gold hover:border-accent-gold/30 transition-all"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: compact ? 10 : 44, right: 16, left: 0, bottom: compact ? 10 : 44 }}
        >
          <CartesianGrid strokeDasharray="4 4" stroke={COLORS.grid} vertical={false} />
          <XAxis
            dataKey="ts"
            type="category"
            tick={{ fill: COLORS.text, fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
            tickLine={false}
            interval={compact ? "preserveStartEnd" : "preserveStartEnd"}
          />
          <YAxis
            orientation="right"
            width={60}
            tick={{ fill: COLORS.text, fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
            tickLine={false}
            domain={[priceRange.min, priceRange.max]}
            tickFormatter={fmt}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "4 4", stroke: "rgba(212,175,55,0.3)" }} />
          <Area type="monotone" dataKey="price" stroke="none" fill="url(#chartArea)" />
          <Line
            type="monotone"
            dataKey="price"
            stroke={COLORS.line}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: COLORS.line, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Bottom bar */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none z-10">
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-[9px] text-text-muted font-mono uppercase">High</p>
            <p className="font-mono text-[11px] text-text-primary">{fmt(priceRange.max)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-text-muted font-mono uppercase">Low</p>
            <p className="font-mono text-[11px] text-text-primary">{fmt(priceRange.min)}</p>
          </div>
        </div>
        {currentPrice != null && (
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-lg font-bold text-accent-gold">{fmt(currentPrice)}</span>
            <span className={clsx("text-[10px] font-mono", currentPrice >= (chartData[chartData.length - 1]?.price ?? 0) ? "text-neon-green" : "text-neon-red")}>
              {currentPrice >= (chartData[chartData.length - 1]?.price ?? 0) ? (
                <TrendingUp className="w-3 h-3 inline" />
              ) : (
                <TrendingDown className="w-3 h-3 inline" />
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

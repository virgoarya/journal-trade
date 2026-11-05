/**
 * Sparkline SVG ringan tanpa library eksternal.
 * Spec: Fase 2 — Screener & Sparkline
 */
import React from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 90,
  height = 24,
  color,
  className = "",
}: SparklineProps) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ width, height }} className={`inline-block ${className}`} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = color ?? (isUp ? "var(--color-data-profit, #39FF88)" : "var(--color-data-loss, #FF3864)");

  return (
    <svg width={width} height={height} className={`overflow-visible inline-block ${className}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default Sparkline;

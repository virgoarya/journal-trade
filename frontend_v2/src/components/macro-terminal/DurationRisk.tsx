import React from "react";

interface DurationRiskProps {
  y10: number | null;
  y30: number | null;
}

/**
 * Modified duration par-bond: MD = (1 − (1+y)^−n) / y
 * Dipakai untuk menerjemahkan pergerakan yield jadi estimasi dampak harga.
 */
function approxModifiedDuration(y: number | null, years: number): number | null {
  if (y === null || !Number.isFinite(y)) return null;
  const r = y / 100;
  if (r <= 0) return years;
  const md = (1 - Math.pow(1 + r, -years)) / r;
  return Math.round(md * 10) / 10;
}

export function DurationRisk({ y10, y30 }: DurationRiskProps) {
  const toNum = (v: any): number | null => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };

  const v10 = toNum(y10);
  const v30 = toNum(y30);

  // Spread 30Y-10Y dalam bps
  const durationRisk =
    v10 !== null && v30 !== null ? Math.round((v30 - v10) * 100 * 100) / 100 : null;

  // Modified duration & DV01 (per $100k notional)
  const md10 = approxModifiedDuration(v10, 10);
  const md30 = approxModifiedDuration(v30, 30);
  const dv01Per100k = (md: number | null) =>
    md !== null ? Math.round(md * 0.0001 * 100000 * 10) / 10 : null;
  const dv01_10 = dv01Per100k(md10);
  const dv01_30 = dv01Per100k(md30);

  const getRiskColor = (risk: number | null): string => {
    if (risk === null) return "#94a3b8";
    if (risk > 50) return "#ef4444";
    if (risk > 20) return "#f59e0b";
    if (risk > 0) return "#22c55e";
    if (risk < -50) return "#10b981";
    if (risk < -20) return "#3b82f6";
    if (risk < 0) return "#8b5cf6";
    return "#94a3b8";
  };

  const tone = getRiskColor(durationRisk);
  const shape =
    durationRisk === null
      ? "—"
      : durationRisk > 20
        ? "Steepening"
        : durationRisk < -20
          ? "Flattening"
          : "Datar";

  return (
    <div className="glass border border-border-subtle rounded-lg p-3 pt-2 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-accent-gold bg-accent-gold/10 border border-accent-gold/20">
          QUANT
        </span>
        <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
          Duration Risk
        </h3>
        <span
          className="ml-auto text-[8px] font-mono text-text-muted cursor-help"
          title="Modified duration par-bond: MD = (1 − (1+y)^−n) / y. DV01 = MD × 0,01% × notional. Estimasi kasar untuk obligasi par."
        >
          ⓘ
        </span>
      </div>

      {/* Baris 1: spread + bentuk kurva */}
      <div className="flex items-center justify-between gap-2 glass border border-border-subtle rounded px-2 py-1.5">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase text-text-muted leading-none">
            30Y − 10Y
          </div>
          <div
            className="text-[11px] font-mono font-bold leading-none mt-1 tabular-nums"
            style={{ color: tone }}
          >
            {durationRisk !== null
              ? `${durationRisk > 0 ? "+" : ""}${durationRisk.toFixed(1)} bps`
              : "—"}
          </div>
        </div>
        <span
          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
          style={{ color: tone, backgroundColor: tone + "18", border: `1px solid ${tone}40` }}
        >
          {shape}
        </span>
      </div>

      {/* Baris 2: modified duration + DV01 per tenor */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="flex flex-col glass border border-border-subtle rounded px-2 py-1.5">
          <span className="text-[9px] font-mono uppercase text-text-muted leading-none">
            10Y MD
          </span>
          <span className="text-[11px] font-mono font-bold text-text-primary leading-none mt-1 tabular-nums">
            {md10 !== null ? `${md10.toFixed(1)} thn` : "—"}
          </span>
          <span className="text-[8px] font-mono text-text-muted leading-none mt-1 tabular-nums">
            DV01 ${dv01_10 !== null ? dv01_10.toFixed(1) : "—"}/100k
          </span>
        </div>
        <div className="flex flex-col glass border border-border-subtle rounded px-2 py-1.5">
          <span className="text-[9px] font-mono uppercase text-text-muted leading-none">
            30Y MD
          </span>
          <span className="text-[11px] font-mono font-bold text-text-primary leading-none mt-1 tabular-nums">
            {md30 !== null ? `${md30.toFixed(1)} thn` : "—"}
          </span>
          <span className="text-[8px] font-mono text-text-muted leading-none mt-1 tabular-nums">
            DV01 ${dv01_30 !== null ? dv01_30.toFixed(1) : "—"}/100k
          </span>
        </div>
      </div>

      {/* Baris 3: dampak harga bila spread melebar — satu baris ringkas */}
      <p className="text-[8px] font-mono text-text-muted/80 mt-1.5 leading-none">
        {md30 !== null ? `Yield 30Y +100 bps → harga −${md30.toFixed(1)}%` : "Estimasi dampak harga"}
      </p>
    </div>
  );
}

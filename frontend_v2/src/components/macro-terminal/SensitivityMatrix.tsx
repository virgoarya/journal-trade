import React from "react";

interface SensitivityMatrixProps {
  spread10y3m: number | null;
  spread10y2y: number | null;
  spread30y5y: number | null;
  spread30y3m: number | null;
}

/**
 * Sensitivity Matrix — estimasi dampak harga obligasi terhadap pergerakan spread.
 *
 * Rumus: dampak (%) = (spread bps ÷ 100) × sensitivitas tenor
 * Sensitivitas = pengali berbasis aproksimasi DV01 per segmen kurva.
 *
 * PENTING: angka ini BUKAN nilai spread. Tampilkan spread asli di baris kedua
 * supaya user tidak salah membaca (dulu hanya "Base: Nx" tanpa penjelasan).
 */
export function SensitivityMatrix({
  spread10y3m,
  spread10y2y,
  spread30y5y,
  spread30y3m,
}: SensitivityMatrixProps) {
  const toNum = (v: any): number | null => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };

  // Sensitivitas per segmen kurva (aproksimasi DV01)
  const SEGMENTS: Array<{ key: string; spread: number | null; sens: number }> = [
    { key: "10Y−3M", spread: toNum(spread10y3m), sens: 1.2 },
    { key: "10Y−2Y", spread: toNum(spread10y2y), sens: 1.5 },
    { key: "30Y−5Y", spread: toNum(spread30y5y), sens: 1.8 },
    { key: "30Y−3M", spread: toNum(spread30y3m), sens: 2.0 },
  ];

  const getImpactColor = (impact: number | null): string => {
    if (impact === null) return "#94a3b8";
    if (impact > 0.5) return "#ef4444";
    if (impact > 0.2) return "#f59e0b";
    if (impact > 0) return "#22c55e";
    if (impact < -0.5) return "#10b981";
    if (impact < -0.2) return "#3b82f6";
    if (impact < 0) return "#8b5cf6";
    return "#94a3b8";
  };

  return (
    <div className="glass border border-border-subtle rounded-lg p-3 pt-2 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-accent-gold bg-accent-gold/10 border border-accent-gold/20">
          QUANT
        </span>
        <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
          Sensitivity Matrix
        </h3>
        <span
          className="ml-auto text-[8px] font-mono text-text-muted cursor-help"
          title="Dampak (%) = (spread bps ÷ 100) × sensitivitas tenor. Sensitivitas = aproksimasi DV01 per segmen kurva. Ini estimasi dampak harga, BUKAN nilai spread."
        >
          ⓘ
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SEGMENTS.map(({ key, spread, sens }) => {
          const impact =
            spread === null ? null : Math.round(((spread / 100) * sens) * 100) / 100;
          const tone = getImpactColor(impact);

          return (
            <div key={key} className="flex flex-col glass border border-border-subtle rounded px-2 py-1.5">
              <span className="text-[9px] font-mono uppercase text-text-muted leading-none">
                {key}
              </span>
              {/* Dampak harga (angka utama) */}
              <span
                className="text-[11px] font-mono font-bold leading-none mt-1 tabular-nums"
                style={{ color: tone }}
              >
                {impact !== null ? `${impact > 0 ? "+" : ""}${impact.toFixed(2)}%` : "—"}
              </span>
              {/* Spread asli + sensitivitas sebagai konteks */}
              <span className="text-[8px] font-mono text-text-muted leading-none mt-1 tabular-nums">
                spread {spread !== null ? `${spread > 0 ? "+" : ""}${spread} bps` : "—"} · {sens}×
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[8px] font-mono text-text-muted/70 mt-2 leading-tight border-t border-border-subtle/40 pt-1.5">
        Estimasi dampak harga = (spread ÷ 100) × sensitivitas. Bukan nilai spread.
      </p>
    </div>
  );
}

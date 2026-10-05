"use client";

import React, { useState, useEffect } from "react";

interface RealYieldProps {
  y10: number | null;
  y30: number | null;
  /**
   * Breakeven inflation 10Y (FRED T10YIE). Kalau tidak dikirim, komponen
   * mengambil sendiri dari /api/v1/nexus/snapshot supaya tidak hardcode.
   */
  inflation?: number | null;
}

/** Fallback terakhir kalau API gagal — nilai T10YIE terakhir yang diketahui. */
const INFLATION_FALLBACK = 2.36;

export function RealYield({ y10, y30, inflation }: RealYieldProps) {
  const [liveInflation, setLiveInflation] = useState<number | null>(null);

  // Ambil breakeven inflation live kalau prop tidak diberikan.
  // SEBELUMNYA: hardcoded 2.5% → real yield bias ~+0.14pp.
  useEffect(() => {
    if (typeof inflation === "number" && Number.isFinite(inflation)) return; // prop menang

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/nexus/snapshot");
        const json = await res.json();
        const be = json?.data?.breakeven10y;
        if (!cancelled && typeof be === "number" && Number.isFinite(be)) {
          setLiveInflation(be);
        }
      } catch {
        /* pakai fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inflation]);

  const inf =
    typeof inflation === "number" && Number.isFinite(inflation)
      ? inflation
      : (liveInflation ?? INFLATION_FALLBACK);

  const toNum = (v: any): number | null => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };
  const v10 = toNum(y10);
  const v30 = toNum(y30);

  const real = (nominal: number | null): number | null =>
    nominal === null ? null : Math.round((nominal - inf) * 100) / 100;

  const realYield10 = real(v10);
  const realYield30 = real(v30);

  // Real yield curve slope: 30Y real − 10Y real
  const realSlope =
    realYield10 !== null && realYield30 !== null
      ? Math.round((realYield30 - realYield10) * 100) / 100
      : null;

  const getYieldColor = (y: number | null): string => {
    if (y === null) return "#94a3b8";
    if (y > 3) return "#22c55e";
    if (y > 2) return "#f59e0b";
    if (y > 1) return "#f97316";
    return "#ef4444";
  };

  // Konteks: real yield > 2% umumnya dianggap restriktif bagi aset berisiko
  const regime10 =
    realYield10 === null
      ? "—"
      : realYield10 >= 2.5
        ? "Restriktif"
        : realYield10 >= 1.5
          ? "Netral"
          : "Akomodatif";

  return (
    <div className="glass border border-border-subtle rounded-lg p-3 pt-2 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-accent-gold bg-accent-gold/10 border border-accent-gold/20">
          QUANT
        </span>
        <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
          Real Yields
        </h3>
        <span
          className="ml-auto text-[8px] font-mono text-text-muted cursor-help"
          title="Real yield = yield nominal − breakeven inflation (T10YIE). Menunjukkan imbal hasil setelah inflasi ekspektasi."
        >
          ⓘ
        </span>
      </div>

      {/* Baris 1: real yield 10Y & 30Y + nominal di bawahnya */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col glass border border-border-subtle rounded px-2 py-1.5">
          <span className="text-[9px] font-mono uppercase text-text-muted leading-none">
            10Y Real
          </span>
          <span
            className="text-[11px] font-mono font-bold leading-none mt-1 tabular-nums"
            style={{ color: getYieldColor(realYield10) }}
          >
            {realYield10 !== null ? `${realYield10.toFixed(2)}%` : "—"}
          </span>
          <span className="text-[8px] font-mono text-text-muted leading-none mt-1 tabular-nums">
            nominal {v10 !== null ? `${v10.toFixed(2)}%` : "—"}
          </span>
        </div>

        <div className="flex flex-col glass border border-border-subtle rounded px-2 py-1.5">
          <span className="text-[9px] font-mono uppercase text-text-muted leading-none">
            30Y Real
          </span>
          <span
            className="text-[11px] font-mono font-bold leading-none mt-1 tabular-nums"
            style={{ color: getYieldColor(realYield30) }}
          >
            {realYield30 !== null ? `${realYield30.toFixed(2)}%` : "—"}
          </span>
          <span className="text-[8px] font-mono text-text-muted leading-none mt-1 tabular-nums">
            nominal {v30 !== null ? `${v30.toFixed(2)}%` : "—"}
          </span>
        </div>
      </div>

      {/* Baris 2: slope real + status regime */}
      <div className="flex items-center justify-between gap-2 mt-2 glass border border-border-subtle rounded px-2 py-1.5">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase text-text-muted leading-none">
            Slope 30Y−10Y
          </div>
          <div
            className="text-[11px] font-mono font-bold leading-none mt-1 tabular-nums"
            style={{ color: getYieldColor(realYield30) }}
          >
            {realSlope !== null
              ? `${realSlope > 0 ? "+" : ""}${realSlope.toFixed(2)}%`
              : "—"}
          </div>
        </div>
        <span className="text-[8px] font-mono text-text-muted text-right leading-tight shrink-0">
          {regime10}
          <br />
          <span className="text-text-muted/70">breakeven {inf.toFixed(2)}%</span>
        </span>
      </div>
    </div>
  );
}

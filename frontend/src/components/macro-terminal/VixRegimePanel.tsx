"use client";

import React, { useState, useEffect } from "react";
import { Activity, AlertOctagon } from "lucide-react";

interface QuantData {
  vix: number | null;
  regime: string;
}

interface QuantResponse {
  data: QuantData;
  fetchedAt: string;
}

function SkeletonPulse() {
  return <div className="w-full h-full bg-surface-elevated animate-pulse rounded-md" />;
}

export function VixRegimePanel() {
  const [resp, setResp] = useState<QuantResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/v1/quant/snapshot");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setResp(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const data = resp?.data;
  const vix = data?.vix ?? 0;
  const regime = data?.regime ?? "UNKNOWN";

  // VIX Color Logic
  let vixColor = "#22c55e"; // Green (<15)
  let vixLabel = "CALM (Risk-On)";
  let pctFill = 0;

  if (vix >= 30) {
    vixColor = "#ef4444"; // Red
    vixLabel = "FEAR (Crash/Deflation)";
    pctFill = 100;
  } else if (vix >= 20) {
    vixColor = "#f97316"; // Orange
    vixLabel = "ELEVATED (Stress)";
    pctFill = ((vix - 10) / 30) * 100;
  } else if (vix >= 15) {
    vixColor = "#f59e0b"; // Yellow
    vixLabel = "NORMAL (Rising)";
    pctFill = ((vix - 10) / 30) * 100;
  } else if (vix > 0) {
    pctFill = ((vix - 10) / 30) * 100; // start chart at 10
  }

  // Cap pctFill
  pctFill = Math.max(0, Math.min(100, pctFill));

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-bg-void p-4">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <AlertOctagon className="w-4 h-4 text-accent-gold" />
        <span className="text-xs font-mono font-bold text-text-primary tracking-widest uppercase">
          Volatility Regime
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center min-h-0">
        {loading && !data ? (
          <div className="w-32 h-32"><SkeletonPulse /></div>
        ) : (
          <>
            {/* VIX Big Number */}
            <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-4 shadow-lg mb-4"
                 style={{ borderColor: vixColor + "40", backgroundColor: vixColor + "05" }}>
              <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin-slow"
                   style={{ borderRightColor: vixColor, borderBottomColor: vixColor, borderLeftColor: "transparent" }} />
              
              <div className="text-center">
                <span className="text-4xl font-bold font-mono" style={{ color: vixColor }}>
                  {vix ? vix.toFixed(1) : "—"}
                </span>
                <span className="block text-[10px] text-text-muted font-mono mt-1">VIX INDEX</span>
              </div>
            </div>

            {/* Labels */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold font-mono tracking-wide" style={{ color: vixColor }}>
                {vixLabel}
              </h3>
              <p className="text-xs text-text-muted font-mono mt-1">
                Mapped Regime: <span className="text-text-primary font-bold">{regime}</span>
              </p>
            </div>

            {/* Gradient Bar */}
            <div className="w-full max-w-[200px] h-2 bg-surface-elevated rounded-full overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${pctFill}%`, 
                  background: `linear-gradient(90deg, #22c55e 0%, #f59e0b 50%, #ef4444 100%)` 
                }}
              />
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_5px_white] transition-all duration-1000 ease-out"
                style={{ left: `calc(${pctFill}% - 2px)` }}
              />
            </div>
            
            <div className="w-full max-w-[200px] flex justify-between text-[9px] text-text-muted font-mono mt-1 px-1">
              <span>10</span>
              <span>15</span>
              <span>20</span>
              <span>30+</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

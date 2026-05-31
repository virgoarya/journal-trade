"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { calculateInflationMomentum } from "@/lib/macro/calculations";

type RegimeCardData = {
  id: string;
  title: string;
  growth: string;
  inflation: string;
  assets: string;
};

const regimeCards: RegimeCardData[] = [
  { id: "stagflation", title: "Stagflation", growth: "Low", inflation: "High", assets: "Gold, Cmdty, CHF" },
  { id: "goldilocks", title: "Goldilocks", growth: "High", inflation: "Optimal", assets: "Tech, Crypto, HY" },
  { id: "deflation", title: "Deflation", growth: "Low", inflation: "Low", assets: "Bonds, USD, JPY" },
  { id: "reflation", title: "Reflation", growth: "High", inflation: "Rising", assets: "Value, Ind, EM" },
  { id: "slowdown", title: "Slowdown", growth: "Low", inflation: "Low", assets: "Bonds, Defensive, USD" },
  { id: "neutral transition", title: "Netral", growth: "Netral", inflation: "Netral", assets: "Campuran" },
];

type State = "idle" | "loading" | "ready" | "error";

export function MacroRegimePanel() {
  const [activeRegime, setActiveRegime] = useState<string>("");
  const [inflationMomentum, setInflationMomentum] = useState<number>(0);
  const [state, setState] = useState<State>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const fetchMacroData = useCallback(async () => {
    setState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/macro", {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Gagal memuat data makro (HTTP ${response.status})`);
      }

      const result = (await response.json()) as {
        success?: boolean;
        regime?: string;
        cpiMoM?: number[];
        error?: string;
      };

      if (!result.success) {
        throw new Error(result.error || "Respons data makro tidak valid");
      }

      if (result.regime) {
        setActiveRegime(result.regime.toLowerCase());
      }

      if (Array.isArray(result.cpiMoM) && result.cpiMoM.length > 0) {
        setInflationMomentum(calculateInflationMomentum(result.cpiMoM));
      }

      setState("ready");
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan tak terduga");
    }
  }, []);

  useEffect(() => {
    fetchMacroData();
    const interval = setInterval(fetchMacroData, 60000);
    return () => clearInterval(interval);
  }, [fetchMacroData]);

  const activeRegimeCard = useMemo(() => regimeCards.find((card) => card.id.toLowerCase() === activeRegime.toLowerCase()), [activeRegime]);

  return (
    <div className="flex h-full max-h-[260px] flex-col glass border border-border-subtle rounded-xl bg-bg-void">
      <div className="flex items-center justify-between border-b border-border-subtle p-2">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">Macro Regime Matrix</h2>
        <div className="flex items-center gap-2">
          {state === "ready" && <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-1.5 py-0.5 rounded animate-pulse">LIVE</span>}
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              state === "error" ? "bg-data-loss" : state === "loading" ? "bg-data-warning animate-pulse" : "bg-data-profit animate-pulse"
            }`}
            aria-hidden
          />
        </div>
      </div>

      {state === "loading" ? (
        <div className="flex flex-1 items-center justify-center p-2">
          <span className="text-text-muted text-xs">Loading...</span>
        </div>
      ) : state === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-3">
          <span className="text-data-loss text-xs font-mono">{errorMessage}</span>
          <button
            type="button"
            onClick={fetchMacroData}
            className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-white/5 px-3 py-1.5 text-[10px] font-mono text-accent-gold transition-colors hover:border-accent-gold hover:bg-accent-gold/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 grid-rows-3 gap-1.5 p-2">
          {regimeCards.map((card) => {
            const isActive = card.id.toLowerCase() === activeRegime.toLowerCase();
            return (
              <div
                key={card.id}
                className={`flex flex-col items-center justify-center rounded border p-1.5 transition-all duration-300 ${
                  isActive ? "border-data-profit bg-surface-elevated ring-1 ring-data-profit/30" : "border-border-subtle bg-surface-elevated"
                } ${isActive ? "opacity-100" : "opacity-30"}`}
              >
                <span className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${isActive ? "text-text-primary" : "text-text-secondary"}`}>{card.title}</span>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className={`text-[10px] ${isActive ? "text-text-primary" : "text-text-secondary"}`}>G:{card.growth}</span>
                  <span className={`text-[10px] ${isActive ? "text-text-primary" : "text-text-secondary"}`}>I:{card.inflation}</span>
                </div>
                <span className={`mt-0.5 truncate text-[9px] font-medium ${isActive ? "text-text-secondary" : "text-text-muted"}`}>{card.assets}</span>
              </div>
            );
          })}
        </div>
      )}

      {state === "ready" && activeRegimeCard && (
        <div className="border-t border-border-subtle px-2 py-1.5">
          <span className="text-text-secondary text-[10px] font-mono">{activeRegimeCard.title} regime aktif • Momentum inflasi {inflationMomentum >= 0 ? "cepat" : "melambat"}</span>
        </div>
      )}
    </div>
  );
}

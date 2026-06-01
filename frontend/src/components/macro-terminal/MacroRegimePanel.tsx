import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { calculateInflationMomentum } from "@/lib/macro/calculations";
import { useMacroTerminal } from "./MacroTerminalContext";

type RegimeCardData = {
  id: string;
  title: string;
  growth: string;
  inflation: string;
  assets: string;
};

const regimeCards: RegimeCardData[] = [
  { id: "stagflation", title: "Stagflation", growth: "Low", inflation: "High", assets: "Gold, Cmdty, CHF" },
  { id: "goldilocks", title: "Goldilocks", growth: "High", inflation: "Low", assets: "Tech, Crypto, HY" },
  { id: "deflation", title: "Deflation", growth: "Low", inflation: "Low", assets: "Bonds, USD, JPY" },
  { id: "reflation", title: "Reflation", growth: "High", inflation: "Rising", assets: "Value, Ind, EM" },
];

type State = "idle" | "loading" | "ready" | "error";
const RATE_LIMIT_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;

export function MacroRegimePanel() {
  const { currentRegime, lastRegime, systemAlert } = useMacroTerminal();
  const [inflationMomentum, setInflationMomentum] = useState<number>(0);
  const [state, setState] = useState<State>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [nextAllowedAt, setNextAllowedAt] = useState<number>(0);
  const [backoffMs, setBackoffMs] = useState<number>(0);
  const lastSuccessRef = useRef<number>(0);
  const lastRegimeRef = useRef<string | null>(null);

  const activeRegime = useMemo(() => {
    const fromContext = (currentRegime || lastRegime || "").toLowerCase();
    if (fromContext) return fromContext;
    return "";
  }, [currentRegime, lastRegime]);

  const fetchMacroData = useCallback(async () => {
    const now = Date.now();
    if (now < nextAllowedAt) {
      return;
    }

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
        // Let context drive the regime; we just mirror here for local consistency
        lastRegimeRef.current = result.regime.toLowerCase();
      }

      if (Array.isArray(result.cpiMoM) && result.cpiMoM.length > 0) {
        setInflationMomentum(calculateInflationMomentum(result.cpiMoM));
      }

      lastSuccessRef.current = now;
      setNextAllowedAt(0);
      setBackoffMs(0);
      setState("ready");
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan tak terduga");
      const nextDelay = Math.min(RATE_LIMIT_MS + backoffMs, MAX_BACKOFF_MS);
      setNextAllowedAt(now + nextDelay);
      setBackoffMs((prev) => Math.min(prev + RATE_LIMIT_MS, MAX_BACKOFF_MS));
    }
  }, [nextAllowedAt, backoffMs]);

  useEffect(() => {
    if (!currentRegime) return;
    const next = currentRegime.toLowerCase();
    if (next !== lastRegimeRef.current) {
      lastRegimeRef.current = next;
      setActiveRegime(next);
    }
  }, [currentRegime]);
  useEffect(() => {
    if (!systemAlert) return;
    const normalized = systemAlert.toLowerCase();
    const match = normalized.match(/transitioned from\s+[a-z]+\s+to\s+([a-z]+)/);
    if (match && match[1]) {
      const next = match[1].trim();
      if (next !== lastRegimeRef.current) {
        lastRegimeRef.current = next;
        setActiveRegime(next);
      }
    }
  }, [systemAlert]);

  useEffect(() => {
    if (!systemAlert) return;
    const normalized = systemAlert.toLowerCase();
    const match = normalized.match(/regime shift detected[\s\S]*?([a-z]+)\s+>>>\s+([a-z]+)/);
    if (!match) return;
    const next = match[2].trim();
    if (next && next !== lastRegimeRef.current) {
      lastRegimeRef.current = next;
    }
  }, [systemAlert]);
  useEffect(() => {
    fetchMacroData();
    const scheduleNext = () => {
      const now = Date.now();
      const waitMs = Math.max(0, nextAllowedAt - now, RATE_LIMIT_MS);
      return setTimeout(() => {
        fetchMacroData();
      }, waitMs);
    };

    let timer: number | NodeJS.Timeout = scheduleNext();
    const id = setInterval(() => {
      timer = scheduleNext();
    }, RATE_LIMIT_MS);

    return () => {
      clearInterval(id);
      clearTimeout(timer);
    };
  }, [fetchMacroData, nextAllowedAt]);

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

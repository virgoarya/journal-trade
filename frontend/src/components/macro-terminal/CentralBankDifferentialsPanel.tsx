"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle, Landmark } from "lucide-react";

interface DifferentialData {
  code: string;
  currencyPair: string;
  centralBank: string;
  policyRateDiff: number;
  yieldCurveFlat: boolean;
  lastUpdate: string;
}

interface DifferentialsResponse {
  success: boolean;
  data: DifferentialData[];
  error?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

interface CentralBankDifferentialsPanelProps {
  className?: string;
}

export function CentralBankDifferentialsPanel({ className }: CentralBankDifferentialsPanelProps) {
  const [differentials, setDifferentials] = useState<DifferentialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/v1/central-bank-differentials", {
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DifferentialsResponse = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal fetch data");
      setDifferentials(json.data);
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
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const lastUpdated = differentials.length > 0
    ? new Date(differentials[0].lastUpdate).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className={`flex flex-col h-full w-full glass overflow-hidden relative p-4 ${className || ""}`}>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-accent-gold" />
          <div>
            <h3 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs">
              FX Central Bank Differentials
            </h3>
            {lastUpdated && (
              <span className="text-[9px] font-mono text-text-muted mt-1">
                Last Updated: {lastUpdated}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={forceRefresh}
          disabled={loading || refreshing}
          title="Refresh data"
          className="p-1.5 rounded-md border border-border-subtle text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-colors disabled:opacity-40 shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading || refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {error && !loading && (
        <div className="text-xs font-mono text-data-loss bg-data-loss/10 border border-data-loss/20 rounded px-2 py-1 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}

      {loading && differentials.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <span className="text-xs font-mono text-text-muted animate-pulse">
            Loading differentials...
          </span>
        </div>
      ) : differentials.length > 0 ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-text-muted uppercase text-[9px] border-b border-border-subtle">
                <th className="py-2">Pair</th>
                <th className="py-2">Central Banks</th>
                <th className="py-2 text-right">Rate Diff</th>
                <th className="py-2 text-center">Curve</th>
              </tr>
            </thead>
            <tbody>
              {differentials.map((diff) => (
                <tr key={diff.code} className="border-b border-border-subtle/50 last:border-b-0">
                  <td className="py-2 font-bold text-text-primary">{diff.currencyPair}</td>
                  <td className="py-2 text-text-muted text-[10px]">{diff.centralBank}</td>
                  <td
                                      className={`${diff.policyRateDiff > 0 ? "text-data-profit" : "text-data-loss"} py-2 text-right font-bold`}
                                    >
                    {diff.policyRateDiff.toFixed(2)}%
                  </td>
                  <td className="py-2 text-center">
                    {diff.yieldCurveFlat ? (
                      <span className="text-text-muted text-[10px] px-1.5 py-0.5 rounded border border-border-subtle bg-surface-elevated/50">
                        FLAT
                      </span>
                    ) : (
                      <span className="text-data-profit text-[10px] px-1.5 py-0.5 rounded border border-data-profit/40 bg-data-profit/10">
                        NORMAL
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">
          No differentials data available.
        </div>
      )}
    </div>
  );
}

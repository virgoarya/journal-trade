"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";

interface TradingDisabledBannerProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function TradingDisabledBanner({ onRetry, isRetrying }: TradingDisabledBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Re-appear on mount (new page load) — sessionStorage not needed since
  // the banner is conditionally rendered by parent based on connectionStatus.
  // Parent only renders this when status === "trading_disabled", so
  // dismissal is per-render-cycle. If status flips back to connected and
  // then to trading_disabled again, the component remounts and banner re-appears.

  if (isDismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-300 mb-1">
            Broker menolak order — Algo Trading tidak aktif di MT5
          </h3>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            Aktifkan ikon robot (Algo Trading) di toolbar MT5, lalu coba lagi.
            Pipeline otomatis resume setelah broker siap.
          </p>
          <div className="flex items-center gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Mengecek..." : "Coba Lagi"}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="flex-shrink-0 p-1 rounded-md text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10 transition"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

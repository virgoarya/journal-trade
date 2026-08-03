"use client";

import React, { useEffect, useState } from "react";
import { DownloadCloud, CheckCircle2, RefreshCw, X } from "lucide-react";

interface UpdateStatus {
  status: "idle" | "checking" | "available" | "not-available" | "downloaded" | "error";
  version?: string;
  releaseNotes?: string;
  message?: string;
}

interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

declare global {
  interface Window {
    hunterTrades?: {
      platform?: string;
      isDesktopApp?: boolean;
      updater?: {
        checkNow: () => Promise<any>;
        quitAndInstall: () => void;
        onStatus: (cb: (status: UpdateStatus) => void) => () => void;
        onProgress: (cb: (progress: UpdateProgress) => void) => () => void;
      };
    };
  }
}

export function UpdateNotification() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: "idle" });
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const desktopApi = window.hunterTrades;
    if (desktopApi?.isDesktopApp && desktopApi?.updater) {
      setIsDesktop(true);

      const unsubStatus = desktopApi.updater.onStatus((data) => {
        console.log("[UPDATER UI] Status received:", data);
        setUpdateStatus(data);
        if (data.status === "available" || data.status === "downloaded") {
          setDismissed(false);
        }
      });

      const unsubProgress = desktopApi.updater.onProgress((data) => {
        setProgress(data);
      });

      return () => {
        unsubStatus();
        unsubProgress();
      };
    }
  }, []);

  if (!isDesktop || dismissed) return null;

  // Only show when update is available, downloading, or downloaded
  if (
    updateStatus.status !== "available" &&
    updateStatus.status !== "downloaded" &&
    !progress
  ) {
    return null;
  }

  const isDownloaded = updateStatus.status === "downloaded";

  const handleInstallNow = () => {
    if (window.hunterTrades?.updater?.quitAndInstall) {
      window.hunterTrades.updater.quitAndInstall();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="relative overflow-hidden rounded-xl border border-accent-gold/40 bg-bg-surface/95 backdrop-blur-xl p-5 shadow-[0_10px_35px_rgba(212,175,55,0.15)] text-text-primary">
        {/* Glow ambient accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/15 rounded-full blur-2xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent-gold/10 border border-accent-gold/30 text-accent-gold">
              {isDownloaded ? (
                <CheckCircle2 className="w-5 h-5 text-accent-gold animate-pulse" />
              ) : (
                <DownloadCloud className="w-5 h-5 text-accent-gold animate-bounce" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white tracking-wide">
                  {isDownloaded ? "Pembaruan Siap Dipasang" : "Pembaruan Baru Tersedia"}
                </h4>
                {updateStatus.version && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-accent-gold/20 text-accent-gold border border-accent-gold/30">
                    v{updateStatus.version}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                {isDownloaded
                  ? "Pembaruan telah diunduh. Pasang sekarang tanpa perlu install ulang."
                  : "Sedang mengunduh pembaruan di latar belakang..."}
              </p>
            </div>
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="text-text-muted hover:text-text-primary p-1 rounded-md transition-colors"
            title="Sembunyikan notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Download Progress Bar */}
        {!isDownloaded && progress && (
          <div className="my-3 space-y-1.5">
            <div className="flex justify-between text-[11px] text-text-secondary font-mono">
              <span>Mengunduh patch</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="w-full bg-bg-void/80 rounded-full h-2 overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-accent-gold/70 via-accent-gold to-yellow-300 transition-all duration-300 shadow-[0_0_10px_rgba(212,175,55,0.6)]"
                style={{ width: `${Math.max(5, progress.percent)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-4 flex items-center justify-end gap-2.5">
          <button
            onClick={() => setDismissed(true)}
            className="px-3.5 py-1.5 text-xs font-medium text-text-secondary hover:text-white transition-colors"
          >
            Nanti Saja
          </button>

          {isDownloaded ? (
            <button
              onClick={handleInstallNow}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-bg-void bg-accent-gold hover:bg-accent-gold/90 transition-all rounded-lg shadow-[0_0_15px_rgba(212,175,55,0.4)] active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restart & Perbarui
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-accent-gold/80 bg-accent-gold/10 rounded-lg border border-accent-gold/20">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Mengunduh...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function OtaUpdaterModal() {
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    releaseNotes: string;
    patchUrl: string;
    progress?: number;
    message?: string;
  } | null>(null);

  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).hunterTrades) return;

    const cleanup = (window as any).hunterTrades.updater.onStatus((data: any) => {
      if (data.status === "downloaded" && data.version) {
        setUpdateInfo({
          version: data.version,
          releaseNotes: data.releaseNotes || "A new patch update is available.",
          patchUrl: data.patchUrl,
        });
      } else if (data.status === "downloading") {
        // Update progress during download
        setUpdateInfo(prev => ({
          ...prev,
          version: data.version || updateInfo?.version,
          progress: data.progress,
          message: data.message || `Mendownload patch... ${data.progress}%`,
        }));
      } else if (data.status === "error") {
        setIsUpdating(false);
        toast.error(data.message || "Gagal menerapkan update.");
      }
    });

    return () => {
      cleanup();
    };
  }, []);

  if (!updateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-panel rounded-2xl border border-surface/50 shadow-2xl p-6 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 rounded-full bg-accent-gold/20 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-4xl text-accent-gold animate-bounce">
            system_update
          </span>
        </div>
        
        <h2 className="text-2xl font-semibold text-text-primary mb-2">
          Update Patch Available
        </h2>
        
        <div className="bg-surface/30 px-3 py-1 rounded-full text-accent-gold text-sm font-medium mb-4">
          Versi Terbaru: v{updateInfo.version}
        </div>
        
        <p className="text-text-secondary text-sm mb-6 max-w-[280px]">
          {updateInfo.releaseNotes}
        </p>

        {isUpdating ? (
          <div className="w-full flex flex-col items-center">
            <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-accent-gold transition-all duration-300" 
                style={{ width: `${updateInfo?.progress || 0}%` }}
              />
            </div>
            <span className="text-xs text-text-muted">
              {updateInfo?.message || "Mendownload & Menerapkan Patch..."}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={() => setUpdateInfo(null)}
              className="flex-1 py-2.5 rounded-xl border border-surface text-text-secondary hover:bg-surface/50 hover:text-text-primary transition-colors text-sm font-medium"
            >
              Nanti Saja
            </button>
            <button
              onClick={() => {
                setIsUpdating(true);
                (window as any).hunterTrades.updater.quitAndInstall();
              }}
              className="flex-1 py-2.5 rounded-xl bg-accent-gold text-panel hover:brightness-110 shadow-lg shadow-accent-gold/20 transition-all text-sm font-medium"
            >
              Update & Restart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

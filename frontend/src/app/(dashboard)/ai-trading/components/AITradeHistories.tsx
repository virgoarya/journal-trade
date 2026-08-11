"use client";

import { useState, useEffect, useCallback } from "react";
import { aiTradingService, type PipelinePerformance as PipelinePerformanceData } from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { Terminal, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export function AITradeHistories({ triggerRefresh }: { triggerRefresh?: number }) {
  const [data, setData] = useState<PipelinePerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!data) setLoading(true);
    try {
      const res = await aiTradingService.getPerformance();
      if (res.success && res.data) setData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    fetch();
  }, [triggerRefresh]);

  if (loading) {
    return <SkeletonLoader type="card" />;
  }

  const trades = (data?.recentTrades || []).filter((t: any) => (t?.pnl ?? 0) !== 0);

  return (
    <div className="glass p-5 space-y-3 h-full flex flex-col max-h-[600px]">
      <h4 className="text-[10px] font-semibold text-accent-gold/70 uppercase tracking-widest border-b border-accent-gold/20 pb-2 mb-2 flex items-center gap-2">
        <Terminal className="w-3.5 h-3.5" />
        AI Trade Histories
      </h4>
      
      {trades.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted text-xs font-mono">
          <p>No AI trades recorded yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
          {trades.map((t: any, idx: number) => {
            const pnlColor = t.pnl >= 0 ? "text-neon-green" : "text-neon-red";
            const dirColor = t.signal?.direction === "BUY" ? "text-blue-400 bg-blue-900/30" : "text-red-400 bg-red-900/30";
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={t._id || idx} 
                className="bg-black/40 border border-border-subtle/50 rounded-lg p-3 text-xs font-mono hover:border-accent-gold/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${dirColor}`}>
                      {t.signal?.direction}
                    </span>
                    <span className="text-gray-200 font-bold">{t.signal?.symbol}</span>
                    <span className="text-text-muted text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                      {t.signal?.primaryMethodology?.toUpperCase() || "AI"}
                    </span>
                  </div>
                  <div className={`font-bold ${pnlColor}`}>
                    {t.pnl >= 0 ? "+" : ""}${t.pnl?.toFixed(2)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                  <div>
                    <span className="text-text-muted">Entry:</span> <span className="text-gray-300">{t.signal?.entry?.toFixed(5)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-text-muted">Exit:</span> <span className="text-gray-300">{t.closePrice?.toFixed(5)}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Time:</span> <span className="text-gray-400">{new Date(t.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-text-muted">Conf:</span> <span className="text-accent-gold">{t.signal?.confidence}%</span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-border-subtle/50 text-[10px] text-gray-400 flex gap-2 items-start leading-relaxed">
                   <ChevronRight className="w-3 h-3 text-accent-gold mt-0.5 shrink-0" />
                   <span>{t.signal?.reason || t.closeReason || "AI execution completed"}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

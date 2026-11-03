"use client";

import { useState, useCallback, useEffect } from "react";
import { BacktestForm } from "./BacktestForm";
import { BacktestResult } from "./BacktestResult";
import { BacktestStreamView } from "./BacktestStreamView";
import {
  backtestService,
  type BacktestConfig,
  type BacktestResult as BacktestResultData,
  type BacktestAnalysis,
} from "@/services/backtest.service";
import { History, Settings2, X, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useAiTrading } from "../context/AiTradingContext";

interface BacktestTabProps {
  onBacktestComplete?: () => void;
  onApplyToPipeline?: () => void;
}

export function BacktestTab({ onBacktestComplete, onApplyToPipeline }: BacktestTabProps = {}) {
  const { refreshSettings } = useAiTrading();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<BacktestConfig | null>(null);
  const [result, setResult] = useState<BacktestResultData | null>(null);
  const [analysis, setAnalysis] = useState<BacktestAnalysis | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isBacktestDrawerOpen, setIsBacktestDrawerOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastBacktestId, setLastBacktestId] = useState<string | null>(null);

  // Load the most recent backtest result on initial mount
  useEffect(() => {
    const fetchLatestResult = async () => {
      try {
        const res = await backtestService.getHistory(1);
        if (res.success && res.data && res.data.experiences.length > 0) {
          const latestExp = res.data.experiences[0];
          setResult(latestExp.result as any);
          setLastBacktestId(latestExp.id);
          if ((latestExp as any).aiAnalysis) {
            setAnalysis((latestExp as any).aiAnalysis);
          } else if (latestExp.id) {
            // Optimistically try to fetch its analysis if it exists but wasn't populated directly
            const analysisRes = await backtestService.analyze(latestExp.id);
            if (analysisRes.success && analysisRes.data) {
              setAnalysis(analysisRes.data);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch latest backtest:", err);
      } finally {
        setIsInitialLoad(false);
      }
    };
    fetchLatestResult();
  }, []);

  const handleRun = useCallback(async (config: BacktestConfig) => {
    setResult(null);
    setAnalysis(null);
    setCurrentConfig(config);
    setIsStreaming(true);
  }, []);

  const handleStreamComplete = useCallback(async (btResult: BacktestResultData) => {
    if (isStreaming) {
      setResult(btResult);
      setIsStreaming(false);
      const totalTradesCount = btResult.totalTrades ?? 0;
      const pnlPct = btResult.totalPnLPercent ?? 0;
      toast.success(
        `Backtest complete: ${totalTradesCount} trades, ${pnlPct >= 0 ? "+" : ""}${pnlPct}%`,
      );

      // Auto AI analysis
      if (btResult.backtestId) {
        setLastBacktestId(btResult.backtestId);
        setIsAnalyzing(true);
        try {
          const analysisRes = await backtestService.analyze(btResult.backtestId);
          if (analysisRes.success && analysisRes.data) {
            setAnalysis(analysisRes.data);
          }
        } catch {
          // optional
        } finally {
          setIsAnalyzing(false);
        }
      }

      // Notify parent to refresh SkillDisplay (methodology verdicts)
      onBacktestComplete?.();
    }
  }, [onBacktestComplete, isStreaming]);

  const handleStreamError = useCallback((error: string) => {
    setIsStreaming(false);
    toast.error(error || "Backtest streaming failed");
  }, []);

  const handleAnalyze = useCallback(async () => {
    const btId = result?.backtestId ?? lastBacktestId;
    if (!btId) {
      toast.error("No backtest ID available");
      return;
    }
    setIsAnalyzing(true);
    try {
      const analysisRes = await backtestService.analyze(btId);
      if (analysisRes.success && analysisRes.data) {
        setAnalysis(analysisRes.data);
      } else {
        toast.error(analysisRes.error || "Analysis failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Analysis error");
    } finally {
      setIsAnalyzing(false);
    }
  }, [result, lastBacktestId]);

  const handleApplyToPipeline = useCallback(async () => {
    const btId = result?.backtestId ?? lastBacktestId;
    if (!btId) {
      toast.error("No backtest ID. Run a backtest first.");
      return;
    }
    setIsApplying(true);
    try {
      const applyRes = await backtestService.applyToLivePipeline(btId);
      if (applyRes.success) {
        toast.success("Backtest parameters applied to live pipeline!");
        setAnalysis(null);
        await refreshSettings();
        onApplyToPipeline?.();
      } else {
        toast.error(applyRes.error || "Failed to apply");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to apply");
    } finally {
      setIsApplying(false);
    }
  }, [result, lastBacktestId, refreshSettings]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await backtestService.getHistory(50);
      if (res.success && res.data) {
        setHistoryItems(res.data.experiences);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleShowHistory = () => {
    setShowHistory(!showHistory);
    if (!showHistory && historyItems.length === 0) {
      loadHistory();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Test and optimize your trading strategies on historical data</p>
        <button
          onClick={handleShowHistory}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-input hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition"
        >
          <History className="w-3.5 h-3.5" />
          History
        </button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="bg-black/40 border border-accent-gold/10 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary tracking-wider uppercase font-mono">Backtest History</h3>
            <button onClick={loadHistory} className="text-[10px] text-accent-gold hover:text-yellow-400 font-mono uppercase">Refresh</button>
          </div>
          {loadingHistory ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-black/60 rounded-lg animate-pulse" />)}
            </div>
          ) : historyItems.length === 0 ? (
            <p className="text-xs text-text-muted font-mono italic">No backtests recorded yet.</p>
          ) : (
            <div className="grid gap-2 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-accent-gold/20">
              {historyItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between bg-black/30 hover:bg-black/50 border border-accent-gold/5 hover:border-accent-gold/20 rounded-lg px-4 py-3 text-xs transition cursor-pointer">
                  <div className="flex items-center gap-4">
                    <span className="text-text-primary font-bold font-mono">{item.symbol}</span>
                    <span className="text-text-muted font-mono">{item.timeframe}</span>
                    <span className="text-text-muted/60 font-mono text-[10px]">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className={`font-bold font-mono ${item.result?.totalPnLPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {item.result?.totalPnLPercent >= 0 ? "+" : ""}{item.result?.totalPnLPercent ?? 0}%
                    </span>
                    <span className="text-text-muted font-mono">{item.result?.winRate ?? 0}% WR</span>
                    {item.hasAiAnalysis && <span className="text-[9px] px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded-sm font-bold">AI</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Layout matching AI Trading */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Left: Main Content (Stream / Results) */}
        <div className={`space-y-4 ${isStreaming ? 'md:col-span-2 xl:col-span-4' : 'md:col-span-2 xl:col-span-3'}`}>
          {isStreaming && currentConfig ? (
            <BacktestStreamView
              config={currentConfig}
              onComplete={handleStreamComplete}
              onError={handleStreamError}
              onCancel={() => setIsStreaming(false)}
            />
          ) : result ? (
            <BacktestResult
              result={result}
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              onAnalyze={handleAnalyze}
              onApplyToPipeline={handleApplyToPipeline}
              isApplying={isApplying}
            />
          ) : (
            <div className="bg-black/20 border border-accent-gold/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center border border-accent-gold/10">
                <BarChart3 className="w-8 h-8 text-accent-gold/30" />
              </div>
              <div className="space-y-1">
                <p className="text-text-primary font-mono text-sm tracking-wide">Ready for Analysis</p>
                <p className="text-text-muted text-xs max-w-[240px]">Configure your strategy parameters in the sidebar and run a backtest to see live performance analytics.</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Mobile Settings Button for Backtest */}
        {!isStreaming && (
          <button 
            onClick={() => setIsBacktestDrawerOpen(true)}
            className="xl:hidden fixed bottom-6 right-6 z-40 bg-accent-gold text-black p-4 rounded-full shadow-lg shadow-accent-gold/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center touch-target"
          >
            <Settings2 className="w-6 h-6" />
          </button>
        )}

        {/* Right: Sidebar Form (Mobile Drawer + Desktop Sidebar) */}
        {!isStreaming && (
          <div className={`
            transition-all duration-300
            ${isBacktestDrawerOpen 
              ? 'fixed inset-0 z-50 flex flex-col bg-black/95 xl:static xl:z-auto xl:bg-transparent xl:block' 
              : 'hidden xl:block'
            }
          `}>
            {/* Mobile Header (Close Button) */}
            {isBacktestDrawerOpen && (
              <div className="flex-none p-4 border-b border-accent-gold/20 flex justify-between items-center bg-black/95 xl:hidden z-[60]">
                <span className="text-accent-gold font-bold tracking-widest uppercase text-sm font-mono">Backtest Config</span>
                <button 
                  onClick={() => setIsBacktestDrawerOpen(false)}
                  className="text-gray-400 hover:text-white bg-gray-800 rounded-full p-2 flex items-center justify-center active:scale-95 transition-all"
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className={`
              ${isBacktestDrawerOpen ? 'flex-1 overflow-y-auto p-4 xl:p-0 xl:overflow-visible' : ''}
            `}>
              <BacktestForm 
                onRun={(config) => {
                  handleRun(config);
                  if (isBacktestDrawerOpen) setIsBacktestDrawerOpen(false);
                }} 
                isRunning={isStreaming} 
              />
            </div>

            {/* Mobile Footer (Close Button Backup) */}
            {isBacktestDrawerOpen && (
              <div className="flex-none p-4 pb-8 bg-black border-t border-accent-gold/20 xl:hidden z-[60]">
                <button 
                  onClick={() => setIsBacktestDrawerOpen(false)}
                  className="w-full py-3 bg-red-900/40 hover:bg-red-800/60 text-red-100 rounded-xl border border-red-500/30 flex items-center justify-center gap-2 font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(255,0,0,0.2)]"
                >
                  <X className="w-5 h-5" />
                  Tutup Konfigurasi
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

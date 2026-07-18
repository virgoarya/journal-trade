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
}

export function BacktestTab({ onBacktestComplete }: BacktestTabProps = {}) {
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

  // Load the most recent backtest result on initial mount
  useEffect(() => {
    const fetchLatestResult = async () => {
      try {
        const res = await backtestService.getHistory(1);
        if (res.success && res.data && res.data.experiences.length > 0) {
          const latestExp = res.data.experiences[0];
          setResult(latestExp.result as any);
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
      toast.success(
        `Backtest complete: ${btResult.totalTrades} trades, ${btResult.totalPnLPercent >= 0 ? "+" : ""}${btResult.totalPnLPercent}%`,
      );

      // Auto AI analysis
      if (btResult.backtestId) {
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
    if (!result?.backtestId) {
      toast.error("No backtest ID available");
      return;
    }
    setIsAnalyzing(true);
    try {
      const analysisRes = await backtestService.analyze(result.backtestId);
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
  }, [result]);

  const handleApplyToPipeline = useCallback(async () => {
    const btId = result?.backtestId;
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
      } else {
        toast.error(applyRes.error || "Failed to apply");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to apply");
    } finally {
      setIsApplying(false);
    }
  }, [result, refreshSettings]);

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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Backtest History</h3>
          {loadingHistory ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-gray-500">No backtests yet</p>
          ) : (
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {historyItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between bg-bg-input/50 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{item.symbol}</span>
                    <span className="text-gray-500">{item.timeframe}</span>
                    <span className="text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={item.result?.totalPnLPercent >= 0 ? "text-green-400" : "text-red-400"}>
                      {item.result?.totalPnLPercent >= 0 ? "+" : ""}{item.result?.totalPnLPercent ?? 0}%
                    </span>
                    <span className="text-gray-500">{item.result?.winRate ?? 0}% WR</span>
                    {item.hasAiAnalysis && <span className="text-blue-400">AI</span>}
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
            <div className="relative">
              <div className="opacity-30 pointer-events-none grayscale blur-[1px]">
                <BacktestResult
                  result={{
                    totalTrades: 0,
                    winRate: 0,
                    totalPnL: 0,
                    totalPnLPercent: 0,
                    maxDrawdownPercent: 0,
                    profitFactor: 0,
                    recoveryFactor: 0,
                    averageWin: 0,
                    averageLoss: 0,
                    symbols: ['-'],
                    timeframe: '-',
                    totalCandles: 0,
                    winningTrades: 0,
                    losingTrades: 0,
                    symbolStats: [],
                    equityCurve: []
                  } as any}
                  analysis={null}
                  isAnalyzing={false}
                  onAnalyze={() => {}}
                  onApplyToPipeline={() => {}}
                  isApplying={false}
                />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
                <div className="bg-black/80 p-6 rounded-2xl border border-accent-gold/30 shadow-[0_0_30px_rgba(212,175,55,0.1)] backdrop-blur-md text-center max-w-sm">
                  <BarChart3 className="w-10 h-10 text-accent-gold/50 mx-auto mb-3" />
                  <p className="text-accent-gold font-mono text-sm tracking-wider uppercase drop-shadow-[0_0_4px_rgba(212,175,55,0.6)]">Waiting for Simulation</p>
                  <p className="text-text-muted text-[10px] mt-2">Configure parameters in the right panel and run the strategy tester to view results</p>
                </div>
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
            space-y-4 transition-all duration-300
            ${isBacktestDrawerOpen 
              ? 'fixed inset-0 z-50 bg-black/90 p-4 pt-16 overflow-y-auto block' 
              : 'hidden xl:block'
            }
          `}>
            {/* Mobile Close Button */}
            {isBacktestDrawerOpen && (
              <button 
                onClick={() => setIsBacktestDrawerOpen(false)}
                className="absolute top-4 right-4 text-text-muted hover:text-text-primary bg-bg-input rounded-full p-2 touch-target"
              >
                <X className="w-6 h-6" />
              </button>
            )}

            <BacktestForm 
              onRun={(config) => {
                handleRun(config);
                if (isBacktestDrawerOpen) setIsBacktestDrawerOpen(false);
              }} 
              isRunning={isStreaming} 
            />
          </div>
        )}

      </div>
    </div>
  );
}

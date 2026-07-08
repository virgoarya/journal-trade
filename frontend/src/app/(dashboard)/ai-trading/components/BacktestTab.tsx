"use client";

import { useState, useCallback } from "react";
import { BacktestForm } from "./BacktestForm";
import { BacktestResult } from "./BacktestResult";
import { BacktestStreamView } from "./BacktestStreamView";
import {
  backtestService,
  type BacktestConfig,
  type BacktestResult as BacktestResultData,
  type BacktestAnalysis,
} from "@/services/backtest.service";
import { History } from "lucide-react";
import { toast } from "sonner";

interface BacktestTabProps {
  onBacktestComplete?: () => void;
}

export function BacktestTab({ onBacktestComplete }: BacktestTabProps = {}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<BacktestConfig | null>(null);
  const [result, setResult] = useState<BacktestResultData | null>(null);
  const [analysis, setAnalysis] = useState<BacktestAnalysis | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleRun = useCallback(async (config: BacktestConfig) => {
    setResult(null);
    setAnalysis(null);
    setCurrentConfig(config);
    setIsStreaming(true);
  }, []);

  const handleStreamComplete = useCallback(async (btResult: BacktestResultData) => {
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
  }, [onBacktestComplete]);

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
      } else {
        toast.error(applyRes.error || "Failed to apply");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to apply");
    } finally {
      setIsApplying(false);
    }
  }, [result]);

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
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition"
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
                <div key={item.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
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

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Form */}
        {!isStreaming && (
          <div>
            <BacktestForm onRun={handleRun} isRunning={isStreaming} />
          </div>
        )}

        {/* Right: Content */}
        <div className={`${isStreaming ? "lg:col-span-3" : "lg:col-span-2"}`}>
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
            <div className="h-64 flex flex-col items-center justify-center border border-gray-800 border-dashed rounded-xl text-gray-500">
              <p>Configure parameters and run backtest to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

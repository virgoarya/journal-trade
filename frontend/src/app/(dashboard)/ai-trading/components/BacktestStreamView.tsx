"use client";

import { useEffect, useState, useRef } from "react";
import {
  type BacktestConfig,
  type BacktestResult as BacktestResultData,
  buildStreamUrl,
  type StreamProgress,
  type StreamCandle,
  type StreamTradeOpen,
  type StreamTradeClose,
} from "@/services/backtest.service";
import {
  Terminal, XCircle, Cpu, TrendingUp, TrendingDown,
  ArrowRight, Activity, Loader2, BarChart3, Layers, Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  config: BacktestConfig;
  onComplete: (result: BacktestResultData) => void;
  onError: (err: string) => void;
  onCancel: () => void;
}

type LogEntry = {
  id: string;
  time: string;
  type: "info" | "trade_open" | "trade_close" | "error";
  message: string;
  details?: any;
};

interface LiveSymbolStat {
  symbol: string;
  totalTrades: number;
  wins: number;
  losses: number;
  totalPnL: number;
}

export function BacktestStreamView({ config, onComplete, onError, onCancel }: Props) {
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [candle, setCandle] = useState<StreamCandle | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [liveSymbolStats, setLiveSymbolStats] = useState<LiveSymbolStat[]>([]);
  const symbolStatsRef = useRef<Map<string, LiveSymbolStat>>(new Map());
  const [liveMethStats, setLiveMethStats] = useState<Array<{ methodology: string; count: number; pnl: number }>>([]);
  const methStatsRef = useRef<Map<string, { count: number; pnl: number }>>(new Map());

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;

    const startStream = () => {
      try {
        const url = buildStreamUrl(config);
        eventSource = new EventSource(url, { withCredentials: true });

        const addLog = (type: LogEntry["type"], message: string, details?: any) => {
          if (!mounted) return;
          setLogs(prev => [...prev.slice(-49), {
            id: Math.random().toString(36).substr(2, 9),
            time: new Date().toLocaleTimeString([], { hour12: false }),
            type, message, details,
          }]);
        };

        addLog("info", `Initializing backtest for ${config.symbols?.join(", ") || config.symbols} (${config.timeframe})...`);
        addLog("info", `Loading historical data...`);

        eventSource.addEventListener("progress", (e: any) => {
          if (!mounted) return;
          try { setProgress(JSON.parse(e.data)); } catch {}
        });

        eventSource.addEventListener("equity", (e: any) => {
          if (!mounted) return;
          try {
            // equity event for chart — handled by the result on complete
          } catch {}
        });

        eventSource.addEventListener("candle", (e: any) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(e.data) as StreamCandle;
            setCandle(data);
          } catch {}
        });

        eventSource.addEventListener("trade_open", (e: any) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(e.data) as StreamTradeOpen & { symbol: string; primaryMethodology?: string };
            addLog("trade_open",
              `${data.direction} ${data.symbol} @ ${data.entryPrice.toFixed(5)}${data.primaryMethodology ? ` [${data.primaryMethodology}]` : ""}`,
              data,
            );

            // Track symbol stats
            const sym = data.symbol || "unknown";
            if (!symbolStatsRef.current.has(sym)) {
              symbolStatsRef.current.set(sym, { symbol: sym, totalTrades: 0, wins: 0, losses: 0, totalPnL: 0 });
            }
            symbolStatsRef.current.get(sym)!.totalTrades++;
            flushStats();

            // Track methodology stats
            const meth = data.primaryMethodology || "unknown";
            if (!methStatsRef.current.has(meth)) {
              methStatsRef.current.set(meth, { count: 0, pnl: 0 });
            }
            methStatsRef.current.get(meth)!.count++;
            flushMethStats();
          } catch {}
        });

        eventSource.addEventListener("trade_close", (e: any) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(e.data) as StreamTradeClose & { symbol: string; primaryMethodology?: string };
            const pnlPrefix = data.pnl >= 0 ? "+" : "";
            addLog("trade_close",
              `[${data.reason}] ${data.symbol} @ ${data.exitPrice.toFixed(5)} | PnL: ${pnlPrefix}${data.pnl.toFixed(2)} (${data.pnlPercent.toFixed(2)}%)`,
              data,
            );

            // Update symbol PnL
            const sym = data.symbol || "unknown";
            if (symbolStatsRef.current.has(sym)) {
              const s = symbolStatsRef.current.get(sym)!;
              if (data.pnl >= 0) s.wins++; else s.losses++;
              s.totalPnL += data.pnl;
              flushStats();
            }

            // Update methodology PnL
            const meth = data.primaryMethodology || "unknown";
            if (methStatsRef.current.has(meth)) {
              methStatsRef.current.get(meth)!.pnl += data.pnl;
              flushMethStats();
            }
          } catch {}
        });

        eventSource.addEventListener("complete", (e: any) => {
          if (!mounted) return;
          try {
            addLog("info", "Backtest complete. Generating report...");
            const data = JSON.parse(e.data) as BacktestResultData;
            if (eventSource) eventSource.close();
            setTimeout(() => { if (mounted) onComplete(data); }, 1500);
          } catch {}
        });

        eventSource.onerror = () => {
          if (!mounted) return;
          if (eventSource?.readyState !== EventSource.CLOSED) {
            addLog("error", `Connection interrupted.`);
            if (eventSource) eventSource.close();
            setTimeout(() => { if (mounted) onError("Connection lost"); }, 2000);
          }
        };

        eventSource.addEventListener("error", (e: any) => {
          if (!mounted) return;
          let msg = "Stream error";
          try { if (e.data) { const d = JSON.parse(e.data); msg = d.message || msg; } } catch {}
          addLog("error", `ERROR: ${msg}`);
          if (eventSource) eventSource.close();
          setTimeout(() => { if (mounted) onError(msg); }, 2000);
        });

      } catch (err: any) {
        if (mounted) onError(err.message || "Failed to establish stream");
      }
    };

    startStream();

    return () => {
      mounted = false;
      if (eventSource) eventSource.close();
    };
  }, [config, onComplete, onError]);

  const flushStats = () => {
    setLiveSymbolStats(
      Array.from(symbolStatsRef.current.values()).sort((a, b) => b.totalTrades - a.totalTrades),
    );
  };
  const flushMethStats = () => {
    setLiveMethStats(
      Array.from(methStatsRef.current.entries())
        .filter(([m]) => m !== "unknown")
        .map(([methodology, m]) => ({ methodology, count: m.count, pnl: Math.round(m.pnl * 100) / 100 }))
        .sort((a, b) => b.count - a.count),
    );
  };

  const progressPercent = progress ? progress.percent : 0;

  return (
    <div className="h-full min-h-[500px] flex flex-col bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(#d4af37 1px, transparent 1px), linear-gradient(90deg, #d4af37 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900/80 border-b border-gray-800 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-accent-gold animate-pulse" />
          <h3 className="text-sm font-bold text-white tracking-wider uppercase">AI Strategy Tester</h3>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 bg-gray-950 px-3 py-1 rounded-full border border-gray-800">
            <span className="text-accent-gold">{config.symbols?.join(",") || config.symbols}</span>
            <span>{config.timeframe}</span>
          </div>
        </div>
        <button onClick={onCancel} className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-red-400 transition-colors bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-red-900/50">
          <XCircle className="w-4 h-4" /> Stop
        </button>
      </div>

      {/* Main View */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10 p-4 gap-4 overflow-hidden">
        {/* Left Panel */}
        <div className="w-full lg:w-72 flex flex-col gap-4 overflow-y-auto">
          {/* Equity Card */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">Current Equity</p>
            <p className="text-2xl font-bold font-mono text-white">
              ${candle ? (candle.equity || 0).toFixed(2) : (config.initialBalance || 0).toFixed(2)}
            </p>
            {candle && (candle.floatingPnL || 0) !== 0 && (
              <div className={`flex items-center gap-1 text-sm mt-1 font-mono ${(candle.floatingPnL || 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                {(candle.floatingPnL || 0) > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {(candle.floatingPnL || 0) > 0 ? "+" : ""}{(candle.floatingPnL || 0).toFixed(2)}
              </div>
            )}
            {candle && candle.marginLevel > 0 && (
              <p className="text-[10px] text-gray-500 mt-1">Margin: {candle.marginLevel.toFixed(1)}%</p>
            )}
          </div>

          {/* Price Card */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Live Quote
            </p>
            <div className="space-y-1 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Close</span>
                <span className="text-accent-gold font-bold">{candle ? (candle.close || 0).toFixed(5) : "0.00000"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">High</span>
                <span className="text-gray-300">{candle ? (candle.high || 0).toFixed(5) : "0.00000"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Low</span>
                <span className="text-gray-300">{candle ? (candle.low || 0).toFixed(5) : "0.00000"}</span>
              </div>
            </div>
          </div>

          {/* RSI/ATR Card */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">Indicators</p>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">RSI(14)</span>
                <span className={`${candle && (candle.rsi || 0) > 70 ? "text-red-400" : candle && (candle.rsi || 0) < 30 ? "text-green-400" : "text-gray-300"}`}>
                  {candle ? (candle.rsi || 0).toFixed(1) : "0.0"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">ATR(14)</span>
                <span className="text-gray-300">{candle ? (candle.atr || 0).toFixed(5) : "0.00000"}</span>
              </div>
            </div>
          </div>

          {/* Live Symbol Stats */}
          {liveSymbolStats.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Symbols
              </p>
              <div className="space-y-2">
                {liveSymbolStats.map((s) => (
                  <div key={s.symbol} className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-300 font-medium">{s.symbol}</span>
                      <span className={`font-mono ${s.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {s.totalPnL >= 0 ? "+" : ""}${s.totalPnL.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-gray-500">
                      <span>{s.totalTrades}t</span>
                      <span>{s.wins}W/{s.losses}L</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Methodology Stats */}
          {liveMethStats.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-1">
                <Layers className="w-3 h-3" /> Methodologies
              </p>
              <div className="space-y-2">
                {liveMethStats.map((m) => (
                  <div key={m.methodology} className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-300 font-medium capitalize">{m.methodology}</span>
                      <span className={`font-mono ${m.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {m.pnl >= 0 ? "+" : ""}${m.pnl.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500">{m.count} trades</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Terminal Logs */}
        <div className="flex-1 bg-black/40 border border-gray-800 rounded-xl flex flex-col font-mono text-xs overflow-hidden relative">
          <div className="bg-gray-900/80 px-4 py-2 border-b border-gray-800 text-gray-500 flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Expert Advisor Journal
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex gap-3 leading-relaxed border-l-2 pl-3 py-0.5 ${
                    log.type === "trade_open" ? "border-blue-500 text-blue-100 bg-blue-900/10"
                    : log.type === "trade_close"
                      ? log.message.includes("+") ? "border-green-500 text-green-100 bg-green-900/10"
                        : "border-red-500 text-red-100 bg-red-900/10"
                      : log.type === "error" ? "border-red-500 text-red-400 bg-red-950/30"
                        : "border-gray-700 text-gray-400"
                  }`}
                >
                  <span className="text-gray-600 shrink-0">[{log.time}]</span>
                  <span className="break-words">{log.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Progress Footer */}
      <div className="p-4 bg-gray-900/80 border-t border-gray-800 backdrop-blur-md relative z-10 flex flex-col gap-2">
        <div className="flex justify-between text-xs font-medium font-mono">
          <span className="text-accent-gold flex items-center gap-2">
            {progressPercent < 100 ? <><Loader2 className="w-3 h-3 animate-spin" /> Processing...</> : "Completed."}
          </span>
          <span className="text-gray-400">
            {progress ? `${progress.currentCandle} / ${progress.totalCandles}` : "0 / 0"} ({Math.round(progressPercent)}%)
          </span>
        </div>
        <div className="h-1.5 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-800/50">
          <motion.div
            className="h-full bg-accent-gold rounded-full relative"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

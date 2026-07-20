"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  type BacktestConfig,
  type BacktestResult as BacktestResultData,
  buildStreamUrl,
  type StreamProgress,
  type StreamCandle,
  type StreamTradeOpen,
  type StreamTradeClose,
  type StreamDataReady,
  backtestService,
} from "@/services/backtest.service";
import {
  Terminal, XCircle, Cpu, TrendingUp, TrendingDown,
  Activity, Loader2, BarChart3, Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";

interface Props {
  config: BacktestConfig;
  onComplete: (result: BacktestResultData) => void;
  onError: (err: string) => void;
  onCancel: () => void;
}

type LogEntry = {
  id: string;
  time: string;
  candleTime?: string;
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

type StreamPhase = "preparing" | "ready" | "running" | "complete";

export function BacktestStreamView({ config, onComplete, onError, onCancel }: Props) {
  const [phase, setPhase] = useState<StreamPhase>("preparing");
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [candle, setCandle] = useState<StreamCandle | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [equityHistory, setEquityHistory] = useState<Array<{ time: number; equity: number }>>([]);
  const [liveSymbolStats, setLiveSymbolStats] = useState<LiveSymbolStat[]>([]);
  const symbolStatsRef = useRef<Map<string, LiveSymbolStat>>(new Map());
  const [liveMethStats, setLiveMethStats] = useState<Array<{ methodology: string; count: number; pnl: number }>>([]);
  const methStatsRef = useRef<Map<string, { count: number; pnl: number }>>(new Map());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dataReadyInfo, setDataReadyInfo] = useState<StreamDataReady | null>(null);
  const [startingSimulation, setStartingSimulation] = useState(false);

  // New SMC-focused states
  const [activeTradeCount, setActiveTradeCount] = useState(0);
  const [globalWins, setGlobalWins] = useState(0);
  const [globalLosses, setGlobalLosses] = useState(0);
  const [maxDrawdownPct, setMaxDrawdownPct] = useState(0);
  
  const activeTradesRef = useRef<Map<string, StreamTradeOpen>>(new Map());
  const maxEquityRef = useRef<number>(config.initialBalance);


  const accumulatedTradesRef = useRef<any[]>([]);
  const accumulatedEquityRef = useRef<any[]>([]);
  const initLoggedRef = useRef(false);
  const configKeyRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const completedRef = useRef(false);

  // ── Performance: RAF-based throttling ──────────────────────────
  // Buffer incoming SSE data in refs (no re-render), then flush to state at ~60fps
  const candleBufferRef = useRef<StreamCandle | null>(null);
  const progressBufferRef = useRef<StreamProgress | null>(null);
  const equityBufferRef = useRef<Array<{ time: number; equity: number; floatingPnL?: number }>>([]);
  const rafRef = useRef<number | null>(null);
  const globalWinsRef = useRef(0);
  const globalLossesRef = useRef(0);
  const maxDrawdownPctRef = useRef(0);
  
  const liveTradesBufferRef = useRef<any[]>([]);
  const [liveTrades, setLiveTrades] = useState<any[]>([]);

  // Config change detection — ensures proper reset on re-run
  const newKey = `${config.symbols.join(",")}|${config.timeframe}|${config.fromDate}|${config.toDate}|${config.initialBalance}|${config.maxRiskPerTrade}|${config.maxOpenPositions}|${config.leverage}|${config.signalInterval}|${config.entrySettings.rsiOversold}|${config.entrySettings.rsiOverbought}|${config.entrySettings.atrMultiplierSL}|${config.entrySettings.atrMultiplierTP}|${config.trailingStop.enabled}|${config.trailingStop.activationATR}|${config.trailingStop.trailATR}`;

  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  useEffect(() => {
    if (configKeyRef.current && configKeyRef.current !== newKey) {
      initLoggedRef.current = false; // reset log flag on config change
      setLogs([]);
      setEquityHistory([]);
      symbolStatsRef.current.clear();
      methStatsRef.current.clear();
      setLiveSymbolStats([]);
      setLiveMethStats([]);
      setCandle(null);
      setProgress(null);
      setSessionId(null);
      setDataReadyInfo(null);
      setStartingSimulation(false);
      setActiveTradeCount(0);
      setGlobalWins(0);
      setGlobalLosses(0);
      setMaxDrawdownPct(0);
      activeTradesRef.current.clear();
      maxEquityRef.current = config.initialBalance;
      globalWinsRef.current = 0;
      globalLossesRef.current = 0;
      maxDrawdownPctRef.current = 0;
      candleBufferRef.current = null;
      progressBufferRef.current = null;
      equityBufferRef.current = [];
      accumulatedTradesRef.current = [];
      accumulatedEquityRef.current = [];
      liveTradesBufferRef.current = [];
      setLiveTrades([]);
    }
    configKeyRef.current = newKey;
  }, [newKey]);

  // ── RAF flush loop: push buffered data to React state at ~60fps ──
  useEffect(() => {
    let running = true;
    const flush = () => {
      if (!running) return;
      // Flush candle
      const c = candleBufferRef.current;
      if (c) {
        candleBufferRef.current = null;
        setCandle(c);
      }
      // Flush progress
      const p = progressBufferRef.current;
      if (p) {
        progressBufferRef.current = null;
        setProgress(p);
      }
      // Flush equity (batch)
      const eq = equityBufferRef.current;
      if (eq.length > 0) {
        equityBufferRef.current = [];
        setEquityHistory(prev => {
          const next = [...prev, ...eq];
          // Downsample: keep max ~800 points for chart performance to allow smooth high-res curves
          if (next.length > 800) {
            const step = Math.ceil(next.length / 800);
            return next.filter((_, i) => i % step === 0 || i === next.length - 1);
          }
          return next;
        });
      }
      // Flush win/loss/drawdown
      setGlobalWins(globalWinsRef.current);
      setGlobalLosses(globalLossesRef.current);
      setMaxDrawdownPct(maxDrawdownPctRef.current);
      setActiveTradeCount(activeTradesRef.current.size);
      
      // Flush live trades PnL
      setLiveTrades(liveTradesBufferRef.current);

      rafRef.current = requestAnimationFrame(flush);
    };
    rafRef.current = requestAnimationFrame(flush);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    let mounted = true;

    // Cleanup previous EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const startStream = async () => {
      try {
        const streamConfig = { ...config };
        const url = buildStreamUrl(streamConfig);

        const addLog = (type: LogEntry["type"], message: string, details?: any, candleTimestamp?: number) => {
          if (!mounted) return;
          const candleTime = candleTimestamp
            ? new Date(candleTimestamp * 1000).toLocaleDateString("en-GB") + " " + new Date(candleTimestamp * 1000).toLocaleTimeString([], { hour12: false })
            : undefined;
          setLogs(prev => [...prev.slice(-49), {
            id: Math.random().toString(36).substr(2, 9),
            time: new Date().toLocaleTimeString([], { hour12: false }),
            candleTime,
            type, message, details,
          }]);
        };

        if (!initLoggedRef.current) {
          initLoggedRef.current = true;
          addLog("info", `Fetching historical data for ${config.symbols?.join(", ") || "symbols"} (${config.timeframe})...`);
        }

        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;
        if (!mounted) { es.close(); return; }

        let autoStarted = false;
        es.addEventListener("data_ready", (e: any) => {
          if (!mounted || autoStarted) return;
          try {
            const data = JSON.parse(e.data) as StreamDataReady;
            setSessionId(data.sessionId);
            setDataReadyInfo(data);
            setPhase("running");
            addLog("info", `Data loaded: ${data.totalCandles} candles across ${data.totalSymbols} symbol(s). Starting simulation...`);
            autoStarted = true;
          } catch {}
        });

        es.addEventListener("progress", (e: any) => {
          if (!mounted) return;
          try { progressBufferRef.current = JSON.parse(e.data); } catch {}
        });

        es.addEventListener("equity", (e: any) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(e.data);
            const pt = { time: data.time, equity: data.equity, floatingPnL: data.floatingPnL };
            accumulatedEquityRef.current.push(pt);
            equityBufferRef.current.push(pt);
            if (data.activeTrades) {
              liveTradesBufferRef.current = data.activeTrades;
            }
          } catch {}
        });

        es.addEventListener("candle", (e: any) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(e.data) as StreamCandle;
            // Buffer candle — RAF loop will flush to state
            candleBufferRef.current = data;
            // Update drawdown tracking in ref (no re-render)
            if (data.equity > maxEquityRef.current) {
                maxEquityRef.current = data.equity;
            } else if (maxEquityRef.current > 0) {
                const dd = ((maxEquityRef.current - data.equity) / maxEquityRef.current) * 100;
                if (dd > maxDrawdownPctRef.current) maxDrawdownPctRef.current = dd;
            }
          } catch {}
        });

        es.addEventListener("trade_open", (e: any) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(e.data) as StreamTradeOpen & { symbol: string; primaryMethodology?: string; time: number };
            addLog("trade_open",
              `${data.direction} ${data.symbol} @ ${data.entryPrice.toFixed(5)}${data.primaryMethodology ? ` [${data.primaryMethodology}]` : ""}`,
              data,
              data.time,
            );
            const sym = data.symbol || "unknown";
            if (!symbolStatsRef.current.has(sym)) {
              symbolStatsRef.current.set(sym, { symbol: sym, totalTrades: 0, wins: 0, losses: 0, totalPnL: 0 });
            }
            symbolStatsRef.current.get(sym)!.totalTrades++;
            setLiveSymbolStats(Array.from(symbolStatsRef.current.values()).sort((a, b) => b.totalTrades - a.totalTrades));
            const meth = data.primaryMethodology || "unknown";
            if (!methStatsRef.current.has(meth)) {
              methStatsRef.current.set(meth, { count: 0, pnl: 0 });
            }
            methStatsRef.current.get(meth)!.count++;
            setLiveMethStats(Array.from(methStatsRef.current.entries()).filter(([m]) => m !== "unknown").map(([methodology, m]) => ({ methodology, count: m.count, pnl: Math.round(m.pnl * 100) / 100 })).sort((a, b) => b.count - a.count));
            
            // Track open position (ref only — RAF flushes activeTradeCount)
            activeTradesRef.current.set(`${data.symbol}-${data.time}`, data);
          } catch {}
        });

        es.addEventListener("trade_close", (e: any) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(e.data) as StreamTradeClose & { symbol: string; primaryMethodology?: string; exitTime: number };
            accumulatedTradesRef.current.push(data);
            const pnlPrefix = data.pnl >= 0 ? "+" : "";
            const exitMeth = data.exitMethodology ? ` [Exit: ${data.exitMethodology}]` : "";
            const rrStr = data.rr > 0 ? ` | RR: 1:${data.rr.toFixed(2)}` : "";
            addLog("trade_close",
              `[${data.reason}] ${data.symbol} @ ${data.exitPrice.toFixed(5)}${exitMeth} | PnL: ${pnlPrefix}${data.pnl.toFixed(2)} (${data.pnlPercent.toFixed(2)}%)${rrStr}`,
              data,
              data.exitTime,
            );
            const sym = data.symbol || "unknown";
            if (symbolStatsRef.current.has(sym)) {
              const s = symbolStatsRef.current.get(sym)!;
              if (data.pnl >= 0) s.wins++; else s.losses++;
              s.totalPnL += data.pnl;
              setLiveSymbolStats(Array.from(symbolStatsRef.current.values()).sort((a, b) => b.totalTrades - a.totalTrades));
            }
            const meth = data.primaryMethodology || "unknown";
            if (methStatsRef.current.has(meth)) {
              methStatsRef.current.get(meth)!.pnl += data.pnl;
              setLiveMethStats(Array.from(methStatsRef.current.entries()).filter(([m]) => m !== "unknown").map(([methodology, m]) => ({ methodology, count: m.count, pnl: Math.round(m.pnl * 100) / 100 })).sort((a, b) => b.count - a.count));
            }

            // Remove from active trades (ref only — RAF flushes)
            activeTradesRef.current.delete(`${data.symbol}-${data.entryTime}`);
            
            // Update Global Win Rate (ref only — RAF flushes)
            if (data.pnl >= 0) globalWinsRef.current++;
            else globalLossesRef.current++;
          } catch {}
        });

        es.addEventListener("complete", (e: any) => {
          if (!mounted || completedRef.current) return;
          try {
            completedRef.current = true;
            addLog("info", "Backtest complete. Generating report...");
            const data = JSON.parse(e.data) as BacktestResultData;
            data.trades = accumulatedTradesRef.current;
            data.equityCurve = accumulatedEquityRef.current;
            setPhase("complete");
            setTimeout(() => { 
              if (mounted) {
                onCompleteRef.current(data);
              } 
            }, 1500);
          } catch (err) {
            console.error("Complete handler error:", err);
          } finally {
            if (es.readyState !== EventSource.CLOSED) {
              es.close();
            }
            eventSourceRef.current = null;
          }
        });

        es.onerror = () => {
          if (!mounted) return;
          // If we already received complete, just close it.
          if (completedRef.current) {
            if (es.readyState !== EventSource.CLOSED) es.close();
            return;
          }
          // Prevent EventSource auto-reconnect
          if (es.readyState === EventSource.CONNECTING) {
            es.close();
            return;
          }
          if (es.readyState !== EventSource.CLOSED) {
            addLog("error", "Connection interrupted.");
            es.close();
            eventSourceRef.current = null;
            setTimeout(() => { if (mounted) onErrorRef.current("Connection lost"); }, 2000);
          }
        };

        es.addEventListener("error", (e: any) => {
          if (!mounted) return;
          let msg = "Stream error";
          try { if (e.data) { const d = JSON.parse(e.data); msg = d.message || msg; } } catch {}
          addLog("error", "ERROR: " + msg);
          es.close();
          eventSourceRef.current = null;
          setTimeout(() => { if (mounted) onErrorRef.current(msg); }, 2000);
        });

      } catch (err: any) {
        if (mounted) onErrorRef.current(err.message || "Failed to prepare backtest");
      }
    };

    startStream();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [newKey]);

  const handleCancelPreparation = async () => {
    if (sessionId) {
      try {
        await backtestService.cancelSession(sessionId);
      } catch (err) {
        console.error("Failed to cancel session:", err);
      }
    }
    onCancel();
  };

  const handleStartSimulation = async () => {
    if (!sessionId) return;
    setStartingSimulation(true);
    try {
      const res = await backtestService.startSession(sessionId);
      if (res.success) {
        setPhase("running");
      } else {
        onError(res.error || "Failed to start simulation");
      }
    } catch (err: any) {
      onError(err.message || "Failed to start simulation");
    } finally {
      setStartingSimulation(false);
    }
  };

  const progressPercent = progress ? progress.percent : 0;

  const getKillzone = (timeStr?: number) => {
    if (!timeStr) return { name: "None", color: "text-text-muted", bg: "bg-bg-input" };
    const date = new Date(timeStr * 1000);
    const hour = date.getUTCHours();
    if (hour >= 0 && hour < 6) return { name: "Asian", color: "text-yellow-400", bg: "bg-yellow-400/10" };
    if (hour >= 7 && hour < 10) return { name: "London", color: "text-blue-400", bg: "bg-blue-400/10" };
    if (hour >= 13 && hour < 16) return { name: "New York", color: "text-red-400", bg: "bg-red-400/10" };
    return { name: "None", color: "text-text-muted", bg: "bg-bg-input" };
  };

  const killzone = getKillzone(candle?.time);
  const winRate = globalWins + globalLosses > 0 ? (globalWins / (globalWins + globalLosses)) * 100 : 0;

  return (
    <div className="h-full min-h-[500px] flex flex-col glass overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(#d4af37 1px, transparent 1px), linear-gradient(90deg, #d4af37 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/40 border-b border-accent-gold/20 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-accent-gold animate-pulse" />
          <h3 className="text-sm font-bold text-text-primary tracking-wider uppercase">AI Strategy Tester</h3>
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted bg-black/60 px-3 py-1 rounded border border-accent-gold/30 shadow-inner">
            <span className="text-accent-gold">{config.symbols?.join(",") || ""}</span>
            <span>{config.timeframe}</span>
          </div>
        </div>
        <button onClick={handleCancelPreparation} className="flex items-center gap-2 text-xs font-medium text-text-muted hover:text-red-400 transition-colors bg-black/60 px-3 py-1.5 rounded border border-accent-gold/30 hover:border-red-500/50 hover:bg-red-900/20">
          <XCircle className="w-4 h-4" /> Stop
        </button>
      </div>

      {/* Main View */}
      {(phase === "preparing" || phase === "running" || phase === "complete") && (
        <div className="flex-1 flex flex-col lg:flex-row relative z-10 p-4 gap-4 overflow-hidden">
        {/* Left Panel */}
        <div className="w-full lg:w-72 flex flex-col gap-4 overflow-y-auto">
          {/* Equity Card */}
          <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-4">
            <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">Current Equity</p>
            <p className="text-2xl font-bold font-mono text-text-primary">
              ${candle ? (candle.equity || 0).toFixed(2) : (config.initialBalance || 0).toFixed(2)}
            </p>
            {candle && (candle.floatingPnL || 0) !== 0 && (
              <div className={`flex items-center gap-1 text-sm mt-1 font-mono ${(candle.floatingPnL || 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                {(candle.floatingPnL || 0) > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {(candle.floatingPnL || 0) > 0 ? "+" : ""}{(candle.floatingPnL || 0).toFixed(2)}
              </div>
            )}
            {candle && candle.marginLevel > 0 && (
              <p className="text-[10px] text-text-muted mt-1">Margin: {candle.marginLevel.toFixed(1)}%</p>
            )}
          </div>

          {/* Price Card */}
          <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-4">
            <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-1"><Activity className="w-3 h-3" /> Live Quote</p>
            <div className="space-y-1 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Close</span>
                <span className="text-accent-gold font-bold">{candle ? (candle.close || 0).toFixed(5) : "0.00000"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">High</span>
                <span className="text-text-secondary">{candle ? (candle.high || 0).toFixed(5) : "0.00000"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Low</span>
                <span className="text-text-secondary">{candle ? (candle.low || 0).toFixed(5) : "0.00000"}</span>
              </div>
            </div>
          </div>

          {/* New SMC-Focused Analytics Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Killzone Card */}
            <div className={`border border-accent-gold/20 rounded-lg p-3 ${killzone.bg}`}>
              <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-1">Session</p>
              <div className={`font-mono font-bold text-sm ${killzone.color}`}>{killzone.name}</div>
            </div>

            {/* Win Rate Card */}
            <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-3">
              <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-1 flex items-center justify-between">
                <span>Win Rate</span>
                <span className="text-text-muted">{globalWins}W / {globalLosses}L</span>
              </p>
              <div className={`font-mono font-bold text-sm ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {winRate.toFixed(1)}%
              </div>
            </div>

            {/* Max Drawdown Card */}
            <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-3">
              <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-1">Max Drawdown</p>
              <div className="font-mono font-bold text-sm text-red-400">
                -{maxDrawdownPct.toFixed(2)}%
              </div>
            </div>

            {/* Open Positions Card */}
            <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-3">
              <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-1">Open Positions</p>
              <div className="flex justify-between items-baseline">
                <div className="font-mono font-bold text-sm text-blue-400">{activeTradeCount} Active</div>
                <div className={`font-mono text-xs ${(candle?.floatingPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(candle?.floatingPnL || 0) >= 0 ? '+' : ''}${(candle?.floatingPnL || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Live Symbol Stats */}
          {liveSymbolStats.length > 0 && (
            <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-4">
              <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Symbols</p>
              <div className="space-y-2">
                {liveSymbolStats.map((s) => (
                  <div key={s.symbol} className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary font-medium">{s.symbol}</span>
                      <span className={`font-mono ${s.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {s.totalPnL >= 0 ? "+" : ""}${s.totalPnL.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-text-muted">
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
            <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-4">
              <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-1"><Layers className="w-3 h-3" /> Methodologies</p>
              <div className="space-y-2">
                {liveMethStats.map((m) => (
                  <div key={m.methodology} className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary font-medium capitalize">{m.methodology}</span>
                      <span className={`font-mono ${m.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {m.pnl >= 0 ? "+" : ""}${m.pnl.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted">{m.count} trades</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Equity Curve + Journal */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Equity Curve Chart */}
          {equityHistory.length > 1 && (
            <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-3">
              <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">Equity Curve</p>
              <div style={{ height: "200px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityHistory.map(p => ({ time: new Date(p.time * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }), equity: p.equity }))}>
                    <defs>
                      <linearGradient id="streamEqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 8 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 8 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={40} />
                    <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", fontSize: "10px" }} />
                    <Area type="monotone" dataKey="equity" stroke="#D4AF37" strokeWidth={1.5} fill="url(#streamEqGrad)" isAnimationActive={false} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Live Active Positions */}
          {liveTrades.length > 0 && (
            <div className="bg-black/40 border border-accent-gold/20 rounded-lg p-3">
              <p className="text-text-muted text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">Live Positions</p>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                {liveTrades.map((t, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-mono bg-surface/60 p-2 rounded-lg border border-border-subtle/50">
                    <div className="flex items-center gap-3">
                       <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.direction.toUpperCase() === "BUY" ? "bg-blue-900/30 text-blue-400" : "bg-red-900/30 text-red-400"}`}>{t.direction.toUpperCase()}</span>
                       <span className="text-gray-200 font-bold">{t.symbol}</span>
                       <span className="text-text-muted text-[10px]">
                         {t.volume} lot {t.primaryMethodology ? <span className="text-gray-600">[{t.primaryMethodology.toUpperCase()}]</span> : ""}
                       </span>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="text-text-muted tracking-tight hidden sm:block">{t.entryPrice.toFixed(5)} → {t.currentPrice.toFixed(5)}</span>
                       <span className={`font-bold w-16 text-right ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                         {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Trading Journal */}
          <div className="flex-1 bg-black/40 border border-border-subtle rounded-xl flex flex-col font-mono text-xs overflow-hidden relative max-h-[400px]">
            <div className="bg-bg-elevated px-4 py-2 border-b border-border-subtle text-text-muted flex items-center gap-2">
              <Terminal className="w-4 h-4" /> AI Trading Journal
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
              {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex gap-3 leading-relaxed border-l-2 pl-3 py-0.5 ${
                      log.type === "trade_open" ? "border-blue-500 text-blue-100 bg-blue-900/10"
                      : log.type === "trade_close"
                        ? log.message.includes("+") ? "border-green-500 text-green-100 bg-green-900/10"
                          : "border-red-500 text-red-100 bg-red-900/10"
                        : log.type === "error" ? "border-red-500 text-red-400 bg-red-950/30"
                          : "border-border-subtle text-text-muted"
                    }`}
                  >
                    <span className="text-gray-600 shrink-0">[{log.candleTime || log.time}]</span>
                    <span className="break-words">{log.message}</span>
                  </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Progress Footer */}
      <div className="p-4 bg-bg-elevated border-t border-border-subtle backdrop-blur-md relative z-10 flex flex-col gap-2">
        <div className="flex justify-between text-xs font-medium font-mono">
          <span className="text-accent-gold flex items-center gap-2">
            {phase === "preparing" && !progress && (
              <><Loader2 className="w-3 h-3 animate-spin" /> Fetching historical data...</>
            )}
            {phase === "running" && progress && progress.percent === 0 && (
              <><Loader2 className="w-3 h-3 animate-spin" /> Initializing Strategy Engine...</>
            )}
            {phase === "running" && progress && progress.percent > 0 && progress.percent < 100 && (
              <><Loader2 className="w-3 h-3 animate-spin" /> Simulating... {Math.round(progressPercent)}%</>
            )}
            {phase === "running" && progress && progress.percent >= 100 && (<>Completed.</>)}
            {phase === "complete" && (<>Completed.</>)}
          </span>
          <span className="text-text-muted">
            {progress ? (
              `${progress.currentCandle} / ${progress.totalCandles} (${Math.round(progressPercent)}%)`
            ) : (
              "loading data..."
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

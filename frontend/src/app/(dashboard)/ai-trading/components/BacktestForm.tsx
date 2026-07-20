"use client";

import { useState, useEffect, useRef } from "react";
import {
  type BacktestConfig,
} from "@/services/backtest.service";
import { aiTradingService } from "@/services/ai-trading.service";
import {
  Play,
  Settings2,
  Calendar,
  Target,
  CandlestickChart,
  Loader2,
  BarChart3,
  Layers,
  Gauge,
  Zap,
  BrainCircuit,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { useAiTrading } from "../context/AiTradingContext";

const FALLBACK_SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
  "NZDUSD", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD", "BTCUSD",
];

const METHODOLOGY_NAMES = [
  "smc", "ict", "msnr"
];

interface Props {
  onRun: (config: BacktestConfig) => void;
  isRunning: boolean;
}

export function BacktestForm({ onRun, isRunning }: Props) {
  const { accountInfo } = useAiTrading();
  // Helper for localStorage state persistence
  const useStickyState = <T,>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [value, setValue] = useState<T>(() => {
      if (typeof window !== 'undefined') {
        const stickyValue = window.localStorage.getItem(key);
        return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
      }
      return defaultValue;
    });

    useEffect(() => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    }, [key, value]);

    return [value, setValue];
  };

  const [symbols, setSymbols] = useState<string[]>(FALLBACK_SYMBOLS);
  const [selectedSymbols, setSelectedSymbols] = useStickyState<string[]>(["EURUSD"], "bt_selectedSymbols");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [filteredSymbols, setFilteredSymbols] = useState(FALLBACK_SYMBOLS);
  const [timeframe, setTimeframe] = useStickyState("M15", "bt_timeframe");
  const [fromDate, setFromDate] = useStickyState("", "bt_fromDate");
  const [toDate, setToDate] = useStickyState("", "bt_toDate");
  const [initialBalance, setInitialBalance] = useStickyState(10000, "bt_initialBalance");
  const [rsiOversold, setRsiOversold] = useStickyState(30, "bt_rsiOversold");
  const [rsiOverbought, setRsiOverbought] = useStickyState(70, "bt_rsiOverbought");
  const [slMultiplier, setSlMultiplier] = useStickyState(1.5, "bt_slMultiplier");
  const [tpMultiplier, setTpMultiplier] = useStickyState(1.5, "bt_tpMultiplier");
  const [trailingEnabled, setTrailingEnabled] = useStickyState(true, "bt_trailingEnabled");
  const [activationATR, setActivationATR] = useStickyState(1.0, "bt_activationATR");
  const [trailATR, setTrailATR] = useStickyState(0.5, "bt_trailATR");
  const [maxRisk, setMaxRisk] = useStickyState(1.0, "bt_maxRisk");
  const [maxPositions, setMaxPositions] = useStickyState(3, "bt_maxPositions");
  const [leverage, setLeverage] = useStickyState(100, "bt_leverage");
  const [signalInterval, setSignalInterval] = useStickyState(3, "bt_signalInterval");
  const [speedMs, setSpeedMs] = useStickyState(0, "bt_speedMs");
  const [activeMethodologies, setActiveMethodologies] = useStickyState<string[]>(METHODOLOGY_NAMES, "bt_activeMethodologies");

  // Smart Risk Management
  const [smartRiskEnabled, setSmartRiskEnabled] = useStickyState(false, "bt_smartRiskEnabled");
  const [cpEnabled, setCpEnabled] = useStickyState(false, "bt_cpEnabled");
  const [cpGrowthPct, setCpGrowthPct] = useStickyState(100, "bt_cpGrowthPct");
  const [cpRiskMult, setCpRiskMult] = useStickyState(0.5, "bt_cpRiskMult");
  const [dlEnabled, setDlEnabled] = useStickyState(false, "bt_dlEnabled");
  const [dlProfitPct, setDlProfitPct] = useStickyState(3, "bt_dlProfitPct");
  const [dlLossPct, setDlLossPct] = useStickyState(4, "bt_dlLossPct");
  const [drEnabled, setDrEnabled] = useStickyState(false, "bt_drEnabled");
  const [drActivationPct, setDrActivationPct] = useStickyState(10, "bt_drActivationPct");
  const [drRiskMult, setDrRiskMult] = useStickyState(0.5, "bt_drRiskMult");
  
  // Migration for older localStorage data: replace 'ictCrt' with 'ict' or remove
  useEffect(() => {
    setActiveMethodologies(prev => {
      const valid = new Set(["smc", "ict", "msnr"]);
      const next = new Set<string>();
      
      for (const m of prev) {
        if (m === "ictCrt" || m === "crt") {
          next.add("ict");
        } else if (valid.has(m)) {
          next.add(m);
        }
      }
      
      // If empty after filter, set default
      if (next.size === 0) {
        return ["smc", "ict", "msnr"];
      }
      
      // Only update if changed
      const nextArr = Array.from(next);
      if (nextArr.length !== prev.length || !nextArr.every((v, i) => v === prev[i])) {
        return nextArr;
      }
      return prev;
    });
  }, [setActiveMethodologies]);

  const [showAdvanced, setShowAdvanced] = useStickyState(false, "bt_showAdvanced");

  // Set default dates if not loaded from localStorage
  useEffect(() => {
    if (!toDate || !fromDate) {
      const now = new Date();
      const past = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      if (!toDate) setToDate(now.toISOString().split("T")[0]);
      if (!fromDate) setFromDate(past.toISOString().split("T")[0]);
    }
  }, [toDate, fromDate]);

  // Fetch available symbols from API
  useEffect(() => {
    let mounted = true;
    const fetchSymbols = async () => {
      try {
        const res = await aiTradingService.getSymbols();
        if (mounted && res.success && res.data?.symbols) {
          const fetchedSymbols = res.data.symbols.map((s: any) => 
            typeof s === "string" ? s : s.name
          );
          if (fetchedSymbols.length > 0) {
            setSymbols(fetchedSymbols);
            setFilteredSymbols(fetchedSymbols);

            // Ensure selected symbols are valid for this broker
            setSelectedSymbols(prev => {
              const valid = prev.filter(s => fetchedSymbols.includes(s));
              // If none of the selected symbols are valid, auto-select the first available one
              if (valid.length === 0) {
                return [fetchedSymbols[0]];
              }
              return valid;
            });
          }
        }
      } catch (err) {
        console.warn("Failed to fetch symbols:", err);
      }
    };
    fetchSymbols();
    return () => { mounted = false; };
  }, []);

  // Filter symbols berdasarkan pencarian
  useEffect(() => {
    setFilteredSymbols(
      symbolSearch.length === 0
        ? symbols
        : symbols.filter(s => s.toLowerCase().includes(symbolSearch.toLowerCase()))
    );
  }, [symbolSearch, symbols]);

  const addSymbol = (sym: string) => {
    const s = sym.trim();
    const matched = symbols.find(x => x.toLowerCase() === s.toLowerCase()) || s.toUpperCase();
    if (matched && !selectedSymbols.includes(matched)) {
      setSelectedSymbols(prev => [...prev, matched]);
    }
  };

  const removeSymbol = (sym: string) => {
    setSelectedSymbols(prev => prev.filter(s => s !== sym));
  };

  const toggleMethodology = (m: string) => {
    setActiveMethodologies((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const aiConfigAbortRef = useRef<AbortController | null>(null);

  const handleAIConfig = async () => {
    // Abort any previous request
    if (aiConfigAbortRef.current) {
      aiConfigAbortRef.current.abort();
    }
    aiConfigAbortRef.current = new AbortController();

    try {
      const { aiTradingService } = await import("@/services/ai-trading.service");
      const res = await aiTradingService.getSkill();
      if (!res.success || !res.data?.symbolRankings) return;

      // Symbols — 5 best pairs with score ≥ 50
      const topSymbols = res.data.symbolRankings
        .filter((s: any) => s.score >= 50)
        .slice(0, 5)
        .map((s: any) => s.symbol);
      if (topSymbols.length > 0) setSelectedSymbols(topSymbols);

      // Methodologies — disable DISABLE verdicts
      const disabled = (res.data.methodologyRankings || [])
        .filter((m: any) => m.verdict === "DISABLE")
        .map((m: any) => m.methodology);
      setActiveMethodologies(METHODOLOGY_NAMES.filter(m => !disabled.includes(m)));
      setShowAdvanced(true); // auto-expand so user sees which methodologies changed

      // Params — from best symbol's recommendedParams
      const best = res.data.symbolRankings[0]?.recommendedParams;
      if (best) {
        if (best.rsiOversold) setRsiOversold(best.rsiOversold);
        if (best.rsiOverbought) setRsiOverbought(best.rsiOverbought);
        if (best.atrMultiplierSL) setSlMultiplier(best.atrMultiplierSL);
        if (best.atrMultiplierTP) setTpMultiplier(best.atrMultiplierTP);
        if (best.signalInterval) setSignalInterval(best.signalInterval);
      }

      // Risk — 0.5% (auto-backtest standard)
      setMaxRisk(0.5);
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate || selectedSymbols.length === 0) return;

    onRun({
      symbols: selectedSymbols,
      timeframe: timeframe as "M5" | "M15" | "H1" | "H4" | "D1",
      fromDate: new Date(fromDate).toISOString(),
      toDate: new Date(toDate).toISOString(),
      initialBalance,
      entrySettings: {
        rsiOversold,
        rsiOverbought,
        atrMultiplierSL: slMultiplier,
        atrMultiplierTP: tpMultiplier,
      },
      trailingStop: {
        enabled: trailingEnabled,
        activationATR,
        trailATR,
        breakEven: false,
      },
      maxRiskPerTrade: maxRisk,
      maxOpenPositions: maxPositions,
      leverage,
      signalInterval,
      speedMs,
      activeMethodologies,
      smartRisk: {
        enabled: smartRiskEnabled,
        capitalPreservation: {
          enabled: cpEnabled,
          activationGrowthPct: cpGrowthPct,
          riskReductionMultiplier: cpRiskMult
        },
        dailyLimits: {
          enabled: dlEnabled,
          profitTargetPct: dlProfitPct,
          lossLimitPct: dlLossPct
        },
        drawdownRecovery: {
          enabled: drEnabled,
          activationDrawdownPct: drActivationPct,
          riskReductionMultiplier: drRiskMult
        }
      },
    });
  };

  return (
    <div className="glass p-4 space-y-4 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent-gold/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between border-b border-accent-gold/20 pb-3 relative">
        <div className="flex items-center gap-3">
          <Settings2 className="w-5 h-5 text-accent-gold" />
          <h3 className="text-[11px] font-bold text-accent-gold uppercase tracking-widest drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
            Backtest Config
          </h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
        {/* Symbols Multi-Select dengan Search */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <CandlestickChart className="w-3.5 h-3.5" />
            Symbols ({selectedSymbols.length})
          </label>

          {/* Input untuk search + ketik manual */}
          <input
            type="text"
            value={symbolSearch}
            onChange={(e) => setSymbolSearch(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSymbol(symbolSearch);
                setSymbolSearch("");
              }
            }}
            placeholder="Type symbol & Enter (e.g. EURUSD) or search..."
            className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary focus:border-accent-gold outline-none mb-2"
          />

          {/* Selected symbols sebagai tag */}
          {selectedSymbols.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedSymbols.map(sym => (
                <span key={sym} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-gold/20 text-accent-gold text-[10px] rounded-full">
                  {sym}
                  <button type="button" onClick={() => removeSymbol(sym)} className="hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          )}

          {/* Daftar symbols terfilter */}
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {filteredSymbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => addSymbol(sym)}
                className={`px-2 py-1 text-[10px] rounded font-medium transition ${
                  selectedSymbols.includes(sym)
                    ? "bg-accent-gold text-black"
                    : "bg-bg-input text-text-muted hover:text-text-primary"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-600">Click symbol to add. Type custom symbol + Enter.</p>
        </div>

        {/* Tombol AI Auto-Config */}
        <button
          type="button"
          onClick={handleAIConfig}
          className="w-full py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs rounded-lg hover:bg-purple-600/30 transition flex items-center justify-center gap-2"
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          Apply AI Insights (auto-configure from skill)
        </button>

        {/* Timeframe + Dates */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary font-medium focus:border-accent-gold outline-none"
            >
              <option value="M5">M5</option>
              <option value="M15">M15</option>
              <option value="H1">H1</option>
              <option value="H4">H4</option>
              <option value="D1">D1</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary focus:border-accent-gold outline-none"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary focus:border-accent-gold outline-none"
              required
            />
          </div>
        </div>

        {/* Balance + Leverage */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3 h-3" />
              Balance ($)
            </label>
            <input
              type="text" inputMode="decimal"
              value={initialBalance}
              onChange={(e) => setInitialBalance(Number(e.target.value) || 0)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary focus:border-accent-gold outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Leverage</label>
              {accountInfo?.leverage && (
                <button
                  type="button"
                  onClick={() => setLeverage(accountInfo.leverage)}
                  className="flex items-center gap-1 text-[10px] text-accent-gold hover:text-yellow-400 transition"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Sync ({accountInfo.leverage})
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                min={1}
                step={1}
                className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 pl-6 text-sm text-text-primary focus:border-accent-gold outline-none"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-text-muted">1:</span>
            </div>
          </div>
        </div>

        {/* SL/TP Multipliers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">SL (ATR ×)</label>
            <input
              type="text" inputMode="decimal" value={slMultiplier} onChange={(e) => setSlMultiplier(parseFloat(e.target.value) || 0)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary focus:border-accent-gold outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">TP (ATR ×)</label>
            <input
              type="text" inputMode="decimal" value={tpMultiplier} onChange={(e) => setTpMultiplier(parseFloat(e.target.value) || 0)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary focus:border-accent-gold outline-none"
            />
          </div>
        </div>

        {/* Risk Settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Risk/Trade (%)</label>
            <input
              type="text" inputMode="decimal" value={maxRisk} onChange={(e) => setMaxRisk(parseFloat(e.target.value) || 0)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary focus:border-accent-gold outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Max Positions</label>
            <input
              type="text" inputMode="numeric" value={maxPositions} onChange={(e) => setMaxPositions(parseInt(e.target.value) || 1)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary focus:border-accent-gold outline-none"
            />
          </div>
        </div>

        {/* Trailing Stop */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="trailing"
            checked={trailingEnabled}
            onChange={(e) => setTrailingEnabled(e.target.checked)}
            className="rounded bg-bg-input border-gray-600"
          />
          <label htmlFor="trailing" className="text-xs text-text-muted">Trailing Stop</label>
          {trailingEnabled && (
            <div className="flex gap-2 ml-2">
              <input
                type="text" inputMode="decimal" value={activationATR} onChange={(e) => setActivationATR(parseFloat(e.target.value) || 0)}
                className="w-16 bg-bg-elevated border border-border-subtle rounded-lg p-1 text-xs text-text-primary text-center outline-none"
                title="Activation ATR"
              />
              <input
                type="text" inputMode="decimal" value={trailATR} onChange={(e) => setTrailATR(parseFloat(e.target.value) || 0)}
                className="w-16 bg-bg-elevated border border-border-subtle rounded-lg p-1 text-xs text-text-primary text-center outline-none"
                title="Trail ATR"
              />
            </div>
          )}
        </div>

        {/* Smart Risk Management */}
        <div className="bg-surface/40 border border-border-subtle/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-accent-gold uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Smart Risk Management
            </h4>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={smartRiskEnabled} onChange={(e) => setSmartRiskEnabled(e.target.checked)} />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-gold"></div>
            </label>
          </div>
          
          {smartRiskEnabled && (
            <div className="space-y-4 border-t border-border-subtle pt-4 mt-2">
              {/* Drawdown Recovery */}
              <div className="flex items-start gap-3">
                <input type="checkbox" id="drEnabled" checked={drEnabled} onChange={(e) => setDrEnabled(e.target.checked)} className="mt-1 rounded bg-bg-input border-gray-600" />
                <div className="flex-1 space-y-2">
                  <label htmlFor="drEnabled" className="text-xs font-medium text-text-secondary block">Drawdown Recovery (Safety Gear)</label>
                  {drEnabled && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={drActivationPct} onChange={(e) => setDrActivationPct(Number(e.target.value))} className="w-16 bg-surface border border-border-subtle rounded p-1 text-xs text-text-primary text-center" title="Activation Drawdown %" />
                      <span className="text-[10px] text-text-muted">% DD ➔</span>
                      <input type="number" step="0.1" value={drRiskMult} onChange={(e) => setDrRiskMult(Number(e.target.value))} className="w-16 bg-surface border border-border-subtle rounded p-1 text-xs text-text-primary text-center" title="Risk Multiplier" />
                      <span className="text-[10px] text-text-muted">× Risk</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Capital Preservation */}
              <div className="flex items-start gap-3">
                <input type="checkbox" id="cpEnabled" checked={cpEnabled} onChange={(e) => setCpEnabled(e.target.checked)} className="mt-1 rounded bg-bg-input border-gray-600" />
                <div className="flex-1 space-y-2">
                  <label htmlFor="cpEnabled" className="text-xs font-medium text-text-secondary block">Tiered Scaling (Capital Preservation)</label>
                  {cpEnabled && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={cpGrowthPct} onChange={(e) => setCpGrowthPct(Number(e.target.value))} className="w-16 bg-surface border border-border-subtle rounded p-1 text-xs text-text-primary text-center" title="Activation Growth %" />
                      <span className="text-[10px] text-text-muted">% Profit ➔</span>
                      <input type="number" step="0.1" value={cpRiskMult} onChange={(e) => setCpRiskMult(Number(e.target.value))} className="w-16 bg-surface border border-border-subtle rounded p-1 text-xs text-text-primary text-center" title="Risk Multiplier" />
                      <span className="text-[10px] text-text-muted">× Risk</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Daily Limits */}
              <div className="flex items-start gap-3">
                <input type="checkbox" id="dlEnabled" checked={dlEnabled} onChange={(e) => setDlEnabled(e.target.checked)} className="mt-1 rounded bg-bg-input border-gray-600" />
                <div className="flex-1 space-y-2">
                  <label htmlFor="dlEnabled" className="text-xs font-medium text-text-secondary block">Prop Firm Daily Limits</label>
                  {dlEnabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-green-500">Target:</span>
                      <input type="number" value={dlProfitPct} onChange={(e) => setDlProfitPct(Number(e.target.value))} className="w-16 bg-surface border border-border-subtle rounded p-1 text-xs text-text-primary text-center" title="Daily Profit Target %" />
                      <span className="text-[10px] text-text-muted">%</span>
                      <span className="text-[10px] text-red-500 ml-2">Loss:</span>
                      <input type="number" value={dlLossPct} onChange={(e) => setDlLossPct(Number(e.target.value))} className="w-16 bg-surface border border-border-subtle rounded p-1 text-xs text-text-primary text-center" title="Daily Loss Limit %" />
                      <span className="text-[10px] text-text-muted">%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Speed + Signal Interval */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3" /> Speed
            </label>
            <select
              value={speedMs}
              onChange={(e) => setSpeedMs(Number(e.target.value))}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary outline-none"
            >
              <option value={0}>⚡ Max Speed</option>
              <option value={10}>🏎️ Visual (Smooth)</option>
              <option value={50}>👁️ Observable</option>
            </select>
            <p className="text-[9px] text-gray-600">Max = fastest result. Visual = smooth like MT5.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Signal Eval
            </label>
            <select
              value={signalInterval}
              onChange={(e) => setSignalInterval(Number(e.target.value))}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl p-2.5 text-sm text-text-primary outline-none"
            >
              <option value={1}>Every Candle (Accurate)</option>
              <option value={3}>Every 3rd (Balanced)</option>
              <option value={6}>Every 6th (Fast)</option>
              <option value={12}>Every 12th (Ultra Fast)</option>
            </select>
            <p className="text-[9px] text-gray-600">Higher = faster but may miss entries.</p>
          </div>
        </div>

        {/* Active Methodologies */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition"
          >
            <Layers className="w-3.5 h-3.5" />
            Methodologies ({activeMethodologies.length}/{METHODOLOGY_NAMES.length})
            <span className="ml-1">{showAdvanced ? "▲" : "▼"}</span>
          </button>
          {showAdvanced && (
            <div className="flex flex-wrap gap-1 mt-2">
              {METHODOLOGY_NAMES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethodology(m)}
                  className={`px-2 py-1 text-[9px] rounded font-medium transition ${
                    activeMethodologies.includes(m)
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                      : "bg-bg-input text-text-muted border border-border-subtle"
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isRunning || selectedSymbols.length === 0}
          className="w-full relative group overflow-hidden bg-accent-gold text-black rounded-xl p-3.5 font-bold transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12"></div>
          <div className="relative flex items-center justify-center gap-2">
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
            ) : (
              <><Play className="w-4 h-4 fill-current" /> Start Backtest</>
            )}
          </div>
        </button>
      </form>
    </div>
  );
}

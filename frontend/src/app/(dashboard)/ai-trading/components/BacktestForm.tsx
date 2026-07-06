"use client";

import { useState, useEffect } from "react";
import {
  type BacktestConfig,
} from "@/services/backtest.service";
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
} from "lucide-react";

const FALLBACK_SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
  "NZDUSD", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD", "BTCUSD",
];

const METHODOLOGY_NAMES = [
  "smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf",
];

interface Props {
  onRun: (config: BacktestConfig) => void;
  isRunning: boolean;
}

export function BacktestForm({ onRun, isRunning }: Props) {
  const [symbols, setSymbols] = useState<string[]>(["EURUSD"]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(["EURUSD"]);
  const [timeframe, setTimeframe] = useState("M15");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [initialBalance, setInitialBalance] = useState(10000);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [slMultiplier, setSlMultiplier] = useState(1.5);
  const [tpMultiplier, setTpMultiplier] = useState(1.5);
  const [trailingEnabled, setTrailingEnabled] = useState(true);
  const [activationATR, setActivationATR] = useState(1.0);
  const [trailATR, setTrailATR] = useState(0.5);
  const [maxRisk, setMaxRisk] = useState(1.0);
  const [maxPositions, setMaxPositions] = useState(3);
  const [leverage, setLeverage] = useState(100);
  const [signalInterval, setSignalInterval] = useState(4);
  const [speedMs, setSpeedMs] = useState(0);
  const [activeMethodologies, setActiveMethodologies] = useState<string[]>(METHODOLOGY_NAMES);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Set default dates
  useEffect(() => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    setToDate(now.toISOString().split("T")[0]);
    setFromDate(past.toISOString().split("T")[0]);
  }, []);

  // Load symbols (fallback to hardcoded if API fails)
  useEffect(() => {
    setSymbols(FALLBACK_SYMBOLS);
  }, []);

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    );
  };

  const toggleMethodology = (m: string) => {
    setActiveMethodologies((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate || selectedSymbols.length === 0) return;

    onRun({
      symbols: selectedSymbols,
      timeframe,
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
    });
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent-gold/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gray-800/80 rounded-lg border border-gray-700/50">
          <Settings2 className="w-5 h-5 text-accent-gold" />
        </div>
        <h3 className="text-lg font-semibold text-white tracking-wide">Backtest Config</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
        {/* Symbols Multi-Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <CandlestickChart className="w-3.5 h-3.5" />
            Symbols ({selectedSymbols.length})
          </label>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {symbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => toggleSymbol(sym)}
                className={`px-2 py-1 text-[10px] rounded font-medium transition ${
                  selectedSymbols.includes(sym)
                    ? "bg-accent-gold text-black"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe + Dates */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white font-medium focus:border-accent-gold outline-none"
            >
              <option value="M5">M5</option>
              <option value="M15">M15</option>
              <option value="H1">H1</option>
              <option value="H4">H4</option>
              <option value="D1">D1</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
              required
            />
          </div>
        </div>

        {/* Balance + Leverage */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3 h-3" />
              Balance ($)
            </label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(Number(e.target.value))}
              min={100}
              step={1000}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Leverage</label>
            <select
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
            >
              <option value={1}>1:1</option>
              <option value={30}>1:30</option>
              <option value={50}>1:50</option>
              <option value={100}>1:100</option>
              <option value={200}>1:200</option>
              <option value={500}>1:500</option>
            </select>
          </div>
        </div>

        {/* Entry Settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">RSI Oversold</label>
            <input
              type="number" value={rsiOversold} onChange={(e) => setRsiOversold(Number(e.target.value))}
              min={10} max={50}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">RSI Overbought</label>
            <input
              type="number" value={rsiOverbought} onChange={(e) => setRsiOverbought(Number(e.target.value))}
              min={50} max={90}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
            />
          </div>
        </div>

        {/* SL/TP Multipliers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">SL (ATR ×)</label>
            <input
              type="number" value={slMultiplier} onChange={(e) => setSlMultiplier(Number(e.target.value))}
              step={0.5} min={0.5}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">TP (ATR ×)</label>
            <input
              type="number" value={tpMultiplier} onChange={(e) => setTpMultiplier(Number(e.target.value))}
              step={0.5} min={0.5}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
            />
          </div>
        </div>

        {/* Risk Settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Risk/Trade (%)</label>
            <input
              type="number" value={maxRisk} onChange={(e) => setMaxRisk(Number(e.target.value))}
              step={0.25} min={0.1} max={10}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Max Positions</label>
            <input
              type="number" value={maxPositions} onChange={(e) => setMaxPositions(Number(e.target.value))}
              min={1} max={10}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white focus:border-accent-gold outline-none"
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
            className="rounded bg-gray-800 border-gray-600"
          />
          <label htmlFor="trailing" className="text-xs text-gray-400">Trailing Stop</label>
          {trailingEnabled && (
            <div className="flex gap-2 ml-2">
              <input
                type="number" value={activationATR} onChange={(e) => setActivationATR(Number(e.target.value))}
                step={0.5} min={0.5}
                className="w-16 bg-gray-950/50 border border-gray-700/50 rounded-lg p-1 text-xs text-white text-center outline-none"
                title="Activation ATR"
              />
              <input
                type="number" value={trailATR} onChange={(e) => setTrailATR(Number(e.target.value))}
                step={0.1} min={0.1}
                className="w-16 bg-gray-950/50 border border-gray-700/50 rounded-lg p-1 text-xs text-white text-center outline-none"
                title="Trail ATR"
              />
            </div>
          )}
        </div>

        {/* Speed + Signal Interval */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3" /> Speed
            </label>
            <select
              value={speedMs}
              onChange={(e) => setSpeedMs(Number(e.target.value))}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white outline-none"
            >
              <option value={0}>⚡ Max</option>
              <option value={50}>Fast</option>
              <option value={200}>Normal</option>
              <option value={500}>🐢 Slow</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Signal Eval
            </label>
            <select
              value={signalInterval}
              onChange={(e) => setSignalInterval(Number(e.target.value))}
              className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-2.5 text-sm text-white outline-none"
            >
              <option value={1}>Every Candle</option>
              <option value={2}>Every 2nd</option>
              <option value={4}>Every 4th</option>
              <option value={8}>Every 8th</option>
              <option value={12}>Every 12th</option>
            </select>
          </div>
        </div>

        {/* Active Methodologies */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition"
          >
            <Layers className="w-3.5 h-3.5" />
            Methodologies ({activeMethodologies.length}/7)
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
                      : "bg-gray-800 text-gray-500 border border-gray-700"
                  }`}
                >
                  {m === "rsiEngulf" ? "RSI+E" : m.toUpperCase()}
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

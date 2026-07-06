"use client";

import { useState, useEffect } from "react";
import { aiTradingService, type SymbolInfo, type MethodologyName, type MethodologyWeights, METHODOLOGY_LABELS, METHODOLOGY_COLORS, DEFAULT_METHODOLOGY_WEIGHTS } from "@/services/ai-trading.service";
import { Play, Square, Pause, RotateCcw, Loader2, Signal, TrendingUp, Brain } from "lucide-react";
import { toast } from "sonner";

interface TradingPanelProps {
  isConnected: boolean;
  onStartPipeline: (config: any) => Promise<boolean>;
  onStopPipeline: () => Promise<void>;
  onPausePipeline: () => Promise<void>;
  onResumePipeline: () => Promise<void>;
  pipelineRunning: boolean;
  pipelinePaused: boolean;
  isStarting: boolean;
  isStopping: boolean;
}

const DEFAULT_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "AUDUSD"];

const ALL_METHODOLOGIES: MethodologyName[] = ["smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"];

export function TradingPanel({
  isConnected,
  onStartPipeline,
  onStopPipeline,
  onPausePipeline,
  onResumePipeline,
  pipelineRunning,
  pipelinePaused,
  isStarting,
  isStopping,
}: TradingPanelProps) {
  const [symbols, setSymbols] = useState<string[]>(["EURUSD", "XAUUSD"]);
  const [availableSymbols, setAvailableSymbols] = useState<SymbolInfo[]>([]);
  const [timeframe, setTimeframe] = useState<"M5" | "M15" | "H1">("M15");
  const [maxPositions, setMaxPositions] = useState(3);
  const [riskPerTrade, setRiskPerTrade] = useState(1.0);
  const [maxDailyRisk, setMaxDailyRisk] = useState(3.0);
  const [trailingEnabled, setTrailingEnabled] = useState(true);
  const [trailATR, setTrailATR] = useState(0.5);
  const [activationATR, setActivationATR] = useState(1.0);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [symbolInput, setSymbolInput] = useState("");

  // ── NEW: Methodology state ─────────────────────────────────────────
  const [activeMethodologies, setActiveMethodologies] = useState<MethodologyName[]>([...ALL_METHODOLOGIES]);
  const [methodologyWeights, setMethodologyWeights] = useState<MethodologyWeights>({ ...DEFAULT_METHODOLOGY_WEIGHTS });
  const [showMethodologyConfig, setShowMethodologyConfig] = useState(false);

  // ── NEW: LLM Consensus state ───────────────────────────────────────
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [llmThreshold, setLlmThreshold] = useState(0.5);

  // Load available symbols
  useEffect(() => {
    if (isConnected) {
      setLoadingSymbols(true);
      aiTradingService
        .getSymbols()
        .then((res) => {
          if (res.success && res.data?.symbols) {
            setAvailableSymbols(res.data.symbols);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingSymbols(false));
    }
  }, [isConnected]);

  const addSymbol = (sym: string) => {
    const s = sym.toUpperCase().trim();
    if (s && !symbols.includes(s)) {
      setSymbols([...symbols, s]);
    }
    setSymbolInput("");
  };

  const removeSymbol = (sym: string) => {
    setSymbols(symbols.filter((s) => s !== sym));
  };

  const toggleMethodology = (method: MethodologyName) => {
    setActiveMethodologies((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method],
    );
  };

  const updateWeight = (method: MethodologyName, weight: number) => {
    setMethodologyWeights((prev) => ({
      ...prev,
      [method]: Math.max(0, Math.min(2, weight)),
    }));
  };

  const handleStart = async () => {
    const config = {
      symbols,
      timeframe,
      strategy: "MULTI_METHODOLOGY",
      maxOpenPositions: maxPositions,
      maxRiskPerTrade: riskPerTrade,
      maxDailyRisk: maxDailyRisk,
      trailingStop: {
        enabled: trailingEnabled,
        activationATR,
        trailATR,
        breakEven: false,
      },
      entrySettings: {
        atrMultiplierSL: 1.5,
        atrMultiplierTP: 1.5,
        rsiOversold: 30,
        rsiOverbought: 70,
      },
      methodologyWeights,
      activeMethodologies,
      llmConsensus: {
        enabled: llmEnabled,
        threshold: llmThreshold,
        minProviders: 2,
        providerTimeoutMs: 8000,
      },
    };
    await onStartPipeline(config);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Signal className="w-4 h-4 text-accent-gold" />
          Trading Panel
        </h3>
        <button
          onClick={() => setShowMethodologyConfig(!showMethodologyConfig)}
          className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
            showMethodologyConfig
              ? "bg-accent-gold text-black font-semibold"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          <Brain className="w-3 h-3" />
          {activeMethodologies.length}/7
        </button>
      </div>

      {/* ── NEW: Methodology Configuration ─────────────────────────── */}
      {showMethodologyConfig && (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-300">Active Methodologies</span>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveMethodologies([...ALL_METHODOLOGIES])}
                className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded bg-gray-800"
              >
                All
              </button>
              <button
                onClick={() => setActiveMethodologies([])}
                className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded bg-gray-800"
              >
                None
              </button>
            </div>
          </div>

          {ALL_METHODOLOGIES.map((method) => (
            <div key={method} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={activeMethodologies.includes(method)}
                onChange={() => toggleMethodology(method)}
                className="rounded bg-gray-800 border-gray-600"
                style={{ accentColor: METHODOLOGY_COLORS[method] }}
              />
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: METHODOLOGY_COLORS[method] }}
              />
              <span className="flex-1 text-xs text-gray-300">
                {METHODOLOGY_LABELS[method]}
              </span>
              <input
                type="number"
                value={methodologyWeights[method]}
                onChange={(e) => updateWeight(method, parseFloat(e.target.value) || 0)}
                step={0.1}
                min={0}
                max={2}
                disabled={!activeMethodologies.includes(method)}
                className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] text-white text-right disabled:opacity-40"
              />
            </div>
          ))}
        </div>
      )}

      {/* Symbol Selection */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Trading Pairs</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {symbols.map((sym) => (
            <span
              key={sym}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-gold/10 text-accent-gold text-xs rounded-full"
            >
              {sym}
              <button
                onClick={() => removeSymbol(sym)}
                className="hover:text-red-400 transition"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addSymbol(symbolInput)}
            placeholder="Add symbol..."
            className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:border-accent-gold outline-none"
          />
          <button
            onClick={() => addSymbol(symbolInput)}
            className="px-2.5 py-1.5 bg-gray-800 text-gray-300 rounded text-xs hover:text-white transition"
          >
            +
          </button>
        </div>
        {availableSymbols.length > 0 && (
          <div className="mt-1 text-xs text-gray-500">
            {availableSymbols.length} symbols available on broker
          </div>
        )}
      </div>

      {/* Timeframe */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Timeframe</label>
        <div className="flex gap-1">
          {(["M5", "M15", "H1"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`flex-1 py-1.5 text-xs rounded font-medium transition ${
                timeframe === tf
                  ? "bg-accent-gold text-black font-semibold"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Risk Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Max Positions
          </label>
          <input
            type="number"
            value={maxPositions}
            onChange={(e) => setMaxPositions(Number(e.target.value))}
            min={1}
            max={10}
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Risk / Trade (%)
          </label>
          <input
            type="number"
            value={riskPerTrade}
            onChange={(e) => setRiskPerTrade(Number(e.target.value))}
            step={0.1}
            min={0.1}
            max={5}
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">
            Max Daily Risk (%)
          </label>
          <input
            type="number"
            value={maxDailyRisk}
            onChange={(e) => setMaxDailyRisk(Number(e.target.value))}
            step={0.5}
            min={1}
            max={10}
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
          />
        </div>
      </div>

      {/* Trailing Stop */}
      <div>
        <label className="flex items-center gap-2 text-xs text-gray-400 mb-1.5">
          <input
            type="checkbox"
            checked={trailingEnabled}
            onChange={(e) => setTrailingEnabled(e.target.checked)}
            className="rounded bg-gray-800 border-gray-600"
          />
          Trailing Stop
        </label>
        {trailingEnabled && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">
                Activation (ATR)
              </label>
              <input
                type="number"
                value={activationATR}
                onChange={(e) => setActivationATR(Number(e.target.value))}
                step={0.5}
                min={0.5}
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">
                Trail Distance (ATR)
              </label>
              <input
                type="number"
                value={trailATR}
                onChange={(e) => setTrailATR(Number(e.target.value))}
                step={0.1}
                min={0.1}
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── NEW: LLM Consensus Toggle ─────────────────────────────── */}
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <label className="flex items-center gap-2 text-xs text-gray-400 mb-1">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(e) => setLlmEnabled(e.target.checked)}
            className="rounded bg-gray-800 border-gray-600"
          />
          <span className="flex items-center gap-1.5">
            <Brain className="w-3 h-3 text-purple-400" />
            LLM Consensus Validation
          </span>
        </label>
        {llmEnabled && (
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">
              Approval Threshold ({Math.round(llmThreshold * 100)}%)
            </label>
            <input
              type="range"
              value={llmThreshold}
              onChange={(e) => setLlmThreshold(parseFloat(e.target.value))}
              min={0.3}
              max={0.9}
              step={0.05}
              className="w-full accent-accent-gold"
            />
            <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
              <span>30%</span>
              <span>50%</span>
              <span>90%</span>
            </div>
            <p className="text-[9px] text-gray-600 mt-1.5 leading-tight">
              Runs Claude + Gemini + Groq in parallel to validate each signal.
              Only executes if ≥{Math.round(llmThreshold * 100)}% of models approve.
            </p>
          </div>
        )}
      </div>

      {/* Pipeline Controls */}
      <div className="pt-2 border-t border-gray-800 space-y-2">
        {!pipelineRunning && !pipelinePaused && (
          <button
            onClick={handleStart}
            disabled={isStarting || symbols.length === 0 || activeMethodologies.length === 0}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Start Pipeline
          </button>
        )}

        {pipelineRunning && (
          <div className="flex gap-2">
            <button
              onClick={onPausePipeline}
              className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
            <button
              onClick={onStopPipeline}
              disabled={isStopping}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {isStopping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Stop
            </button>
          </div>
        )}

        {pipelinePaused && (
          <div className="flex gap-2">
            <button
              onClick={onResumePipeline}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Resume
            </button>
            <button
              onClick={onStopPipeline}
              disabled={isStopping}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {isStopping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            pipelineRunning
              ? "bg-green-400 animate-pulse"
              : pipelinePaused
                ? "bg-yellow-400"
                : "bg-gray-600"
          }`}
        />
        <span className="text-gray-500">
          {pipelineRunning
            ? "Pipeline running"
            : pipelinePaused
              ? "Pipeline paused"
              : "Pipeline stopped"}
        </span>
        {pipelineRunning && (
          <span className="text-gray-600">
            · {activeMethodologies.length} methodologies
          </span>
        )}
      </div>
    </div>
  );
}

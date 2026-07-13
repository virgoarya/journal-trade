"use client";

import { useState, useEffect } from "react";
import { aiTradingService, type SymbolInfo, type MethodologyName, type MethodologyWeights, type AIBacktestSkill } from "@/services/ai-trading.service";
import { DEFAULT_METHODOLOGY_WEIGHTS, METHODOLOGY_LABELS, METHODOLOGY_COLORS } from "../types";
import { useAiTrading } from "../context/AiTradingContext";
import { SymbolSelector } from "./SymbolSelector";
import { MethodologyConfig } from "./MethodologyConfig";
import { RiskSettings } from "./RiskSettings";
import { TrailingStopConfig } from "./TrailingStopConfig";
import { LlmConsensusConfig } from "./LlmConsensusConfig";
import { Play, Square, Pause, RotateCcw, Loader2, Signal, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface TradingPanelProps {
  pipelineRunning: boolean;
  pipelinePaused: boolean;
  isStarting: boolean;
  isStopping: boolean;
  /** Skill data to apply from AI Backtest Skill display */
  skillConfig?: AIBacktestSkill | null;
}

const DEFAULT_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "AUDUSD"];

const ALL_METHODOLOGIES: MethodologyName[] = ["smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"];

export function TradingPanel({
  pipelineRunning,
  pipelinePaused,
  isStarting,
  isStopping,
  skillConfig,
}: TradingPanelProps) {
  const {
    isConnected,
    startPipeline,
    stopPipeline,
    pausePipeline,
    resumePipeline,
    llmModels,
    llmLoading,
    activeMethodologies: ctxActiveMethodologies,
    setActiveMethodologies: ctxSetActiveMethodologies,
    methodologyWeights: ctxMethodologyWeights,
    setMethodologyWeights: ctxSetMethodologyWeights,
    showMethodologyConfig,
    setShowMethodologyConfig,
    llmEnabled,
    setLlmEnabled,
    llmThreshold,
    setLlmThreshold,
    llmMinProviders,
    setLlmMinProviders,
    llmProviderTimeoutMs,
    setLlmProviderTimeoutMs,
  } = useAiTrading();

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

  // Use context for methodology config
  const activeMethodologies = ctxActiveMethodologies;
  const setActiveMethodologies = ctxSetActiveMethodologies;
  const methodologyWeights = ctxMethodologyWeights;
  const setMethodologyWeights = ctxSetMethodologyWeights;

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

  // ── Apply skill config when received from SkillDisplay ─────────────────
  useEffect(() => {
    if (!skillConfig) return;
    const topSymbols = skillConfig.symbolRankings
      ?.filter(s => s.score >= 50)
      .slice(0, 5)
      .map(s => s.symbol);
    if (topSymbols && topSymbols.length > 0) {
      setSymbols(topSymbols);
    }
    const disabled = (skillConfig.methodologyRankings || [])
      .filter(m => m.verdict === "DISABLE")
      .map(m => m.methodology);
    if (disabled.length > 0) {
      setActiveMethodologies(
        ALL_METHODOLOGIES.filter(m => !disabled.includes(m)),
      );
    }
    setRiskPerTrade(0.5);
  }, [skillConfig, setActiveMethodologies]);

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
        minProviders: llmMinProviders,
        providerTimeoutMs: llmProviderTimeoutMs,
      },
    };
    await startPipeline(config);
  };

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Signal className="w-4 h-4 text-accent-gold" />
          Trading Panel
        </h3>
        <MethodologyConfig
          activeMethodologies={activeMethodologies}
          methodologyWeights={methodologyWeights}
          onToggleMethodology={toggleMethodology}
          onUpdateWeight={updateWeight}
          showConfig={showMethodologyConfig}
          onToggleConfig={() => setShowMethodologyConfig(!showMethodologyConfig)}
        />
      </div>

      {/* Symbol Selection */}
      <SymbolSelector
        symbols={symbols}
        onAddSymbol={addSymbol}
        onRemoveSymbol={removeSymbol}
        availableSymbols={availableSymbols}
        loadingSymbols={loadingSymbols}
      />

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
      <RiskSettings
        maxPositions={maxPositions}
        riskPerTrade={riskPerTrade}
        maxDailyRisk={maxDailyRisk}
        onMaxPositionsChange={setMaxPositions}
        onRiskPerTradeChange={setRiskPerTrade}
        onMaxDailyRiskChange={setMaxDailyRisk}
      />

      {/* Trailing Stop */}
      <TrailingStopConfig
        enabled={trailingEnabled}
        activationATR={activationATR}
        trailATR={trailATR}
        onToggle={setTrailingEnabled}
        onActivationATRChange={setActivationATR}
        onTrailATRChange={setTrailATR}
      />

      {/* ── NEW: LLM Consensus Toggle ─────────────────────────────── */}
      <LlmConsensusConfig
        enabled={llmEnabled}
        threshold={llmThreshold}
        minProviders={llmMinProviders}
        providerTimeoutMs={llmProviderTimeoutMs}
        models={llmModels}
        loading={llmLoading}
        onToggle={setLlmEnabled}
        onThresholdChange={setLlmThreshold}
        onMinProvidersChange={setLlmMinProviders}
        onProviderTimeoutChange={setLlmProviderTimeoutMs}
      />

      {/* Pipeline Controls */}
      <div className="pt-2 border-t border-gray-800 space-y-2" role="group" aria-label="Pipeline controls">
        {!pipelineRunning && !pipelinePaused && (
          <button
            onClick={handleStart}
            disabled={isStarting || symbols.length === 0 || activeMethodologies.length === 0}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            aria-label={isStarting ? "Starting pipeline..." : "Start pipeline"}
            aria-disabled={isStarting || symbols.length === 0 || activeMethodologies.length === 0}
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span className="sr-only">Starting...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Start Pipeline</span>
              </>
            )}
          </button>
        )}

        {pipelineRunning && (
          <div className="flex gap-2" role="group" aria-label="Running pipeline actions">
            <button
              onClick={pausePipeline}
              className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
              aria-label="Pause pipeline"
            >
              <Pause className="w-4 h-4" aria-hidden="true" />
              <span>Pause</span>
            </button>
            <button
              onClick={stopPipeline}
              disabled={isStopping}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
              aria-label={isStopping ? "Stopping pipeline..." : "Stop pipeline"}
              aria-disabled={isStopping}
            >
              {isStopping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Stopping...</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" aria-hidden="true" />
                  <span>Stop</span>
                </>
              )}
            </button>
          </div>
        )}

        {pipelinePaused && (
          <div className="flex gap-2" role="group" aria-label="Paused pipeline actions">
            <button
              onClick={resumePipeline}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
              aria-label="Resume pipeline"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Resume</span>
            </button>
            <button
              onClick={stopPipeline}
              disabled={isStopping}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
              aria-label={isStopping ? "Stopping pipeline..." : "Stop pipeline"}
              aria-disabled={isStopping}
            >
              {isStopping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Stopping...</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" aria-hidden="true" />
                  <span>Stop</span>
                </>
              )}
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

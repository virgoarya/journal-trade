"use client";

import { useState, useEffect } from "react";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { AccountOverview } from "./components/AccountOverview";
import { PositionsTable } from "./components/PositionsTable";
import { TradingPanel } from "./components/TradingPanel";
import { MethodologyConfluence } from "./components/MethodologyConfluence";
import { PipelinePerformance } from "./components/PipelinePerformance";
import { SkillDisplay } from "./components/SkillDisplay";
import { PipelineLogs } from "./components/PipelineLogs";
import { BacktestTab } from "./components/BacktestTab";
import { useMT5Connection } from "./hooks/useMT5Connection";
import { useAccountInfo } from "./hooks/useAccountInfo";
import { usePositions } from "./hooks/usePositions";
import { usePipeline } from "./hooks/usePipeline";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, Activity } from "lucide-react";
import { Suspense } from "react";
import type { AIBacktestSkill } from "@/services/ai-trading.service";

type Tab = "trading" | "backtest";

export default function AITradingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
      </div>
    }>
      <AITradingPageContent />
    </Suspense>
  );
}

function AITradingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>("trading");

  useEffect(() => {
    if (tabParam === "backtest" || tabParam === "trading") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const { isConnected, isConnecting, error, connect, disconnect } =
    useMT5Connection();
  const { accountInfo, isLoading: accountLoading, refetch: refetchAccount } =
    useAccountInfo();
  const { positions, isLoading: posLoading, closePosition, modifyPosition } =
    usePositions(10000, isConnected);
  const {
    status: pipelineStatus,
    lastAnalysis,
    logs,
    isStarting,
    isStopping,
    start,
    stop,
    pause,
    resume,
    refresh: refreshPipeline,
  } = usePipeline();
  const [skillConfig, setSkillConfig] = useState<AIBacktestSkill | null>(null);
  const [skillVersion, setSkillVersion] = useState(0);

  // Refresh pipeline state on mount
  useEffect(() => {
    refreshPipeline();
  }, [isConnected, refreshPipeline]);

  // If not connected, show connection panel
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black">
        <div className="p-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
        <ConnectionPanel
          onConnect={connect}
          isConnecting={isConnecting}
          error={error}
        />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "trading", label: "Trading", icon: Activity },
    { key: "backtest", label: "Backtest", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-black p-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <span className="text-gray-600">|</span>
          <h1 className="text-lg font-semibold text-white">AI Trading</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    isActive
                      ? "bg-accent-gold text-black shadow-sm font-semibold"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Disconnect button — only show on trading tab */}
          {activeTab === "trading" && (
            <button
              onClick={disconnect}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition"
            >
              Disconnect MT5
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "trading" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Main content */}
          <div className="lg:col-span-2 space-y-4">
            <AccountOverview
              accountInfo={accountInfo}
              isLoading={accountLoading}
            />

            <PositionsTable
              positions={positions}
              onClose={closePosition}
              onModify={modifyPosition}
              isLoading={posLoading}
            />

            {pipelineStatus?.running && (
              <PipelineLogs logs={logs} />
            )}
          </div>

          {/* Right: Trading panel */}
          <div className="space-y-4">
            <TradingPanel
              isConnected={isConnected}
              onStartPipeline={start}
              onStopPipeline={stop}
              onPausePipeline={pause}
              onResumePipeline={resume}
              pipelineRunning={pipelineStatus?.running ?? false}
              pipelinePaused={pipelineStatus?.paused ?? false}
              isStarting={isStarting}
              isStopping={isStopping}
              skillConfig={skillConfig}
            />

            {/* Methodology Confluence Display */}
            {lastAnalysis?.confluence && (
              <MethodologyConfluence
                confluence={lastAnalysis.confluence}
                marketStructure={lastAnalysis.marketStructure}
              />
            )}

            {/* AI Backtest Skill — rankings, verdicts, auto-scan */}
            <SkillDisplay key={skillVersion} onApplySkill={(skill) => {
              setSkillConfig(skill);
            }} />

            {/* Pipeline Performance — live methodology & symbol stats */}
            <PipelinePerformance />

            {/* Pipeline status summary */}
            {pipelineStatus && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Pipeline Stats
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Total Trades</span>
                    <p className="text-white font-medium">
                      {pipelineStatus.metrics.totalTrades}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Win/Loss</span>
                    <p className="text-white font-medium">
                      {pipelineStatus.metrics.winningTrades}/
                      {pipelineStatus.metrics.losingTrades}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total P&L</span>
                    <p
                      className={`font-medium ${
                        pipelineStatus.metrics.totalPnL >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      ${pipelineStatus.metrics.totalPnL.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Open Positions</span>
                    <p className="text-white font-medium">
                      {pipelineStatus.metrics.openPositions}
                    </p>
                  </div>
                </div>

                {pipelineStatus.lastSignal && (
                  <div className="pt-2 border-t border-gray-800">
                    <span className="text-xs text-gray-500">Last Signal</span>
                    <p className="text-xs text-white mt-0.5">
                      {pipelineStatus.lastSignal.symbol}{" "}
                      <span
                        className={
                          pipelineStatus.lastSignal.direction === "BUY"
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {pipelineStatus.lastSignal.direction}
                      </span>{" "}
                      · Confidence: {pipelineStatus.lastSignal.confidence}%
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {pipelineStatus.lastSignal.reason}
                    </p>
                  </div>
                )}

                {pipelineStatus.lastError && (
                  <div className="pt-2 border-t border-gray-800">
                    <span className="text-xs text-red-400">
                      Last Error: {pipelineStatus.lastError}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "backtest" && <BacktestTab onBacktestComplete={() => setSkillVersion(v => v + 1)} />}
    </div>
  );
}

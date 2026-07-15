"use client";

import { useState, useEffect } from "react";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { AccountOverview } from "./components/AccountOverview";
import { PositionsTable } from "./components/PositionsTable";
import { PendingOrdersTable } from "./components/PendingOrdersTable";
import { TradingPanel } from "./components/TradingPanel";
import { MethodologyConfluence } from "./components/MethodologyConfluence";
import { PipelinePerformance } from "./components/PipelinePerformance";
import { SkillDisplay } from "./components/SkillDisplay";
import { PipelineLogs } from "./components/PipelineLogs";
import { LLMConsensusViz } from "./components/LLMConsensusViz";
import { BacktestTab } from "./components/BacktestTab";
import { CorrelationHeatmap } from "./components/CorrelationHeatmap";
import { AiTradingProvider, useAiTrading } from "./context/AiTradingContext";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, Activity, Settings2, X } from "lucide-react";
import { Suspense } from "react";

type Tab = "trading" | "backtest";

export default function AITradingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
      </div>
    }>
      <AiTradingProvider>
        <AITradingPageContent />
      </AiTradingProvider>
    </Suspense>
  );
}

function AITradingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>("trading");
  const [isTradingDrawerOpen, setIsTradingDrawerOpen] = useState(false);

  const {
    isConnected,
    isConnecting,
    connectError,
    connectMT5,
    disconnectMT5,
    accountInfo,
    accountLoading,
    refetchAccountInfo,
    positions,
    orders,
    positionsLoading,
    positionsError,
    closePosition,
    modifyPosition,
    refetchPositions,
    pipelineStatus,
    pipelineLogs,
    isPipelineStarting,
    isPipelineStopping,
    lastAnalysis,
    lastLlmVotes,
    llmModels,
    skillConfig,
    setSkillConfig,
    skillVersion,
    setSkillVersion,
    refreshPipelineData,
  } = useAiTrading();

  useEffect(() => {
    if (tabParam === "backtest" || tabParam === "trading") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (isConnected) {
      refetchAccountInfo();
      refetchPositions();
      refreshPipelineData();
    }
  }, [isConnected, refetchAccountInfo, refetchPositions, refreshPipelineData]);

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
          onConnect={connectMT5}
          isConnecting={isConnecting}
          error={connectError}
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
      <header className="flex items-center justify-between mb-4">
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

          {activeTab === "trading" && (
            <button
              onClick={disconnectMT5}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition"
            >
              Disconnect MT5
            </button>
          )}
        </div>
      </header>

      {/* Tab Content */}
      {activeTab === "trading" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Left: Main content */}
          <div className="md:col-span-2 xl:col-span-3 space-y-4">
            <AccountOverview
              accountInfo={accountInfo}
              isLoading={accountLoading}
            />

            <PositionsTable
              positions={positions}
              onClose={closePosition}
              onModify={modifyPosition}
              isLoading={positionsLoading}
              error={positionsError}
              onRetry={refetchPositions}
            />

            <PendingOrdersTable
              orders={orders}
              onCancel={closePosition}
            />

            {/* <CorrelationHeatmap /> */}

            {pipelineStatus?.running && (
              <>
                <PipelineLogs logs={pipelineLogs} config={pipelineStatus.config} />

                <LLMConsensusViz
                  votes={lastLlmVotes}
                  modelStatus={llmModels}
                  threshold={pipelineStatus.config?.llmConsensus?.threshold ?? 0.5}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PipelinePerformance />

                  {pipelineStatus && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 h-fit">
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
                            {pipelineStatus.metrics.winningTrades}/{pipelineStatus.metrics.losingTrades}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total P&L</span>
                          <p className={`font-medium ${pipelineStatus.metrics.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
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
                          <p className="text-xs text-white mt-0.5 font-mono">
                            {pipelineStatus.lastSignal.symbol}{" "}
                            <span className={pipelineStatus.lastSignal.direction === "BUY" ? "text-green-400" : "text-red-400"}>
                              {pipelineStatus.lastSignal.direction}
                            </span>{" "}
                            · Conf: {pipelineStatus.lastSignal.confidence}%
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
              </>
            )}
          </div>

          {/* Floating Mobile Settings Button */}
          <button 
            onClick={() => setIsTradingDrawerOpen(true)}
            className="xl:hidden fixed bottom-6 right-6 z-40 bg-accent-gold text-black p-4 rounded-full shadow-lg shadow-accent-gold/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center touch-target"
          >
            <Settings2 className="w-6 h-6" />
          </button>

          {/* Right: Trading panel (Mobile Drawer + Desktop Sidebar) */}
          <div className={`
            space-y-4 transition-all duration-300
            ${isTradingDrawerOpen 
              ? 'fixed inset-0 z-50 bg-black/90 p-4 pt-16 overflow-y-auto block' 
              : 'hidden xl:block'
            }
          `}>
            {/* Mobile Close Button */}
            {isTradingDrawerOpen && (
              <button 
                onClick={() => setIsTradingDrawerOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-900 rounded-full p-2 touch-target"
              >
                <X className="w-6 h-6" />
              </button>
            )}

            <TradingPanel
              pipelineRunning={pipelineStatus?.running ?? false}
              pipelinePaused={pipelineStatus?.paused ?? false}
              isStarting={isPipelineStarting}
              isStopping={isPipelineStopping}
              skillConfig={skillConfig}
            />

            {lastAnalysis?.confluence && (
              <MethodologyConfluence
                confluence={lastAnalysis.confluence}
                marketStructure={lastAnalysis.marketStructure}
                symbol={lastAnalysis.symbol}
              />
            )}

            <SkillDisplay key={skillVersion} onApplySkill={(skill) => {
              setSkillConfig(skill);
              if (isTradingDrawerOpen) setIsTradingDrawerOpen(false);
            }} />
          </div>
        </div>
      )}

      {activeTab === "backtest" && <BacktestTab onBacktestComplete={() => setSkillVersion(skillVersion + 1)} />}
    </div>
  );
}

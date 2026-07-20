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
import { ArrowLeft, BarChart3, Activity, Settings2, X, Brain } from "lucide-react";
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
    isReconnecting,
    isConnecting,
    isCheckingSession,
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
    if (isCheckingSession) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen relative z-10 flex flex-col pt-4">
        <div className="px-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-text-muted hover:text-accent-gold transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <ConnectionPanel
            onConnect={connectMT5}
            isConnecting={isConnecting}
            error={connectError}
          />
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "trading", label: "Trading", icon: Activity },
    { key: "backtest", label: "Backtest", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen p-4 pb-24 relative z-10 font-mono">
      {/* Reconnecting Overlay */}
      {isReconnecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl border border-accent-gold/20 bg-black/50">
            <div className="w-12 h-12 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
            <h2 className="text-xl font-bold text-accent-gold animate-pulse tracking-widest">
              RECONNECTING TO MT5...
            </h2>
            <p className="text-sm text-text-muted text-center max-w-xs">
              Connection to terminal was lost. Auto-recovering session...
            </p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between mb-6 glass p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-accent-gold-dim hover:text-accent-gold transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="tracking-wider uppercase text-xs">Menu</span>
          </button>
          <span className="text-accent-gold-dim/50">|</span>
          <h1 className="text-sm tracking-[0.2em] font-semibold text-accent-gold uppercase drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]">
            AI Trading HUD
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-black/40 rounded-lg p-0.5 border border-accent-gold/20 backdrop-blur-md">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs tracking-wider uppercase rounded-md transition ${
                    isActive
                      ? "bg-accent-gold/20 text-accent-gold shadow-[inset_0_0_8px_rgba(212,175,55,0.4)] border border-accent-gold/40"
                      : "text-text-muted hover:text-accent-gold"
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
              className="px-4 py-1.5 bg-black/40 hover:bg-red-900/40 text-text-muted hover:text-red-400 text-xs tracking-wider uppercase rounded-lg border border-accent-gold/20 hover:border-red-500/50 transition-all shadow-[0_0_10px_rgba(255,0,0,0)] hover:shadow-[0_0_10px_rgba(255,0,0,0.2)]"
            >
              Disconnect
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

            <LLMConsensusViz
              votes={lastLlmVotes}
              modelStatus={llmModels}
              threshold={pipelineStatus?.config?.llmConsensus?.threshold ?? 0.5}
            />

            {pipelineStatus?.running && (
              <>
                <PipelineLogs logs={pipelineLogs} config={pipelineStatus.config} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PipelinePerformance />

                  {pipelineStatus && (
                    <div className="glass p-5 space-y-3 h-fit flex flex-col">
                      <h4 className="text-[10px] font-semibold text-accent-gold/70 uppercase tracking-widest border-b border-accent-gold/20 pb-2 mb-2">
                        Pipeline Data Stream
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-black/30 p-2 rounded border border-accent-gold/10">
                          <span className="text-accent-gold-dim text-[9px] uppercase tracking-wider block mb-1">Total Trades</span>
                          <p className="text-text-primary font-bold text-lg font-mono">
                            {pipelineStatus.metrics.totalTrades}
                          </p>
                        </div>
                        <div className="bg-black/30 p-2 rounded border border-accent-gold/10">
                          <span className="text-accent-gold-dim text-[9px] uppercase tracking-wider block mb-1">Win/Loss</span>
                          <p className="text-text-primary font-bold text-lg font-mono">
                            <span className="text-neon-green">{pipelineStatus.metrics.winningTrades}</span>
                            <span className="text-text-muted mx-1">/</span>
                            <span className="text-neon-red">{pipelineStatus.metrics.losingTrades}</span>
                          </p>
                        </div>
                        <div className="bg-black/30 p-2 rounded border border-accent-gold/10">
                          <span className="text-accent-gold-dim text-[9px] uppercase tracking-wider block mb-1">Total P&L</span>
                          <p className={`font-bold text-lg font-mono drop-shadow-md ${pipelineStatus.metrics.totalPnL >= 0 ? "text-neon-green shadow-neon-green" : "text-neon-red shadow-neon-red"}`}>
                            ${pipelineStatus.metrics.totalPnL.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-black/30 p-2 rounded border border-accent-gold/10">
                          <span className="text-accent-gold-dim text-[9px] uppercase tracking-wider block mb-1">Open Positions</span>
                          <p className="text-text-primary font-bold text-lg font-mono">
                            {pipelineStatus.metrics.openPositions}
                          </p>
                        </div>
                      </div>

                      {pipelineStatus.lastSignal && (
                        <div className="pt-3 mt-auto border-t border-accent-gold/20 relative flex flex-col flex-1 min-h-[120px]">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-gold/5 to-transparent terminal-scanline pointer-events-none" />
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-accent-gold uppercase tracking-widest font-bold flex items-center gap-1.5">
                              <Brain className="w-3.5 h-3.5" /> AI Reasoning Trace
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-text-primary font-bold font-mono bg-black/60 px-1.5 py-0.5 rounded border border-accent-gold/30">
                                {pipelineStatus.lastSignal.symbol}
                              </span>
                              <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${pipelineStatus.lastSignal.direction === "BUY" ? "text-neon-green border-neon-green/30 bg-neon-green/10" : "text-neon-red border-neon-red/30 bg-neon-red/10"}`}>
                                {pipelineStatus.lastSignal.direction}
                              </span>
                              <span className="text-[10px] text-accent-gold font-mono border-l border-accent-gold/20 pl-2">
                                {pipelineStatus.lastSignal.confidence}% Conf
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 bg-black/60 border border-accent-gold/20 rounded p-2 overflow-y-auto max-h-[150px] custom-scrollbar">
                            <p className="text-[10px] text-text-muted font-mono leading-relaxed whitespace-pre-wrap">
                              {pipelineStatus.lastSignal.reason}
                            </p>
                          </div>
                        </div>
                      )}

                      {pipelineStatus.lastError && (
                        <div className="pt-2 border-t border-neon-red/30 bg-neon-red/5 p-2 rounded mt-2">
                          <span className="text-xs text-neon-red font-mono">
                            [ERROR]: {pipelineStatus.lastError}
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

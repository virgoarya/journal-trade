"use client";

import { useState, useEffect } from "react";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { AccountOverview } from "./components/AccountOverview";
import { PositionsTable } from "./components/PositionsTable";
import { PendingOrdersTable } from "./components/PendingOrdersTable";
import { TradingPanel } from "./components/TradingPanel";
import { MethodologyConfluence } from "./components/MethodologyConfluence";
import { PipelinePerformance } from "./components/PipelinePerformance";
import { AITradeHistories } from "./components/AITradeHistories";
import { SkillDisplay } from "./components/SkillDisplay";
import { PipelineLogs } from "./components/PipelineLogs";
import { LLMConsensusViz } from "./components/LLMConsensusViz";

import { BacktestTab } from "./components/BacktestTab";
import { CorrelationHeatmap } from "./components/CorrelationHeatmap";
import { AiTradingProvider, useAiTrading } from "./context/AiTradingContext";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, Activity, Settings2, X, Brain, Loader2 } from "lucide-react";
import { Suspense } from "react";
import { brokerRegistrationService } from "@/services/broker-registration.service";
import { useSession } from "@/lib/auth-client";

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
  const { data: session, isPending: sessionPending } = useSession();
  const [regCheck, setRegCheck] = useState<"loading" | "dev" | "ok" | "redirect">("loading");
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

  useEffect(() => {
    if (sessionPending) return;

    (async () => {
      try {
        const devCheck = await brokerRegistrationService.checkDevStatus();
        if (devCheck.success && devCheck.data?.isDev) {
          setRegCheck("dev");
          return;
        }

        const status = await brokerRegistrationService.getStatus();
        if (status.success && status.data?.needsRegistration === false) {
          setRegCheck("ok");
        } else {
          setRegCheck("redirect");
        }
      } catch {
        setRegCheck("ok");
      }
    })();
  }, [sessionPending]);

  useEffect(() => {
    if (regCheck === "redirect") {
      router.push("/broker-registration");
    }
  }, [regCheck, router]);

  if (regCheck === "loading" || sessionPending) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  if (regCheck === "redirect") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen relative z-10 flex flex-col pt-4">
        <div className="px-4">
          <button
            onClick={() => router.push("/broker-registration")}
            className="flex items-center gap-2 text-text-muted hover:text-accent-gold transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Switch Broker
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
    <div className="min-h-screen p-4 pb-24 font-mono">
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
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 glass p-3">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
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

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex w-full sm:w-auto justify-center bg-black/40 rounded-lg p-0.5 border border-accent-gold/20 backdrop-blur-md">
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
                  <PipelinePerformance triggerRefresh={pipelineStatus?.metrics?.totalTrades} />

                  <AITradeHistories triggerRefresh={pipelineStatus?.metrics?.totalTrades} />
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
            transition-all duration-300
            ${isTradingDrawerOpen 
              ? 'fixed inset-0 z-50 flex flex-col bg-black/95 xl:static xl:z-auto xl:bg-transparent xl:block' 
              : 'hidden xl:block'
            }
          `}>
            {/* Mobile Header (Close Button) */}
            {isTradingDrawerOpen && (
              <div className="flex-none p-4 border-b border-accent-gold/20 flex justify-between items-center bg-black/95 xl:hidden z-[60]">
                <span className="text-accent-gold font-bold tracking-widest uppercase text-sm font-mono">Settings & Config</span>
                <button 
                  onClick={() => setIsTradingDrawerOpen(false)}
                  className="text-gray-400 hover:text-white bg-gray-800 rounded-full p-2 flex items-center justify-center active:scale-95 transition-all"
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className={`
              ${isTradingDrawerOpen ? 'flex-1 overflow-y-auto p-4 space-y-4 xl:p-0 xl:overflow-visible' : 'space-y-4'}
            `}>
              <TradingPanel
                pipelineRunning={pipelineStatus?.running ?? false}
              pipelinePaused={pipelineStatus?.paused ?? false}
              isStarting={isPipelineStarting}
              isStopping={isPipelineStopping}
              skillConfig={skillConfig}
            />

            <MethodologyConfluence
              confluence={lastAnalysis?.confluence}
              marketStructure={lastAnalysis?.marketStructure}
              symbol={lastAnalysis?.symbol}
              isRunning={pipelineStatus?.running ?? false}
            />

            <SkillDisplay key={skillVersion} server={accountInfo?.server} onApplySkill={(skill) => {
              setSkillConfig(skill);
              if (isTradingDrawerOpen) setIsTradingDrawerOpen(false);
            }} />
            </div>

            {/* Mobile Footer (Close Button Backup) */}
            {isTradingDrawerOpen && (
              <div className="flex-none p-4 pb-8 bg-black border-t border-accent-gold/20 xl:hidden z-[60]">
                <button 
                  onClick={() => setIsTradingDrawerOpen(false)}
                  className="w-full py-3 bg-red-900/40 hover:bg-red-800/60 text-red-100 rounded-xl border border-red-500/30 flex items-center justify-center gap-2 font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(255,0,0,0.2)]"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Tutup Panel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "backtest" && <BacktestTab onBacktestComplete={() => setSkillVersion(skillVersion + 1)} onApplyToPipeline={() => setSkillVersion(skillVersion + 1)} />}
    </div>
  );
}

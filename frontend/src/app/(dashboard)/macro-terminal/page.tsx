"use client";

import React, { useState, useEffect } from "react";
import { Activity, BarChart3, Droplets, Newspaper, MessageSquare, TrendingUp } from "lucide-react";
import { MacroRegimePanel } from "@/components/macro-terminal/MacroRegimePanel";
import { LiquidityGaugePanel } from "@/components/macro-terminal/LiquidityGaugePanel";
import { HeatmapPanel } from "@/components/macro-terminal/HeatmapPanel";
import { NewsFeedPanel } from "@/components/macro-terminal/NewsFeedPanel";
import { TerminalChatPanel } from "@/components/macro-terminal/TerminalChatPanel";
import { MacroTerminalProvider } from "@/components/macro-terminal/MacroTerminalContext";

type MobileTab = "market" | "ai";

export default function MacroTerminalPage() {
  const [activeTab, setActiveTab] = useState<MobileTab>("market");

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setActiveTab("market");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <MacroTerminalProvider>
      <div className="flex flex-col h-[calc(100vh-8rem)] w-full max-w-[1600px] mx-auto gap-4">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
              <Activity className="w-6 h-6 text-accent-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono text-text-primary tracking-wide">
                MACRO <span className="text-accent-gold">TERMINAL</span>
              </h1>
              <p className="text-xs text-text-secondary font-mono tracking-widest uppercase">
                Global Macro & Institutional Flow Dashboard
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-data-profit animate-pulse" />
              <span className="text-text-muted">MARKET DATA:</span>
              <span className="text-data-profit">CONNECTED</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-data-profit animate-pulse" />
              <span className="text-text-muted">AI ENGINE:</span>
              <span className="text-data-profit">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 overflow-hidden">
          <div className="flex flex-col gap-4 lg:col-span-1 xl:col-span-1 h-full overflow-hidden">
            <div className="h-64 shrink-0">
              <MacroRegimePanel />
            </div>
            <div className="h-32 shrink-0">
              <LiquidityGaugePanel />
            </div>
            <div className="flex-1 min-h-0">
              <NewsFeedPanel />
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:col-span-2 xl:col-span-3 h-full overflow-hidden">
            <div className="flex-1 min-h-0">
              <HeatmapPanel />
            </div>
            <div className="h-80 shrink-0">
              <TerminalChatPanel />
            </div>
          </div>
        </div>

        {/* Mobile/tablet tabbed layout */}
        <div className="flex flex-1 flex-col overflow-hidden lg:hidden">
          <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-surface/80 px-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab("market")}
              className={`flex items-center gap-2 rounded-t-lg px-3 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
                activeTab === "market"
                  ? "border-b-2 border-accent-gold text-accent-gold"
                  : "text-text-secondary"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Market
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-2 rounded-t-lg px-3 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
                activeTab === "ai"
                  ? "border-b-2 border-accent-gold text-accent-gold"
                  : "text-text-secondary"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Hunter Desk AI
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "market" ? (
              <div className="h-full overflow-y-auto p-3 space-y-3">
                <div className="h-56">
                  <MacroRegimePanel />
                </div>
                <div className="h-28">
                  <LiquidityGaugePanel />
                </div>
                <div className="h-[55%]">
                  <NewsFeedPanel />
                </div>
              </div>
            ) : (
              <div className="h-full p-3">
                <div className="h-full glass border border-border-subtle rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
                    <span className="flex items-center gap-2 text-[10px] font-mono font-bold text-accent-gold uppercase tracking-widest">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Heatmap & AI Reasoning
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                      Macro Terminal
                    </span>
                  </div>
                  <div className="h-[calc(100%-38px)] overflow-y-auto">
                    <HeatmapPanel />
                  </div>
                </div>
                <div className="mt-3 h-64">
                  <TerminalChatPanel />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MacroTerminalProvider>
  );
}

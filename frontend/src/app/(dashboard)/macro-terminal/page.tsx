"use client";

import React from "react";
import { Activity } from "lucide-react";
import { MacroRegimePanel } from "@/components/macro-terminal/MacroRegimePanel";
import { LiquidityGaugePanel } from "@/components/macro-terminal/LiquidityGaugePanel";
import { HeatmapPanel } from "@/components/macro-terminal/HeatmapPanel";
import { NewsFeedPanel } from "@/components/macro-terminal/NewsFeedPanel";
import { TerminalChatPanel } from "@/components/macro-terminal/TerminalChatPanel";
import { MacroTerminalProvider } from "@/components/macro-terminal/MacroTerminalContext";
import { ErrorBoundary } from "@/components/macro-terminal/ErrorBoundary";

export default function MacroTerminalPage() {
  return (
    <ErrorBoundary>
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

        {/* Grid Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-hidden">
          
          {/* Left Column (Regime + Liquidity + News) */}
          <div className="flex flex-col gap-4 lg:col-span-1 xl:col-span-1 h-full overflow-hidden">
            {/* Top Left: Regime Matrix (fixed height) */}
            <div className="h-64 shrink-0">
              <MacroRegimePanel />
            </div>

            {/* Middle Left: Liquidity Gauge (fixed height) */}
            <div className="h-32 shrink-0">
              <LiquidityGaugePanel />
            </div>

            {/* Bottom Left: News Feed (takes remaining height) */}
            <div className="flex-1 min-h-0">
              <NewsFeedPanel />
            </div>
          </div>

          {/* Right Column (Heatmap + Chat) */}
          <div className="flex flex-col gap-4 lg:col-span-2 xl:col-span-3 h-full overflow-hidden">
            {/* Top Right: Heatmap (takes remaining height to show AI reasoning) */}
            <div className="flex-1 min-h-0">
              <HeatmapPanel />
            </div>

            {/* Bottom Right: Terminal Chat (fixed smaller height) */}
            <div className="h-80 shrink-0">
              <TerminalChatPanel />
            </div>
          </div>

        </div>
      </div>
      </MacroTerminalProvider>
    </ErrorBoundary>
  );
}

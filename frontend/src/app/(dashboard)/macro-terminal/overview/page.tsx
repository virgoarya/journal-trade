"use client";

import React from "react";
import { MacroRegimePanel } from "@/components/macro-terminal/MacroRegimePanel";
import { LiquidityGaugePanel } from "@/components/macro-terminal/LiquidityGaugePanel";
import { HeatmapPanel } from "@/components/macro-terminal/HeatmapPanel";
import { NewsFeedPanel } from "@/components/macro-terminal/NewsFeedPanel";
import { TerminalChatPanel } from "@/components/macro-terminal/TerminalChatPanel";

export default function MacroOverviewPage() {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full overflow-hidden">
      {/* Left Column (Regime + Liquidity + News) */}
      <div className="flex flex-col gap-4 lg:col-span-1 xl:col-span-1 h-full overflow-hidden">
        {/* Top Left: Regime Matrix (fixed height) */}
        <div className="h-52 shrink-0">
          <MacroRegimePanel />
        </div>

        {/* Middle Left: Liquidity Gauge (fixed height) */}
        <div className="h-44 shrink-0">
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
  );
}

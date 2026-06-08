"use client";

import React from "react";
import { MacroRegimePanel } from "@/components/macro-terminal/MacroRegimePanel";
import { LiquidityGaugePanel } from "@/components/macro-terminal/LiquidityGaugePanel";
import { HeatmapPanel } from "@/components/macro-terminal/HeatmapPanel";
import { NewsFeedPanel } from "@/components/macro-terminal/NewsFeedPanel";
import { EconomicCalendarPanel } from "@/components/macro-terminal/EconomicCalendarPanel";

export default function MacroOverviewPage() {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full overflow-visible">
      {/* Left Column */}
      <div className="flex flex-col gap-4 lg:col-span-1 xl:col-span-1 h-full overflow-visible">
        {/* Top Left: Regime Matrix (50% of heatmap height) */}
        <div className="flex-1 min-h-0 overflow-visible">
          <MacroRegimePanel />
        </div>

        {/* Middle Left: Liquidity Gauge (50% of heatmap height) */}
        <div className="flex-1 min-h-0 overflow-visible">
          <LiquidityGaugePanel />
        </div>

        {/* Bottom Left: News Feed (same height as Economic Calendar) */}
        <div className="h-80 shrink-0 overflow-visible">
          <NewsFeedPanel />
        </div>
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-4 lg:col-span-2 xl:col-span-3 h-full overflow-visible">
        {/* Top Right: Heatmap */}
        <div className="flex-1 min-h-0 overflow-visible">
          <HeatmapPanel />
        </div>

        {/* Bottom Right: Economic Calendar */}
        <div className="h-80 shrink-0 overflow-visible">
          <EconomicCalendarPanel />
        </div>
      </div>
    </div>
  );
}

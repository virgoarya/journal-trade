"use client";

import React from "react";
import { MacroRegimePanel } from "@/components/macro-terminal/MacroRegimePanel";
import { LiquidityGaugePanel } from "@/components/macro-terminal/LiquidityGaugePanel";
import { HeatmapPanel } from "@/components/macro-terminal/HeatmapPanel";
import { NewsFeedPanel } from "@/components/macro-terminal/NewsFeedPanel";
import { EconomicCalendarPanel } from "@/components/macro-terminal/EconomicCalendarPanel";

export default function MacroOverviewPage() {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full overflow-hidden">
      {/* Left Column */}
      <div className="flex flex-col gap-4 lg:col-span-1 xl:col-span-1 h-full overflow-hidden">
        {/* Top row: Macro Regime + Liquidity Flow, equal height */}
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <MacroRegimePanel />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <LiquidityGaugePanel />
          </div>
        </div>

        {/* Bottom row: News Feed */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <NewsFeedPanel />
        </div>
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-4 lg:col-span-2 xl:col-span-3 h-full overflow-hidden">
        <div className="flex-1 min-h-0">
          <HeatmapPanel />
        </div>
        <div className="h-80 shrink-0">
          <EconomicCalendarPanel />
        </div>
      </div>
    </div>
  );
}

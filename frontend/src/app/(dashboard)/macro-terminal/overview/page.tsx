"use client";

import React from "react";
import { MacroRegimePanel } from "@/components/macro-terminal/MacroRegimePanel";
import { LiquidityGaugePanel } from "@/components/macro-terminal/LiquidityGaugePanel";
import { HeatmapPanel } from "@/components/macro-terminal/HeatmapPanel";
import { NewsFeedPanel } from "@/components/macro-terminal/NewsFeedPanel";
import { EconomicCalendarPanel } from "@/components/macro-terminal/EconomicCalendarPanel";

export default function MacroOverviewPage() {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
      <div className="min-h-0">
        <MacroRegimePanel />
      </div>
      <div className="min-h-0 lg:row-span-2">
        <HeatmapPanel />
      </div>
      <div className="min-h-0">
        <LiquidityGaugePanel />
      </div>
      <div className="min-h-[400px]">
        <EconomicCalendarPanel />
      </div>
      <div className="min-h-[400px]">
        <NewsFeedPanel />
      </div>
    </div>
  );
}
"use client";

import React from "react";
import { MacroRegimePanel } from "@/components/macro-terminal/MacroRegimePanel";
import { LiquidityGaugePanel } from "@/components/macro-terminal/LiquidityGaugePanel";
import { HeatmapPanel } from "@/components/macro-terminal/HeatmapPanel";
import { HunterAIReasoningPanel } from "@/components/macro-terminal/HunterAIReasoningPanel";
import { EconomicCalendarPanel } from "@/components/macro-terminal/EconomicCalendarPanel";
import { NewsFeedPanel } from "@/components/macro-terminal/NewsFeedPanel";

export default function MacroOverviewPage() {
  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Row 1 */}
      <MacroRegimePanel className="h-full min-h-[500px]" />
      <HeatmapPanel className="h-full min-h-[500px]" />

      {/* Row 2 */}
      <HunterAIReasoningPanel className="h-[400px]" />
      <LiquidityGaugePanel className="h-[400px]" />

      {/* Row 3 */}
      <EconomicCalendarPanel className="h-[380px]" />
      <NewsFeedPanel className="h-[380px]" />
    </div>
  );
}
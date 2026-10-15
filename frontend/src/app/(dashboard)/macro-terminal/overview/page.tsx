"use client";

import React from "react";
import { Activity, Brain, Calendar, Droplets, Grid3X3, LineChart, Newspaper } from "lucide-react";
import { MacroRegimePanel } from "@/components/macro-terminal/MacroRegimePanel";
import { LiquidityGaugePanel } from "@/components/macro-terminal/LiquidityGaugePanel";
import { HeatmapPanel } from "@/components/macro-terminal/HeatmapPanel";
import { HunterAIReasoningPanel } from "@/components/macro-terminal/HunterAIReasoningPanel";
import { EconomicCalendarPanel } from "@/components/macro-terminal/EconomicCalendarPanel";
import { NewsFeedPanel } from "@/components/macro-terminal/NewsFeedPanel";
import { MacroPriceChart } from "@/components/macro-terminal/MacroPriceChart";
import {
  WidgetWorkspaceProvider,
  useWidgetWorkspaceEnabled,
} from "@/components/macro-terminal/workspace/WidgetWorkspaceProvider";
import { WidgetGrid } from "@/components/macro-terminal/workspace/WidgetGrid";
import { WidgetShell } from "@/components/macro-terminal/workspace/WidgetShell";

/** Layout lama — dipakai saat feature flag OFF (safe rollout). */
function LegacyOverview() {
  return (
    <div className="w-full flex flex-col gap-4">
      {/* Chart harga — paling atas, full-width */}
      <MacroPriceChart className="h-[440px]" />

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
    </div>
  );
}

export default function MacroOverviewPage() {
  const enabled = useWidgetWorkspaceEnabled();

  if (!enabled) return <LegacyOverview />;

  return (
    <WidgetWorkspaceProvider tab="overview" enabled>
      <WidgetGrid tab="overview">
        {/* Chart harga makro — full-width di paling atas (y:0, h:5).
            Sebelumnya ini HANYA ada di LegacyOverview; tanpa blok ini chart
            akan hilang saat feature flag widget workspace dinyalakan. */}
        <div key="price-chart">
          <WidgetShell widgetId="price-chart" title="Macro Price Chart" icon={LineChart}>
            <MacroPriceChart className="h-full" />
          </WidgetShell>
        </div>

        <div key="macro-regime">
          <WidgetShell widgetId="macro-regime" title="Macro Regime" icon={Activity}>
            <MacroRegimePanel className="h-full" />
          </WidgetShell>
        </div>

        <div key="heatmap">
          <WidgetShell widgetId="heatmap" title="ETF Heatmap" icon={Grid3X3}>
            <HeatmapPanel className="h-full" />
          </WidgetShell>
        </div>

        <div key="liquidity-gauge">
          <WidgetShell widgetId="liquidity-gauge" title="Liquidity Flow" icon={Droplets}>
            <LiquidityGaugePanel className="h-full" />
          </WidgetShell>
        </div>

        <div key="ai-reasoning">
          <WidgetShell widgetId="ai-reasoning" title="AI Reasoning" icon={Brain}>
            <HunterAIReasoningPanel className="h-full" />
          </WidgetShell>
        </div>

        <div key="economic-calendar">
          <WidgetShell widgetId="economic-calendar" title="Economic Calendar" icon={Calendar}>
            <EconomicCalendarPanel className="h-full" />
          </WidgetShell>
        </div>

        <div key="news-feed">
          <WidgetShell widgetId="news-feed" title="News Feed" icon={Newspaper}>
            <NewsFeedPanel className="h-full" />
          </WidgetShell>
        </div>
      </WidgetGrid>
    </WidgetWorkspaceProvider>
  );
}

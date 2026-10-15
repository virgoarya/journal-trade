"use client";

import React from "react";
import { Brain, LineChart, Scale } from "lucide-react";
import { YieldCurvePanel } from "@/components/macro-terminal/YieldCurvePanel";
import { CurveExplainerPanel } from "@/components/macro-terminal/CurveExplainerPanel";
import { CentralBankDifferentialsPanel } from "@/components/macro-terminal/CentralBankDifferentialsPanel";
import {
  WidgetWorkspaceProvider,
  useWidgetWorkspaceEnabled,
} from "@/components/macro-terminal/workspace/WidgetWorkspaceProvider";
import { WidgetGrid } from "@/components/macro-terminal/workspace/WidgetGrid";
import { WidgetShell } from "@/components/macro-terminal/workspace/WidgetShell";

/** Layout lama — dipakai saat feature flag OFF. */
function LegacyQuantLab() {
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[720px] lg:h-[800px]">
      {/* LEFT COLUMN: US Treasury Yield Curve at top, FX Central Bank Differentials at bottom */}
      <div className="lg:col-span-2 flex flex-col min-h-0 gap-4">
        <YieldCurvePanel className="flex-[5]" />
        <CentralBankDifferentialsPanel className="flex-[3]" />
      </div>

      {/* RIGHT COLUMN: AI Yield Curve Analysis & Quant Lab (equal height to left column) */}
      <div className="lg:col-span-3 flex flex-col min-h-0">
        <CurveExplainerPanel className="flex-1" />
      </div>
    </div>
  );
}

export default function QuantLabPage() {
  const enabled = useWidgetWorkspaceEnabled();

  if (!enabled) return <LegacyQuantLab />;

  return (
    <WidgetWorkspaceProvider tab="quant-lab" enabled>
      <WidgetGrid tab="quant-lab">
        <div key="yield-curve">
          <WidgetShell widgetId="yield-curve" title="US Treasury Yield Curve" icon={LineChart}>
            <YieldCurvePanel className="h-full" />
          </WidgetShell>
        </div>

        <div key="central-bank-differentials">
          <WidgetShell
            widgetId="central-bank-differentials"
            title="Central Bank Differentials"
            icon={Scale}
          >
            <CentralBankDifferentialsPanel className="h-full" />
          </WidgetShell>
        </div>

        <div key="curve-explainer">
          <WidgetShell widgetId="curve-explainer" title="AI Yield Analysis" icon={Brain}>
            <CurveExplainerPanel className="h-full" />
          </WidgetShell>
        </div>
      </WidgetGrid>
    </WidgetWorkspaceProvider>
  );
}

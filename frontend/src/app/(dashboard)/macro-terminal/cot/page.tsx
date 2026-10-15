"use client";

import React from "react";
import { BarChart3 } from "lucide-react";
import CotPanel from "@/components/macro-terminal/CotPanel";
import {
  WidgetWorkspaceProvider,
  useWidgetWorkspaceEnabled,
} from "@/components/macro-terminal/workspace/WidgetWorkspaceProvider";
import { WidgetGrid } from "@/components/macro-terminal/workspace/WidgetGrid";
import { WidgetShell } from "@/components/macro-terminal/workspace/WidgetShell";

/** Layout lama — dipakai saat feature flag OFF. */
function LegacyCot() {
  return (
    <div className="flex flex-col w-full gap-4">
      <CotPanel />
    </div>
  );
}

export default function CotPage() {
  const enabled = useWidgetWorkspaceEnabled();

  if (!enabled) return <LegacyCot />;

  return (
    <WidgetWorkspaceProvider tab="cot" enabled>
      <WidgetGrid tab="cot">
        <div key="cot-panel">
          <WidgetShell widgetId="cot-panel" title="COT Positioning" icon={BarChart3}>
            <CotPanel />
          </WidgetShell>
        </div>
      </WidgetGrid>
    </WidgetWorkspaceProvider>
  );
}

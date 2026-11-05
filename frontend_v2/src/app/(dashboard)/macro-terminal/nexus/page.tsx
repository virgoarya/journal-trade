"use client";

import React from "react";
import { Activity } from "lucide-react";
import Nexus from "@/components/macro-terminal/Nexus";
import {
  WidgetWorkspaceProvider,
  useWidgetWorkspaceEnabled,
} from "@/components/macro-terminal/workspace/WidgetWorkspaceProvider";
import { WidgetGrid } from "@/components/macro-terminal/workspace/WidgetGrid";
import { WidgetShell } from "@/components/macro-terminal/workspace/WidgetShell";

/** Layout lama — dipakai saat feature flag OFF. */
function LegacyNexus() {
  return (
    <div className="flex flex-col min-h-0 space-y-4">
      <Nexus />
    </div>
  );
}

export default function NexusPage() {
  const enabled = useWidgetWorkspaceEnabled();

  if (!enabled) return <LegacyNexus />;

  return (
    <WidgetWorkspaceProvider tab="nexus" enabled>
      <WidgetGrid tab="nexus">
        <div key="nexus">
          <WidgetShell
            widgetId="nexus"
            title="Nexus"
            icon={Activity}
            hideable={false}
            removable={false}
          >
            <Nexus />
          </WidgetShell>
        </div>
      </WidgetGrid>
    </WidgetWorkspaceProvider>
  );
}

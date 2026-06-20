"use client";

import React from "react";
import { GeoRiskRadarPanel } from "@/components/macro-terminal/GeoRiskRadarPanel";
import { AiPersonaChatPanel } from "@/components/macro-terminal/AiPersonaChatPanel";

export default function IntelligencePage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[720px] lg:h-[calc(100vh-17rem)]">
      {/* Left: Geo-Risk Radar (2/5) */}
      <div className="lg:col-span-2 flex flex-col min-h-0 h-full overflow-y-auto custom-scrollbar pr-2">
        <GeoRiskRadarPanel />
      </div>

      {/* Right: AI Expert Personas Chat (3/5) */}
      <div className="lg:col-span-3 flex flex-col min-h-0 h-full">
        <AiPersonaChatPanel />
      </div>
    </div>
  );
}

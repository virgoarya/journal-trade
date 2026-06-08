"use client";

import React from "react";
import { GeoRiskRadarPanel } from "@/components/macro-terminal/GeoRiskRadarPanel";
import { AiPersonaChatPanel } from "@/components/macro-terminal/AiPersonaChatPanel";

export default function IntelligencePage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full overflow-visible">
      {/* Left: Geo-Risk Radar (2/5) */}
      <div className="lg:col-span-2 h-full min-h-0 overflow-visible">
        <GeoRiskRadarPanel />
      </div>

      {/* Right: AI Expert Personas Chat (3/5) */}
      <div className="lg:col-span-3 h-full min-h-0 overflow-visible">
        <AiPersonaChatPanel />
      </div>
    </div>
  );
}

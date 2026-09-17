"use client";

import React, { useState } from "react";
import { GeoRiskRadarPanel } from "@/components/macro-terminal/GeoRiskRadarPanel";
import { AgentIntelligencePanel } from "@/components/agent-intelligence-panel";
import { AiPersonaChatPanel } from "@/components/macro-terminal/AiPersonaChatPanel";

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<"intelligence" | "personaChat">("intelligence");

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[720px] lg:h-[800px]">
      {/* Left: Geo-Risk Radar (2/5) */}
      <div className="lg:col-span-2 flex flex-col min-h-0 h-full overflow-y-auto custom-scrollbar pr-2">
        <GeoRiskRadarPanel />
      </div>

      {/* Right: Agent Intelligence / Persona Chat (3/5) */}
      <div className="lg:col-span-3 flex flex-col min-h-0 h-full rounded-xl border border-accent-gold/30 bg-card p-4 shadow-xl">
        {/* Main Panel Header & Switcher */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-accent-gold font-mono text-sm font-bold">🧠 AI Command & Intelligence</span>
          </div>
          <div className="flex items-center gap-1 bg-surface-elevated/60 rounded-lg p-1 border border-border-subtle">
            <button
              onClick={() => setActiveTab("intelligence")}
              className={`px-3 py-1 font-mono text-xs font-semibold rounded transition-all ${
                activeTab === "intelligence"
                  ? "bg-accent-gold text-surface font-bold shadow"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Intelligence & Debate
            </button>
            <button
              onClick={() => setActiveTab("personaChat")}
              className={`px-3 py-1 font-mono text-xs font-semibold rounded transition-all ${
                activeTab === "personaChat"
                  ? "bg-accent-gold text-surface font-bold shadow"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              1-on-1 Chat
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === "intelligence" && <AgentIntelligencePanel />}
          {activeTab === "personaChat" && <AiPersonaChatPanel />}
        </div>
      </div>
    </div>
  );
}
